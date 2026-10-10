package protocol

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestDoubaoStreamingTTSPackageBuildsOfficialRequest(t *testing.T) {
	manifest := []byte(`{
		"apiVersion":"yingce.plugin/v2",
		"id":"doubao-streaming-tts","name":"Doubao Streaming TTS","version":"2.0.0","author":"Volcengine",
		"contributes":{"providers":[{"id":"doubao-streaming-tts","label":"Doubao Streaming TTS","capabilities":["audio"],"scopes":["canvas"],"auth":{"type":"header","field":"apiKey","header":"X-Api-Key"},"create":{"method":"POST","path":"/api/v3/tts/unidirectional","contentType":"application/json","body":{"req_params":{"$json":{"text":{"$ref":"request.prompt"},"speaker":{"$ref":"request.extra.audioVoice"},"model":{"$ref":"request.model"}}}},"headers":{"X-Api-Resource-Id":{"$coalesce":[{"$ref":"request.providerOptions.doubao-streaming-tts.resourceId"},"seed-tts-2.0"]},"X-Api-Request-Id":{"$ref":"request.extra.idempotencyKey"}}},"response":{"streamedJsonAudio":true,"resultKind":"audio"}}]}
	}`)
	adapter, err := LoadManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability: CapabilityAudio,
		Model:      "seed-tts-2.0",
		Prompt:     "你好",
		Extra:      map[string]any{"audioVoice": "speaker-1", "idempotencyKey": "request-1"},
		ProviderOptions: map[string]map[string]any{
			"doubao-streaming-tts": {"resourceId": "seed-icl-2.0"},
		},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if spec.Headers["X-Api-Resource-Id"] != "seed-icl-2.0" || spec.Headers["X-Api-Request-Id"] != "request-1" {
		t.Fatalf("headers = %#v", spec.Headers)
	}
	body, ok := spec.Body.(map[string]any)
	if !ok {
		t.Fatalf("body type = %T", spec.Body)
	}
	params, ok := body["req_params"].(string)
	if !ok {
		t.Fatalf("req_params type = %T, want JSON string", body["req_params"])
	}
	var decoded map[string]any
	if err := json.Unmarshal([]byte(params), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["text"] != "你好" || decoded["speaker"] != "speaker-1" || decoded["model"] != "seed-tts-2.0" {
		t.Fatalf("req_params = %#v", decoded)
	}
}

func TestStreamedJSONAudioCreateResultConcatenatesFrames(t *testing.T) {
	first := base64.StdEncoding.EncodeToString([]byte("first"))
	second := base64.StdEncoding.EncodeToString([]byte("second"))
	body := []byte(`{"code":0,"data":"` + first + `"}{"code":0,"data":"` + second + `","usage":{"characters":6}}`)
	adapter := manifestAdapter{manifest: Manifest{Response: ManifestResponse{StreamedJSONAudio: true, ResultKind: "audio"}}}
	result, err := adapter.ParseCreate(context.Background(), body)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != StatusSucceeded || result.Result == nil || len(result.Result.Audios) != 1 {
		t.Fatalf("result = %#v", result)
	}
	if !strings.HasPrefix(result.Result.Audios[0].DataURL, "data:audio/mpeg;base64,") {
		t.Fatalf("data URL = %q", result.Result.Audios[0].DataURL)
	}
	encoded := strings.TrimPrefix(result.Result.Audios[0].DataURL, "data:audio/mpeg;base64,")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || string(decoded) != "firstsecond" {
		t.Fatalf("audio bytes = %q, err = %v", decoded, err)
	}
}

func TestStreamedJSONAudioCreateResultRejectsBusinessError(t *testing.T) {
	adapter := manifestAdapter{manifest: Manifest{Response: ManifestResponse{StreamedJSONAudio: true, ResultKind: "audio"}}}
	_, err := adapter.ParseCreate(context.Background(), []byte(`{"code":30000001,"message":"invalid speaker"}`))
	if err == nil || !strings.Contains(err.Error(), "invalid speaker") {
		t.Fatalf("error = %v", err)
	}
}

func TestDoubaoSeedAudioCreateUsesTextPromptWithoutResourceHeader(t *testing.T) {
	manifest, err := os.ReadFile("../../../plugin-packages/doubao-streaming-tts/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	adapter, err := LoadManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{Capability: CapabilityAudio, Model: "seed-audio-1.0", Prompt: "你好"}})
	if err != nil {
		t.Fatal(err)
	}
	if spec.Path != "/api/v3/tts/create" {
		t.Fatalf("path = %s", spec.Path)
	}
	if _, ok := spec.Headers["X-Api-Resource-Id"]; ok {
		t.Fatalf("seed-audio create must not send a TTS resource header: %#v", spec.Headers)
	}
	body := spec.Body.(map[string]any)
	if body["model"] != "seed-audio-1.0" || body["text_prompt"] != "你好" || body["references"] != nil {
		t.Fatalf("text-only body = %#v", body)
	}
}

func TestDoubaoSeedAudioCreateSendsReferenceAudioAndImage(t *testing.T) {
	manifest, err := os.ReadFile("../../../plugin-packages/doubao-streaming-tts/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	adapter, err := LoadManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	audioSpec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability: CapabilityAudio,
		Model:      "seed-audio-1.0",
		Prompt:     "@Audio1 用这个声音说你好",
		Audios:     []MediaReference{{URL: "https://cdn.example.com/voice.mp3", Kind: "audio"}},
		Extra:      map[string]any{"audioVoice": "zh_female_qingxinnvsheng_uranus_bigtts", "audioFormat": "mp3"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	audioBody := audioSpec.Body.(map[string]any)
	references, _ := audioBody["references"].([]any)
	if len(references) != 2 {
		t.Fatalf("audio references = %#v", audioBody["references"])
	}
	reference, _ := references[0].(map[string]any)
	speaker, _ := references[1].(map[string]any)
	if reference["audio_url"] != "https://cdn.example.com/voice.mp3" || reference["audio_data"] != nil || speaker["speaker"] != "zh_female_qingxinnvsheng_uranus_bigtts" {
		t.Fatalf("audio references = %#v", references)
	}

	imageSpec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability: CapabilityAudio,
		Model:      "seed-audio-1.0",
		Prompt:     "根据图片内容生成音频",
		Images:     []MediaReference{{DataURL: "data:image/png;base64,aGVsbG8=", Kind: "image"}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	imageBody := imageSpec.Body.(map[string]any)
	imageReferences, _ := imageBody["references"].([]any)
	if len(imageReferences) != 1 {
		t.Fatalf("image references = %#v", imageBody["references"])
	}
	imageReference, _ := imageReferences[0].(map[string]any)
	if imageReference["image_data"] != "aGVsbG8=" || imageReference["image_url"] != nil {
		t.Fatalf("image reference = %#v", imageReference)
	}
}

func TestDoubaoAdvancedAudioParameters(t *testing.T) {
	manifest, err := os.ReadFile("../../../plugin-packages/doubao-streaming-tts/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	adapter, err := LoadManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	request := GenerationRequest{
		Capability: CapabilityAudio, Model: "seed-audio-1.0", Prompt: "你好",
		Extra:           map[string]any{"audioSpeed": "1.25", "audioFormat": "mp3"},
		ProviderOptions: map[string]map[string]any{"doubao-streaming-tts": {"sample_rate": 24000, "pitch_rate": -3, "loudness_rate": 50}},
	}
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	body := spec.Body.(map[string]any)
	settings := body["audio_config"].(map[string]any)
	encoded, _ := json.Marshal(settings)
	var got map[string]any
	_ = json.Unmarshal(encoded, &got)
	if got["sample_rate"] != float64(24000) || got["pitch_rate"] != float64(-3) || got["loudness_rate"] != float64(50) || got["speech_rate"] != float64(25) {
		t.Fatalf("settings = %s", encoded)
	}
	request.Prompt = strings.Repeat("中", 3001)
	if _, err = adapter.BuildCreate(context.Background(), RequestContext{Request: request}); err == nil {
		t.Fatal("accepted oversized prompt")
	}
	request.Prompt = "你好"
	request.Extra["audioSpeed"] = "4"
	if _, err = adapter.BuildCreate(context.Background(), RequestContext{Request: request}); err == nil {
		t.Fatal("accepted unsupported speed")
	}
	request.Extra["audioSpeed"] = "1"
	request.Images = []MediaReference{{Kind: "image", URL: "https://example.com/a.png"}}
	request.Audios = []MediaReference{{Kind: "audio", URL: "https://example.com/a.mp3"}}
	if _, err = adapter.BuildCreate(context.Background(), RequestContext{Request: request}); err == nil {
		t.Fatal("accepted mixed image and audio")
	}
}
