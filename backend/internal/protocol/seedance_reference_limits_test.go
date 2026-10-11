package protocol

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestOfficialSeedanceReferenceCountsAreNotHardcoded(t *testing.T) {
	adapter := officialPackageAdapter(t, "volcengine-ark-seedance.yingce-plugin", "volcengine-ark-video")
	request := GenerationRequest{Model: "seedance", Prompt: "test"}
	for i := 0; i < 30; i++ {
		request.Images = append(request.Images, MediaReference{URL: "https://example.com/image.png"})
	}
	for i := 0; i < 4; i++ {
		request.Videos = append(request.Videos, MediaReference{URL: "https://example.com/video.mp4"})
		request.Audios = append(request.Audios, MediaReference{URL: "https://example.com/audio.wav"})
	}
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		Content []json.RawMessage `json:"content"`
	}
	encoded, err := json.Marshal(spec.Body)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Content) != 39 {
		t.Fatalf("media truncated: content count = %d", len(body.Content))
	}
	_, err = adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{Model: "seedance", Prompt: "test", Audios: request.Audios}})
	if err == nil || !strings.Contains(err.Error(), "不支持纯音频") {
		t.Fatalf("combination validation missing: %v", err)
	}

	// The separate Agent Plan protocol keeps its existing contract.
	agent := officialPackageAdapter(t, "volcengine-ark-agent-plan-seedance.yingce-plugin", "volcengine-ark-agent-plan-video")
	if _, err := agent.BuildCreate(context.Background(), RequestContext{Request: request}); err == nil {
		t.Fatal("Agent Plan limit changed")
	}
}
