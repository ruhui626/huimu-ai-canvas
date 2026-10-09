package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"yingce/backend/internal/model"
)

func TestSystemTextTaskUsesSavedOutputLimit(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	for _, stream := range []bool{false, true} {
		t.Run(fmt.Sprintf("stream=%t", stream), func(t *testing.T) {
			svc, db := newChannelModelTestService(t)
			svc.dataDir = t.TempDir()
			// 预置测试密钥，避免把平台相关的首次密钥发布流程混入配置传递测试。
			if err := os.WriteFile(filepath.Join(svc.dataDir, ".settings-key"), []byte("01234567890123456789012345678901"), 0o600); err != nil {
				t.Fatal(err)
			}
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				var body map[string]interface{}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Error(err)
					return
				}
				if body["max_tokens"] != float64(32768) {
					t.Errorf("max_tokens=%v, want saved 32768", body["max_tokens"])
				}
				gotStream, _ := body["stream"].(bool)
				if gotStream != stream {
					t.Errorf("stream=%v, want %v", gotStream, stream)
				}
				if stream {
					w.Header().Set("Content-Type", "text/event-stream")
					fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n\n")
				} else {
					w.Header().Set("Content-Type", "application/json")
					fmt.Fprint(w, `{"choices":[{"message":{"content":"ok"},"finish_reason":"stop"}]}`)
				}
			}))
			defer server.Close()
			channel := model.ModelChannel{ID: "text-channel", Scope: model.ChannelScopeSystem, Enabled: true, BaseURL: server.URL, APIKey: "test-key", APIFormat: "openai"}
			if err := svc.encryptSystemChannelSecrets(&channel); err != nil {
				t.Fatal(err)
			}
			profile := DefaultModelCapabilityConfigForModel("chat-completion", "test-model")
			profile.Text.MaxOutputTokens = 32768
			profile.Text.Streaming = &stream
			item := model.ChannelModel{ID: "text-model", ChannelID: channel.ID, ModelKey: "test-model", Capability: "text", Protocol: model.ChannelInterfaceChatCompletion, Enabled: true, CapabilityConfigJSON: mustEncodeModelCapabilityConfig(t, profile)}
			if err := db.Create(&channel).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&item).Error; err != nil {
				t.Fatal(err)
			}
			for _, stale := range []bool{false, true} {
				config := providerConfig{ChannelID: channel.ID, Model: item.ModelKey}
				if stale {
					config.CapabilityConfig = DefaultModelCapabilityConfigForModel("chat-completion", item.ModelKey)
					config.CapabilityConfig.Text.MaxOutputTokens = 4096
				}
				raw, err := json.Marshal(canvasGenerationInput{Mode: "text", Config: config})
				if err != nil {
					t.Fatal(err)
				}
				result, err := svc.processCanvasGenerationTask(context.Background(), "test-user", "", "canvas_text", "hello", string(raw))
				if err != nil || result["text"] != "ok" {
					t.Fatalf("stale=%t result=%v err=%v", stale, result, err)
				}
			}
			if calls.Load() != 2 {
				t.Fatalf("calls=%d", calls.Load())
			}
			if err := db.Model(&item).Update("capability_config_json", "{").Error; err != nil {
				t.Fatal(err)
			}
			if _, err := svc.resolveProviderConfig(providerConfig{ChannelID: channel.ID, Model: item.ModelKey, CapabilityConfig: profile}); err == nil {
				t.Fatal("invalid server configuration must not fall back to client configuration")
			}
		})
	}
}
