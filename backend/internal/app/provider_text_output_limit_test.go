package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"yingce/backend/internal/protocol"
)

func TestDeclarativeTextOutputLimit(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	for _, wire := range []string{"chat-completion", "openai-response", "claude-api"} {
		for _, stream := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/stream=%t", wire, stream), func(t *testing.T) {
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					var body map[string]interface{}
					if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
						t.Error(err)
						return
					}
					field := "max_tokens"
					if wire == "openai-response" {
						field = "max_output_tokens"
					}
					if wire == "chat-completion" && stream {
						field = "max_completion_tokens"
						if _, exists := body["max_tokens"]; exists {
							t.Error("conflicting token fields")
						}
					}
					if body[field] != float64(16384) {
						t.Errorf("%s = %v", field, body[field])
					}
					if stream {
						w.Header().Set("Content-Type", "text/event-stream")
						payload := `{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}`
						if wire == "openai-response" {
							payload = `{"type":"response.output_text.delta","delta":"ok"}`
						}
						if wire == "claude-api" {
							payload = `{"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}`
						}
						fmt.Fprint(w, "data: "+payload+"\n\n")
						return
					}
					w.Header().Set("Content-Type", "application/json")
					fmt.Fprint(w, `{ "choices": [{"message":{"content":"ok"}}] }`)
				}))
				defer server.Close()
				input := canvasGenerationInput{Mode: "text", MaxOutputTokens: 16384, StreamText: stream, Config: providerConfig{BaseURL: server.URL, InterfaceType: wire}}
				body := map[string]interface{}{}
				if wire == "chat-completion" && stream {
					body["max_completion_tokens"] = 4096
					body["max_tokens"] = 4096
				}
				_, result, err := executeProtocolCreateRequest(context.Background(), input, protocol.RequestSpec{Method: "POST", Path: "/test", Body: body})
				if err != nil {
					t.Fatal(err)
				}
				if stream && (result == nil || result.Text != "ok") {
					t.Fatalf("result=%v", result)
				}
			})
		}
	}
}

func TestDeclarativeTruncatedResponseRejected(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	for _, stream := range []bool{false, true} {
		for _, sse := range []bool{false, true} {
			if sse && !stream {
				continue
			}
			t.Run(fmt.Sprintf("stream=%t/sse=%t", stream, sse), func(t *testing.T) {
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					payload := `{"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]}`
					if sse {
						w.Header().Set("Content-Type", "text/event-stream")
						fmt.Fprint(w, "data: "+payload+"\n\n")
						return
					}
					w.Header().Set("Content-Type", "application/json")
					fmt.Fprint(w, payload)
				}))
				defer server.Close()
				input := canvasGenerationInput{Mode: "text", StreamText: stream, Config: providerConfig{BaseURL: server.URL, InterfaceType: "chat-completion"}}
				_, result, err := executeProtocolCreateRequest(context.Background(), input, protocol.RequestSpec{Method: "POST", Path: "/test", Body: map[string]interface{}{}})
				if result != nil || err == nil || !strings.Contains(err.Error(), "Token 上限") {
					t.Fatalf("result=%v err=%v", result, err)
				}
			})
		}
	}
}

func TestTextOutputTruncation(t *testing.T) {
	for _, tc := range []struct{ wire, payload string }{
		{"chat-completion", `{"choices":[{"finish_reason":"length"}]}`},
		{"claude-api", `{"type":"message_delta","delta":{"stop_reason":"max_tokens"}}`},
		{"claude-api", `{"stop_reason":"max_tokens"}`},
		{"responses", `{"type":"response.incomplete","response":{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}`},
		{"responses", `{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}`},
	} {
		t.Run(tc.payload, func(t *testing.T) {
			if err := validateTextResponseJSON([]byte(tc.payload)); err == nil || !strings.Contains(err.Error(), "Token 上限") {
				t.Fatalf("JSON err=%v", err)
			}
			parser := newStreamingAgentParser(tc.wire, nil)
			parser.appendText("partial")
			parser.consume("text/event-stream", []byte("data: "+tc.payload+"\n\n"))
			if _, err := parser.result(); err == nil || !strings.Contains(err.Error(), "Token 上限") {
				t.Fatalf("SSE err=%v", err)
			}
		})
	}
	for _, payload := range []string{`{"choices":[{"finish_reason":"stop"}]}`, `{"choices":[{"finish_reason":"tool_calls"}]}`, `{"stop_reason":"end_turn"}`, `{"status":"completed"}`} {
		if err := validateTextResponseJSON([]byte(payload)); err != nil {
			t.Fatal(err)
		}
	}
}
