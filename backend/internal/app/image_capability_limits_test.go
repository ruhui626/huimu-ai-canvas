package app

import (
	"strings"
	"testing"
)

func TestImagePromptLimitUsesConfiguredCapability(t *testing.T) {
	for _, wire := range []string{"youchuan-image", "runninghub-youchuan-image"} {
		profile := DefaultImageCapabilityConfig(wire, "v8.2")
		input := canvasGenerationInput{Prompt: strings.Repeat("猫", 8130), Config: providerConfig{InterfaceType: wire, Model: "v8.2"}}
		profile.References.PromptMaxChars = 8130
		if err := validateImageTask(profile, input); err != nil {
			t.Fatalf("%s configured limit rejected: %v", wire, err)
		}
		input.Prompt += "猫"
		if err := validateImageTask(profile, input); err == nil {
			t.Fatalf("%s accepted prompt above configured limit", wire)
		}
		profile.References.PromptMaxChars = 9000
		if err := validateImageTask(profile, input); err != nil {
			t.Fatalf("%s raised limit ignored: %v", wire, err)
		}
		profile.References.PromptMaxChars = 100
		if err := validateImageTask(profile, input); err == nil {
			t.Fatalf("%s lowered limit ignored", wire)
		}
	}
}
