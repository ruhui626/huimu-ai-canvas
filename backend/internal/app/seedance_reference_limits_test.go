package app

import "testing"

func TestSeedanceReferenceCountsFollowModelCapability(t *testing.T) {
	profile := DefaultModelCapabilityConfigForModel("volcengine-ark-video", "seedance").Video
	profile.References.MaxImages = 30
	profile.References.MaxVideos = 4
	profile.References.MaxAudios = 4
	input := canvasGenerationInput{Mode: "video", Prompt: "test", Config: providerConfig{InterfaceType: "volcengine-ark-video", VideoSeconds: "6", Size: "16:9", VQuality: "720p"}, ReferenceImages: make([]providerMedia, 30), ReferenceVideos: make([]providerMedia, 4), ReferenceAudios: make([]providerMedia, 4)}
	if err := validateVideoTask(profile, input); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"image", "video", "audio"} {
		t.Run(kind, func(t *testing.T) {
			over := input
			switch kind {
			case "image":
				over.ReferenceImages = make([]providerMedia, 31)
			case "video":
				over.ReferenceVideos = make([]providerMedia, 5)
			case "audio":
				over.ReferenceAudios = make([]providerMedia, 5)
			}
			if err := validateVideoTask(profile, over); err == nil {
				t.Fatal("configured limit not enforced")
			}
		})
	}
	profile.References.MaxImages = 9
	if err := validateVideoTask(profile, input); err == nil {
		t.Fatal("lowered model limit not enforced")
	}
}
