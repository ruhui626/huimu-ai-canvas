package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Exercise the Agent request path, including a tool result on the next step.
func TestAgentExplicitThinkingRequests(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	for _, declarative := range []bool{false, true} {
		for _, stream := range []bool{false, true} {
			for _, enabled := range []bool{false, true} {
				t.Run(fmt.Sprintf("plugin=%t/stream=%t/thinking=%t", declarative, stream, enabled), func(t *testing.T) {
					calls := 0
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						calls++
						var body map[string]any
						if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
							t.Error(err)
							return
						}
						option, _ := body["thinking"].(map[string]any)
						want := "disabled"
						if enabled {
							want = "enabled"
						}
						if option["type"] != want {
							t.Errorf("thinking = %#v, want %s", option, want)
						}
						if _, ok := body["reasoning_effort"]; ok {
							t.Error("stale effort survived")
						}
						if tools, _ := body["tools"].([]any); len(tools) != 1 {
							t.Error("tools lost")
						}
						if calls == 2 {
							messages, _ := body["messages"].([]any)
							last, _ := messages[len(messages)-1].(map[string]any)
							if last["role"] != "tool" || last["tool_call_id"] != "call-1" {
								t.Error("tool result lost")
							}
						}
						message := `{"content":"done"}`
						if calls == 1 {
							message = `{"content":"","tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"canvas_get_state","arguments":"{}"}}]}`
						}
						if stream {
							w.Header().Set("Content-Type", "text/event-stream")
							fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":%s}]}\n\ndata: [DONE]\n\n", message)
						} else {
							w.Header().Set("Content-Type", "application/json")
							fmt.Fprintf(w, `{"choices":[{"message":%s}]}`, message)
						}
					}))
					defer server.Close()
					ctx := context.Background()
					if declarative {
						ctx = withProtocolRegistry(ctx, loadOfficialFallbackRegistry())
					}
					messages := []any{map[string]any{"role": "user", "content": "Read canvas"}}
					body := map[string]any{"messages": messages, "reasoning_effort": "medium", "thinking": map[string]any{"type": "auto"}, "tools": []any{map[string]any{"type": "function", "function": map[string]any{"name": "canvas_get_state", "parameters": map[string]any{"type": "object"}}}}}
					input := canvasGenerationInput{Mode: "text", StreamText: stream, Config: providerConfig{BaseURL: server.URL, Model: "deepseek-v4-pro-ga-260813", InterfaceType: "chat-completion", APIKey: "test"}, TextOptions: canvasTextOptions{Thinking: enabled}, AgentRequests: &agentToolRequests{ChatCompletion: body}}
					first, err := runAgentToolTask(ctx, input)
					if err != nil {
						t.Fatal(err)
					}
					encoded, err := json.Marshal(first["toolCalls"])
					if err != nil {
						t.Fatal(err)
					}
					var toolCalls []map[string]any
					if err := json.Unmarshal(encoded, &toolCalls); err != nil || len(toolCalls) != 1 {
						t.Fatalf("tool calls = %s, err=%v", encoded, err)
					}
					body["messages"] = append(messages, map[string]any{"role": "assistant", "content": "", "tool_calls": []any{map[string]any{"id": "call-1", "type": "function", "function": map[string]any{"name": "canvas_get_state", "arguments": "{}"}}}}, map[string]any{"role": "tool", "tool_call_id": "call-1", "content": "empty canvas"})
					result, err := runAgentToolTask(ctx, input)
					if err != nil || result["text"] != "done" || calls != 2 {
						t.Fatalf("result=%v calls=%d err=%v", result, calls, err)
					}
				})
			}
		}
	}
}
