package contract

import "testing"

func TestAudioDefaultsSurviveTaskContract(t *testing.T) {
	options, err := OptionsFromTaskConfig("audio", map[string]any{
		"audioVoice": "", "audioSampleRate": "", "audioPitch": "-2", "audioVolume": "1.25",
	})
	if err != nil {
		t.Fatal(err)
	}
	result := options.TaskConfig()
	if result["audioVoice"] != "" || result["audioSampleRate"] != "" || result["audioPitch"] != "-2" || result["audioVolume"] != "1.25" {
		t.Fatalf("options = %#v", result)
	}
}
