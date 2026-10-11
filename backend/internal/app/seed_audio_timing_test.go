package app

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestSeedAudioTimingValidation(t *testing.T) {
	config := providerConfig{InterfaceType: "doubao-streaming-tts"}
	for _, value := range []any{nil, 0, -1, "bad", math.NaN(), math.Inf(1), 120.01} {
		timing := seedAudioTimingFromUsage(config, "audio", map[string]any{"duration": 10, "original_duration": value})
		if timing.DurationMs != 10000 || timing.OriginalDurationMs != 0 {
			t.Fatalf("invalid usage accepted: %+v", timing)
		}
		encoded, _ := json.Marshal(map[string]any{"seedAudioTiming": timing})
		if _, err := seedAudioBillingDuration(string(encoded)); err == nil {
			t.Fatal("missing original duration must not fall back to playback length")
		}
	}
	if seedAudioTimingFromUsage(providerConfig{InterfaceType: "minimax-speech"}, "audio", map[string]any{"original_duration": 10}) != nil {
		t.Fatal("other providers changed")
	}
	if seedAudioTimingFromUsage(config, "video", nil) != nil {
		t.Fatal("other capabilities changed")
	}
	if got := seedAudioSecondsToMs(82.8, 120); got != 82800 {
		t.Fatalf("seconds to ms: %d", got)
	}
	if got := seedAudioSecondsToMs(120, 120); got != 120000 {
		t.Fatalf("boundary: %d", got)
	}
	s := &Service{}
	input, _ := json.Marshal(canvasGenerationInput{Config: config})
	if _, err := s.AudioOutputDurationMs(model.Task{Type: "canvas_audio", InputJSON: string(input), ResultJSON: `{"audio":{"durationMs":10000}}`}); err == nil {
		t.Fatal("Seed Audio without billing metadata accepted")
	}
}

func TestSeedAudioTimingSurvivesSaveAndRecovery(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	s, db := newMediaRecoveryTestService(t)
	// This test exercises checkpoint encryption, not first-run key publication.
	// Pre-create an isolated fixture key to avoid Windows directory-sync restrictions.
	if err := os.WriteFile(filepath.Join(s.dataDir, ".settings-key"), make([]byte, 32), 0600); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write([]byte("audio-result"))
	}))
	defer server.Close()
	config := providerConfig{BaseURL: server.URL, InterfaceType: "doubao-streaming-tts"}
	input, _ := json.Marshal(canvasGenerationInput{Mode: "audio", Config: config})
	expires := time.Now().Add(time.Hour)
	task := &model.Task{ID: newID(), UserID: "media-user", Type: "canvas_audio", Status: model.TaskStatusRunning, InputJSON: string(input), LeaseOwner: "worker-a", LeaseExpiresAt: &expires, RouteRun: 1, CreatedAt: time.Now()}
	if err := db.Create(task).Error; err != nil {
		t.Fatal(err)
	}
	adapter, ok := loadOfficialFallbackRegistry().Resolve("doubao-streaming-tts")
	if !ok {
		t.Fatal("adapter missing")
	}
	payload, _ := json.Marshal(map[string]any{"url": server.URL + "/audio", "duration": 41.4, "original_duration": 82.8})
	parsed, err := adapter.ParseCreate(context.Background(), payload)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
	result, err := finishProtocolResult(ctx, config, "audio", "", parsed.Result, declarativeProtocolPollPolicy("audio"))
	if err != nil {
		t.Fatal(err)
	}
	check := func(result map[string]interface{}) {
		t.Helper()
		encoded, err := json.Marshal(result)
		if err != nil {
			t.Fatal(err)
		}
		task.ResultJSON = string(encoded)
		got, err := s.AudioOutputDurationMs(*task)
		if err != nil || got != 82800 {
			t.Fatalf("billing duration=%d err=%v", got, err)
		}
		resourceID, _ := taskOutputResource(task.ResultJSON, task.Type)
		resource, err := s.repo.ResourceForUser(task.UserID, resourceID)
		if err != nil || resource.DurationMs != 41400 {
			t.Fatalf("playback resource=%+v err=%v", resource, err)
		}
	}
	check(result)
	stored, err := s.repo.Task(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	checkpoint, err := s.decodeMediaCheckpoint(stored)
	if err != nil || checkpoint.SeedAudioTiming == nil {
		t.Fatalf("checkpoint=%+v err=%v", checkpoint, err)
	}
	// Re-enter the persisted checkpoint without another provider call.
	recovered, err := s.materializeTaskMedia(ctx, stored, config, checkpoint)
	if err != nil {
		t.Fatal(err)
	}
	check(recovered)
	// The existing settlement rule rounds original 82.8s to 83s, not playback 41.4s.
	order := model.BillingOrder{ID: newID(), UserID: "billing-user", IdempotencyKey: newID(), Capability: "audio", BillingMode: "per_second", UnitPriceMicrocredits: 160000, MultiplierBasisPoints: 10000, Quantity: 1, AmountMicrocredits: 160000, ReservedAmountMicrocredits: 160000, Status: model.BillingStatusRunning}
	if err := db.Create(&model.CreditAccount{UserID: "billing-user", AvailableMicrocredits: 20000000, ReservedMicrocredits: 160000}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatal(err)
	}
	duration, err := s.AudioOutputDurationMs(*task)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := s.repo.SettleBillingOrderWithAudioDuration(order.ID, "", duration); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.First(&order, "id = ?", order.ID).Error; err != nil {
		t.Fatal(err)
	}
	if order.ActualAmountMicrocredits != 13280000 || order.Quantity != 83 {
		t.Fatalf("incorrect settlement: %+v", order)
	}
	var account model.CreditAccount
	if err := db.First(&account, "user_id = ?", "billing-user").Error; err != nil {
		t.Fatal(err)
	}
	if account.AvailableMicrocredits != 6880000 || account.ReservedMicrocredits != 0 {
		t.Fatalf("duplicate charge or incorrect balance: %+v", account)
	}
}
