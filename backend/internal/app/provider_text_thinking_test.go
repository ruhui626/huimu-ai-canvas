package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestArkTextThinkingScope(t *testing.T) {
	for _, modelID := range []string{"doubao-seed-2-1-pro-260628", "doubao-seed-2-1-pro-260915", "doubao-seed-character-260628"} {
		for _, enabled := range []bool{false, true} {
			for _, scope := range []string{"ark", "other-host", "lookalike-host", "other-model", "responses", "agent"} {
				t.Run(fmt.Sprintf("%s/%t/%s", modelID, enabled, scope), func(t *testing.T) {
					input := canvasGenerationInput{Config: providerConfig{Model: modelID, BaseURL: "https://ark.cn-beijing.volces.com/api/v3"}, TextOptions: canvasTextOptions{Thinking: enabled}}
					wire := "chat-completion"
					switch scope {
					case "other-host":
						input.Config.BaseURL = "https://example.com/api/v3"
					case "lookalike-host":
						input.Config.BaseURL = "https://ark.cn-beijing.volces.com.example.com/api/v3"
					case "other-model":
						input.Config.Model = "doubao-seed-2-1-lite-260915"
					case "responses":
						wire = "responses"
					case "agent":
						input.AgentRequests = &agentToolRequests{}
					}
					body := map[string]interface{}{}
					applyTextThinking(body, input, wire)
					if scope == "ark" || scope == "agent" {
						want := "disabled"
						if enabled {
							want = "enabled"
						}
						option, _ := body["thinking"].(map[string]interface{})
						if option["type"] != want {
							t.Fatalf("thinking = %#v, want %s", option, want)
						}
						if _, exists := body["reasoning_effort"]; exists {
							t.Fatal("must preserve model default effort")
						}
					} else {
						if _, exists := body["thinking"]; exists {
							t.Fatal("Ark thinking mapping escaped its scope")
						}
						if enabled && wire == "chat-completion" && body["reasoning_effort"] != "medium" {
							t.Fatal("existing thinking behavior changed")
						}
						if enabled && wire == "responses" {
							if _, exists := body["reasoning"]; !exists {
								t.Fatal("Responses thinking behavior changed")
							}
						}
						if !enabled && len(body) != 0 {
							t.Fatal("disabled fallback changed")
						}
					}
				})
			}
		}
	}
}

func TestDeclarativeTextThinkingSwitch(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	for _, stream := range []bool{false, true} {
		for _, thinking := range []bool{false, true} {
			for _, model := range []string{"deepseek-v4-pro-ga-260813", "other-model"} {
				t.Run(fmt.Sprintf("%s/stream=%t/thinking=%t", model, stream, thinking), func(t *testing.T) {
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						var body map[string]any
						if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
							t.Error(err)
							return
						}
						if model == "other-model" {
							if _, ok := body["thinking"]; ok {
								t.Error("DeepSeek switch leaked to another model")
							}
							if thinking && body["reasoning_effort"] != "medium" {
								t.Error("generic thinking option missing")
							}
						} else {
							option, _ := body["thinking"].(map[string]any)
							want := "disabled"
							if thinking {
								want = "enabled"
							}
							if option["type"] != want {
								t.Errorf("thinking = %#v, want %s", option, want)
							}
							if _, ok := body["reasoning_effort"]; ok {
								t.Error("unexpected generic effort")
							}
						}
						w.Header().Set("Content-Type", "application/json")
						fmt.Fprint(w, `{"choices":[{"message":{"content":"ok"}}]}`)
					}))
					defer server.Close()
					input := canvasGenerationInput{Mode: "text", Prompt: "hello", StreamText: stream, TextOptions: canvasTextOptions{Thinking: thinking}, Config: providerConfig{BaseURL: server.URL, APIKey: "test", Model: model, InterfaceType: "chat-completion"}}
					result, err := runTextTask(withProtocolRegistry(context.Background(), loadOfficialFallbackRegistry()), input)
					if err != nil || result["text"] != "ok" {
						t.Fatalf("result=%v err=%v", result, err)
					}
				})
			}
		}
	}
}
