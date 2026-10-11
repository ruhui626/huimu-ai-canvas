package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/protocol"
)

func TestMediaAdmissionFullStagingDoesNotGateWorkerGeneration(t *testing.T) {
	for _, mode := range []string{"image", "video", "audio"} {
		t.Run(mode, func(t *testing.T) {
			s, db := newMediaRecoveryTestService(t)
			task := seedMediaTask(t, db, providerConfig{})
			task.Type = "canvas_" + mode
			raw, _ := json.Marshal(canvasGenerationInput{Mode: mode})
			task.InputJSON = string(raw)
			if err := db.Save(task).Error; err != nil {
				t.Fatal(err)
			}
			file, err := s.newMediaTemp(mediaStagingBudget)
			if err != nil {
				t.Fatal(err)
			}
			defer file.Close()
			// Deliberately invalid provider: reaching route preparation proves the
			// worker passed staging admission without a real paid model call.
			_ = s.taskWorker().processClaimedTask(task, nil)
			saved, err := s.repo.Task(task.ID)
			if err != nil {
				t.Fatal(err)
			}
			if saved.NextPollAt != nil || strings.Contains(saved.Stage, "保存容量") || saved.Status != model.TaskStatusFailed {
				t.Fatalf("worker stopped at staging instead of provider validation: %+v", saved)
			}
		})
	}
}

func TestMediaAdmissionDoesNotExpireGeneratedInlineFiles(t *testing.T) {
	s := &Service{dataDir: t.TempDir()}
	name, err := s.stageInlineMedia([]byte("keep-result"))
	if err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(s.mediaTempPath(name), old, old); err != nil {
		t.Fatal(err)
	}
	r, err := s.newMediaTemp(1)
	if err != nil {
		t.Fatal(err)
	}
	_ = r.Close()
	if _, err := os.Stat(s.mediaTempPath(name)); err != nil {
		t.Fatal("only surviving result expired", err)
	}
}

func TestMediaAdmissionWithdrawnMarkersDoNotConsumeDeliveryBudget(t *testing.T) {
	s := &Service{dataDir: t.TempDir()}
	f, err := s.newMediaTemp(mediaStagingBudget)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(filepath.Dir(f.Name()), "result-reservation-task-old-marker")
	if err := os.Rename(f.Name(), marker); err != nil {
		t.Fatal(err)
	}
	next, err := s.newMediaTemp(1)
	if err != nil {
		t.Fatal("withdrawn reservation still blocks delivery", err)
	}
	_ = next.Close()
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("old file unexpectedly removed", err)
	}
}

func TestMediaAdmissionBusyDeliveryDoesNotExpireAfterTwentyMinutes(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	task := seedMediaTask(t, db, providerConfig{})
	cp := &mediaCheckpoint{Mode: "image", StartedAt: time.Now().Add(-time.Hour), Items: []mediaCheckpointItem{{Reference: protocol.MediaReference{URL: "https://example.com/result.png"}}}}
	if err := s.saveMediaCheckpoint(task, cp, "download"); err != nil {
		t.Fatal(err)
	}
	if err := s.handleMediaRecoveryFailure(task, &mediaRecoveryError{stage: "download", cause: errMediaRecoveryBusy}); err != nil {
		t.Fatal(err)
	}
	saved, err := s.repo.Task(task.ID)
	if err != nil || saved.Status != model.TaskStatusRunning || saved.NextPollAt == nil {
		t.Fatal("congestion expired completed generation", err)
	}
}

func TestMediaAdmissionLegacyAudioPreservesFormatAndBillingMetadata(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	task := seedMediaTask(t, db, providerConfig{})
	ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
	result, err := recoverBuiltInAVResult(ctx, providerConfig{}, "audio", map[string]interface{}{"audio": map[string]interface{}{"dataUrl": dataURL("audio/mpeg", []byte("ID3test")), "format": "mp3"}})
	if err != nil {
		t.Fatal(err)
	}
	item := result["audio"].(map[string]interface{})
	if item["format"] != "mp3" || item["durationMs"] != int64(0) || result["seedAudioTiming"] != nil {
		t.Fatalf("billing metadata changed: %+v", result)
	}
	saved, _ := s.repo.Task(task.ID)
	result, err = (&Service{repo: s.repo, dataDir: s.dataDir}).resumeTaskMedia(context.Background(), saved)
	if err != nil || result["audio"].(map[string]interface{})["format"] != "mp3" {
		t.Fatal("legacy metadata lost on restart", err)
	}
}

func TestMediaAdmissionDeliveryIsClaimedBeforeNewGeneration(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	queued := seedMediaTask(t, db, providerConfig{})
	queued.Status = model.TaskStatusQueued
	queued.CreatedAt = time.Now().Add(-time.Hour)
	if err := db.Save(queued).Error; err != nil {
		t.Fatal(err)
	}
	delivery := seedMediaTask(t, db, providerConfig{})
	delivery.LeaseExpiresAt = nil
	delivery.MediaRecoveryJSON = "saved-checkpoint"
	if err := db.Save(delivery).Error; err != nil {
		t.Fatal(err)
	}
	claimed, err := s.repo.ClaimNextTask("delivery-worker", time.Minute)
	if err != nil || claimed == nil || claimed.ID != delivery.ID {
		t.Fatalf("save not prioritized: %+v %v", claimed, err)
	}
}

func TestMediaAdmissionLegacyVideoDefersDownloadWithoutRegeneration(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	var submits, downloads atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + r.URL.Path {
		case "POST /v1/videos":
			submits.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"v1"}`))
		case "GET /v1/videos/v1":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"completed"}`))
		case "GET /v1/videos/v1/content":
			downloads.Add(1)
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write([]byte("video"))
		default:
			t.Errorf("unexpected request %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	s, db := newMediaRecoveryTestService(t)
	config := providerConfig{BaseURL: server.URL + "/v1", Model: "test-video"}
	task := seedMediaTask(t, db, config)
	ctx := context.WithValue(context.Background(), mediaExecutionTaskKey{}, *task)
	result, err := runVideoTaskForTest(ctx, canvasGenerationInput{Mode: "video", Prompt: "test", Config: config})
	if err != nil {
		t.Fatal(err)
	}
	if submits.Load() != 1 || downloads.Load() != 0 {
		t.Fatal("legacy video downloaded before checkpoint")
	}
	for i := 0; i < cap(mediaRecoverySlots); i++ {
		mediaRecoverySlots <- struct{}{}
	}
	unlock := func() {
		for len(mediaRecoverySlots) > 0 {
			<-mediaRecoverySlots
		}
	}
	defer unlock()
	ctx = context.WithValue(withProviderAnalytics(ctx, s, *task), mediaExecutionTaskKey{}, *task)
	_, err = recoverBuiltInAVResult(ctx, config, "video", result)
	if !errors.Is(err, errMediaRecoveryBusy) {
		t.Fatal("did not defer download", err)
	}
	unlock()
	saved, _ := s.repo.Task(task.ID)
	result, err = (&Service{repo: s.repo, dataDir: s.dataDir}).resumeTaskMedia(context.Background(), saved)
	if err != nil || result["mode"] != "video" || submits.Load() != 1 || downloads.Load() != 1 {
		t.Fatalf("recovery repeated generation: %v %d %d", err, submits.Load(), downloads.Load())
	}
}
