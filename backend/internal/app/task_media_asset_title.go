package app

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"infinite-canvas/backend/internal/model"
)

type generatedAssetTitleContext struct {
	BaseTitle       string
	SourceNodeID    string
	SourceNodeTitle string
}

type generatedAssetTitle struct {
	Title     string
	BaseTitle string
	Sequence  int
}

var (
	generatedAssetMentionPattern = regexp.MustCompile(`@\[[^\]]+\]|@(图片|视频|音频|文本|角色|绘图)\d+`)
	generatedAssetSpacePattern   = regexp.MustCompile(`\s+`)
)

func generatedAssetTitleContextFromTask(task model.Task, kind string) generatedAssetTitleContext {
	var input struct {
		Metadata map[string]any `json:"metadata"`
	}
	_ = json.Unmarshal([]byte(task.InputJSON), &input)
	context := generatedAssetTitleContext{
		BaseTitle:       truncateGeneratedAssetTitle(generatedAssetString(input.Metadata, "assetTitleBase"), 80),
		SourceNodeID:    truncateGeneratedAssetTitle(generatedAssetString(input.Metadata, "assetTitleSourceNodeId"), 80),
		SourceNodeTitle: truncateGeneratedAssetTitle(generatedAssetString(input.Metadata, "assetTitleSourceNodeTitle"), 80),
	}
	if context.BaseTitle == "" {
		context.BaseTitle = generatedAssetBaseTitle(kind, context.SourceNodeTitle, task.Prompt, task.CreatedAt)
	}
	return context
}

func generatedAssetBaseTitle(kind string, sourceTitle string, prompt string, createdAt time.Time) string {
	typeLabel := generatedAssetTypeLabel(kind)
	source := cleanGeneratedAssetTitleSource(sourceTitle, typeLabel)
	promptTitle := cleanGeneratedAssetTitleSource(prompt, typeLabel)
	subject := source
	if generatedAssetGenericTitle(subject) {
		subject = promptTitle
	}
	if generatedAssetGenericTitle(subject) {
		if !createdAt.IsZero() {
			subject = createdAt.Local().Format("01-02 15:04")
		} else {
			subject = ""
		}
	}
	if subject == "" {
		return "生成" + typeLabel
	}
	return subject + " · " + typeLabel
}

func allocateGeneratedAssetTitle(kind string, baseTitle string, sourceNodeID string, assets []model.Asset) generatedAssetTitle {
	maximum := 0
	numberedTitle := regexp.MustCompile(`^` + regexp.QuoteMeta(baseTitle) + ` · (\d+)$`)
	for _, asset := range assets {
		if asset.Kind != kind {
			continue
		}
		metadata := generatedAssetMetadata(asset.PayloadJSON)
		metadataSourceNodeID := generatedAssetString(metadata, "generationTitleSourceNodeId")
		metadataBase := generatedAssetString(metadata, "generationTitleBase")
		metadataSequence := generatedAssetInt(metadata, "generationTitleSequence")
		if sourceNodeID != "" && metadataSourceNodeID == sourceNodeID && metadataSequence > 0 {
			maximum = max(maximum, metadataSequence)
			continue
		}
		if metadataBase == baseTitle && metadataSequence > 0 {
			maximum = max(maximum, metadataSequence)
			continue
		}
		if asset.Title == baseTitle {
			maximum = max(maximum, 1)
			continue
		}
		if match := numberedTitle.FindStringSubmatch(asset.Title); len(match) == 2 {
			if sequence, err := strconv.Atoi(match[1]); err == nil {
				maximum = max(maximum, sequence)
			}
		}
	}
	sequence := maximum + 1
	title := baseTitle
	if sequence > 1 {
		title = fmt.Sprintf("%s · %02d", baseTitle, sequence)
	}
	return generatedAssetTitle{Title: title, BaseTitle: baseTitle, Sequence: sequence}
}

func generatedAssetMetadata(payloadJSON string) map[string]any {
	var payload struct {
		Metadata map[string]any `json:"metadata"`
	}
	if json.Unmarshal([]byte(payloadJSON), &payload) != nil {
		return nil
	}
	return payload.Metadata
}

func generatedAssetString(values map[string]any, key string) string {
	value, _ := values[key].(string)
	return strings.TrimSpace(value)
}

func generatedAssetInt(values map[string]any, key string) int {
	switch value := values[key].(type) {
	case float64:
		return max(0, int(value))
	case int:
		return max(0, value)
	default:
		return 0
	}
}

func generatedAssetTypeLabel(kind string) string {
	switch kind {
	case "image":
		return "图片"
	case "video":
		return "视频"
	case "audio":
		return "音频"
	default:
		return "作品"
	}
}

func generatedAssetGenericTitle(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return true
	}
	switch value {
	case "图片", "视频", "音频", "生成图片", "生成视频", "生成音频", "生成作品", "生成配置", "image", "video", "audio", "generated image", "generated video", "generated audio":
		return true
	default:
		return false
	}
}

func cleanGeneratedAssetTitleSource(value string, typeLabel string) string {
	value = generatedAssetMentionPattern.ReplaceAllString(value, " ")
	value = generatedAssetSpacePattern.ReplaceAllString(value, " ")
	value = strings.Trim(value, " \t\r\n，。；：、,.!！?？")
	for _, suffix := range []string{" · " + typeLabel, "·" + typeLabel, "-" + typeLabel, "生成" + typeLabel} {
		value = strings.TrimSpace(strings.TrimSuffix(value, suffix))
	}
	value = strings.Trim(value, " \t\r\n，。；：、,.!！?？")
	return truncateGeneratedAssetTitle(value, 32)
}

func truncateGeneratedAssetTitle(value string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}
