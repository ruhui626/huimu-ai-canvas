package app

import (
	"strings"
	"testing"
)

func TestYouchuanPromptParameterMessage(t *testing.T) {
	for _, wire := range []string{"youchuan-image", "runninghub-youchuan-image"} {
		err := validateYouchuanPromptParameters(wire, "a man --v 8.2 --stylize 300")
		want := "提示词包含手写模型参数：「--v 8.2」、「--stylize 300」。请从提示词中移除，并通过模型选择和高级设置调整。"
		if err == nil || err.Error() != want {
			t.Fatalf("%s: %v", wire, err)
		}
		if err := validateYouchuanPromptParameters(wire, "a man"); err != nil {
			t.Fatal(err)
		}
		err = validateYouchuanPromptParameters(wire, "cat --sref https://example.com/private?token=secret --")
		if err == nil || strings.Contains(err.Error(), "secret") || !strings.Contains(err.Error(), "--sref") {
			t.Fatalf("unsafe message: %v", err)
		}
		err = validateYouchuanPromptParameters(wire, "--a 1 --b 2 --c 3 --d 4 --e 5 --f 6")
		if err == nil || !strings.Contains(err.Error(), "等") || strings.Contains(err.Error(), "--f") {
			t.Fatalf("unbounded message: %v", err)
		}
		if err := validateYouchuanPromptParameters(wire, "ordinary -- separator"); err == nil {
			t.Fatal("existing double-hyphen restriction changed")
		}
	}
	if err := validateYouchuanPromptParameters("chat-completion", "text --v 8.2"); err != nil {
		t.Fatal("other protocol affected", err)
	}
}
