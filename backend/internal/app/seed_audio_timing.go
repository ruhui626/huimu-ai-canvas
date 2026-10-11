package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Keep playback length separate from the provider's pre-processing billing length.
// Only server-parsed Seed Audio responses may populate this result/checkpoint field.
type seedAudioTiming struct {
	DurationMs         int64 `json:"durationMs"`
	OriginalDurationMs int64 `json:"originalDurationMs"`
}

func seedAudioTimingFromUsage(config providerConfig, mode string, usage map[string]any) *seedAudioTiming {
	if mode != "audio" || config.InterfaceType != "doubao-streaming-tts" {
		return nil
	}
	return &seedAudioTiming{
		DurationMs:         seedAudioSecondsToMs(usage["duration"], 3600),
		OriginalDurationMs: seedAudioSecondsToMs(usage["original_duration"], 120),
	}
}

func seedAudioSecondsToMs(value any, maximum float64) int64 {
	seconds, err := strconv.ParseFloat(strings.TrimSpace(fmt.Sprint(value)), 64)
	if err != nil || math.IsNaN(seconds) || math.IsInf(seconds, 0) || seconds <= 0 || seconds > maximum {
		return 0
	}
	return int64(math.Ceil(seconds * 1000))
}

func seedAudioBillingDuration(resultJSON string) (int64, error) {
	var result struct {
		Timing *seedAudioTiming `json:"seedAudioTiming"`
	}
	if err := json.Unmarshal([]byte(resultJSON), &result); err != nil || result.Timing == nil || result.Timing.OriginalDurationMs <= 0 || result.Timing.OriginalDurationMs > 120000 {
		return 0, errors.New("豆包音频缺少有效的上游 original_duration，无法按原始时长结算")
	}
	return result.Timing.OriginalDurationMs, nil
}
