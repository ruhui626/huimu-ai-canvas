package app

import (
	"context"
	"errors"
	"strings"

	"yingce/backend/internal/protocol"
)

// Built-in image adapters return the same image list in several Go map shapes.
// Normalize only that list, without a full JSON copy of base64 results.
func recoverBuiltInImageResult(ctx context.Context, config providerConfig, result map[string]interface{}) (map[string]interface{}, error) {
	var items []map[string]interface{}
	switch images := result["images"].(type) {
	case []map[string]string:
		for _, image := range images {
			item := make(map[string]interface{}, len(image))
			for key, value := range image {
				item[key] = value
			}
			items = append(items, item)
		}
	case []map[string]interface{}:
		items = images
	case []interface{}:
		for _, image := range images {
			item, ok := image.(map[string]interface{})
			if !ok {
				return nil, errors.New("图片结果格式无效")
			}
			items = append(items, item)
		}
	default:
		return result, nil
	}
	if len(items) == 0 {
		return result, nil
	}
	references := make([]protocol.MediaReference, 0, len(items))
	for _, item := range items {
		// Declarative adapters have already completed or checkpointed delivery.
		if stringField(item, "resourceId") != "" {
			return result, nil
		}
		value := firstNonEmptyString(stringField(item, "dataUrl"), stringField(item, "url"))
		ref := protocol.MediaReference{MIMEType: stringField(item, "mimeType")}
		if strings.HasPrefix(value, "data:") {
			ref.DataURL = value
			ref.URL = stringField(item, "url")
			if !isPublicMediaURL(ref.URL) {
				ref.URL = ""
			}
		} else if isPublicMediaURL(value) {
			ref.URL = value
		} else {
			return result, nil
		}
		references = append(references, ref)
	}
	if output, handled, err := recoverProtocolMedia(ctx, config, "image", references, nil); handled {
		return output, err
	}
	return result, nil
}

type legacyAudioDelivery struct {
	Format string `json:"format"`
}
type legacyAudioDeliveryKey struct{}

// Legacy audio had no measured duration in its result. Keep that contract: do
// not turn a storage refactor into a new source of per-second billing data.
func recoverBuiltInAVResult(ctx context.Context, config providerConfig, mode string, result map[string]interface{}) (map[string]interface{}, error) {
	item, ok := result[mode].(map[string]interface{})
	if !ok || stringField(item, "resourceId") != "" {
		return result, nil
	}
	value := firstNonEmptyString(stringField(item, "dataUrl"), stringField(item, "url"))
	ref := protocol.MediaReference{MIMEType: stringField(item, "mimeType")}
	if strings.HasPrefix(value, "data:") {
		ref.DataURL = value
	} else if isPublicMediaURL(value) {
		ref.URL = value
	} else {
		return result, nil
	}
	if mode == "audio" {
		ctx = context.WithValue(ctx, legacyAudioDeliveryKey{}, legacyAudioDelivery{Format: stringField(item, "format")})
	}
	if output, handled, err := recoverProtocolMedia(ctx, config, mode, []protocol.MediaReference{ref}, nil); handled {
		return output, err
	}
	return result, nil
}

func pendingLegacyMediaResult(mode, url string) map[string]interface{} {
	return map[string]interface{}{"mode": mode, mode: map[string]interface{}{"url": url}}
}
