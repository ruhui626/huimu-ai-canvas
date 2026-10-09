package app

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"yingce/backend/internal/protocol"
)

func TestSeedanceAdaptiveRatioReachesPackagedProtocol(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "plugin-packages", "volcengine-ark-seedance.yingce-plugin"))
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := protocol.ParsePluginPackage(data)
	if err != nil {
		t.Fatal(err)
	}
	adapters, err := protocol.LoadInstalledProviders(pkg.ManifestRaw, nil)
	if err != nil || len(adapters) != 1 {
		t.Fatalf("adapters=%d err=%v", len(adapters), err)
	}
	for _, ratio := range []string{"adaptive", "16:9"} {
		request := protocolRequestFromInput(canvasGenerationInput{Mode: "video", Prompt: "test", Config: providerConfig{Model: "test-video", Size: ratio}})
		spec, err := adapters[0].BuildCreate(context.Background(), protocol.RequestContext{Request: request})
		if err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(spec.Body)
		if err != nil {
			t.Fatal(err)
		}
		var body map[string]any
		if err := json.Unmarshal(raw, &body); err != nil {
			t.Fatal(err)
		}
		if body["ratio"] != ratio {
			t.Fatalf("ratio=%v want %s", body["ratio"], ratio)
		}
	}
	if !videoRatioAllowed([]string{"16:9", "adaptive"}, "adaptive") || videoRatioAllowed([]string{"16:9"}, "adaptive") {
		t.Fatal("adaptive must require explicit model capability")
	}
}
