package app

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
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

func TestMediaDeliveryStagingCapacityDefersAllMediaWithoutRegeneration(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	for _, mode := range []string{"image", "video", "audio"} {
		t.Run(mode, func(t *testing.T) {
			s, db := newMediaRecoveryTestService(t)
			payload, mime := []byte("test-media"), mode+"/mp4"
			if mode == "image" {
				payload, mime = mediaTestPNG(t), "image/png"
			}
			if mode == "audio" {
				mime = "audio/mpeg"
			}
			var downloads atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet {
					t.Errorf("unexpected generation request: %s", r.Method)
				}
				downloads.Add(1)
				w.Header().Set("Content-Type", mime)
				_, _ = w.Write(payload)
			}))
			defer server.Close()
			config := providerConfig{BaseURL: server.URL}
			task := seedMediaTask(t, db, config)
			task.Type = "canvas_" + mode
			input, _ := json.Marshal(canvasGenerationInput{Mode: mode, Config: config})
			task.InputJSON = string(input)
			if err := db.Save(task).Error; err != nil {
				t.Fatal(err)
			}
			reservation, err := s.newMediaTemp(mediaStagingBudget)
			if err != nil {
				t.Fatal(err)
			}
			if err := reservation.Close(); err != nil {
				t.Fatal(err)
			}
			ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
			_, handled, failure := recoverProtocolMedia(ctx, config, mode, []protocol.MediaReference{{URL: server.URL + "/result"}}, nil)
			if !handled || !errors.Is(failure, errMediaStagingBusy) {
				t.Fatalf("handled=%v error=%v", handled, failure)
			}
			if err := s.handleMediaRecoveryFailure(task, failure); err != nil {
				t.Fatal(err)
			}
			saved, _ := s.repo.Task(task.ID)
			if saved.Status != model.TaskStatusRunning || saved.Stage != "作品已生成，等待保存" || saved.NextPollAt == nil || saved.LeaseOwner != "" {
				t.Fatalf("capacity must defer delivery: %+v", saved)
			}
			checkpoint, err := s.decodeMediaCheckpoint(saved)
			if err != nil || checkpoint.Attempts != 0 {
				t.Fatalf("busy consumed network retry budget: %v %+v", err, checkpoint)
			}
			if err := os.Remove(reservation.Name()); err != nil {
				t.Fatal(err)
			}
			if err := db.Model(task).Update("next_poll_at", time.Now().Add(-time.Second)).Error; err != nil {
				t.Fatal(err)
			}
			claimed, err := s.repo.ClaimNextTask("recovery-worker", time.Minute)
			if err != nil || claimed == nil {
				t.Fatalf("claim: %v", err)
			}
			if err := s.taskWorker().processClaimedTask(claimed, nil); err != nil {
				t.Fatal(err)
			}
			completed, _ := s.repo.Task(task.ID)
			if completed.Status != model.TaskStatusSucceeded || downloads.Load() != 2 {
				t.Fatalf("not recovered: %s, downloads=%d", completed.Status, downloads.Load())
			}
			var count int64
			db.Model(&model.BillingOrder{}).Count(&count)
			if count != 0 {
				t.Fatal("delivery created a billing order")
			}
		})
	}
}

func TestMediaDeliveryInlineSurvivesBusySaveSlotsAndRestart(t *testing.T) {
	for _, mode := range []string{"image", "video", "audio"} {
		t.Run(mode, func(t *testing.T) {
			s, db := newMediaRecoveryTestService(t)
			task := seedMediaTask(t, db, providerConfig{})
			task.Type = "canvas_" + mode
			input, _ := json.Marshal(canvasGenerationInput{Mode: mode})
			task.InputJSON = string(input)
			if err := db.Save(task).Error; err != nil {
				t.Fatal(err)
			}
			payload, mime := []byte("test-media"), mode+"/mp4"
			if mode == "image" {
				payload, mime = mediaTestPNG(t), "image/png"
			}
			if mode == "audio" {
				mime = "audio/mpeg"
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
			ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
			_, handled, failure := recoverProtocolMedia(ctx, providerConfig{}, mode, []protocol.MediaReference{{DataURL: dataURL(mime, payload)}}, nil)
			if !handled || !errors.Is(failure, errMediaRecoveryBusy) {
				t.Fatalf("handled=%v error=%v", handled, failure)
			}
			task, err := s.repo.Task(task.ID)
			if err != nil {
				t.Fatal(err)
			}
			checkpoint, err := s.decodeMediaCheckpoint(task)
			if err != nil {
				t.Fatal(err)
			}
			actual, err := os.ReadFile(s.mediaTempPath(checkpoint.Items[0].TempName))
			if err != nil || !bytes.Equal(actual, payload) {
				t.Fatal("inline result not durably staged", err)
			}
			if checkpoint.Items[0].Reference.DataURL != "" {
				t.Fatal("base64 stored in checkpoint")
			}
			unlock()
			restarted := &Service{repo: s.repo, dataDir: s.dataDir}
			result, err := restarted.resumeTaskMedia(context.Background(), task)
			if err != nil || result["mode"] != mode {
				t.Fatalf("restart delivery: %v %+v", err, result)
			}
		})
	}
}

func TestMediaDeliveryInlineStreamValidationAndCleanup(t *testing.T) {
	s := &Service{dataDir: t.TempDir()}
	for _, value := range []string{"data:image/png;base64,", "data:image/png;base64,!!!!", "data:video/mp4;base64,YQ==", "data:image/png;base64,YWJjZA=="} {
		if _, _, err := s.stageInlineMediaURL(value, "image", 3); err == nil {
			t.Fatalf("accepted invalid/oversize input: %s", value)
		}
	}
	value := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("abc")) + "\r\n"
	name, _, err := s.stageInlineMediaURL(value, "image", 3)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := os.ReadFile(s.mediaTempPath(name))
	if string(actual) != "abc" {
		t.Fatal("stream changed bytes")
	}
	files, err := os.ReadDir(filepath.Join(s.dataDir, "media-staging"))
	if err != nil || len(files) != 1 {
		t.Fatalf("invalid files leaked: %v %v", files, err)
	}
}

func TestMediaDeliveryBuiltInImageUsesRecoverableSave(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	task := seedMediaTask(t, db, providerConfig{})
	ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
	result, err := recoverBuiltInImageResult(ctx, providerConfig{}, map[string]interface{}{"mode": "image", "images": []map[string]string{{"dataUrl": dataURL("image/png", mediaTestPNG(t))}}})
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(result)
	if strings.Contains(string(encoded), "base64") || !strings.Contains(string(encoded), "resourceId") {
		t.Fatalf("result not persisted: %s", encoded)
	}
	saved, _ := s.repo.Task(task.ID)
	if saved.MediaRecoveryJSON == "" {
		t.Fatal("built-in image missing checkpoint")
	}
}

func TestMediaDeliveryFullStagingOnlyDefersRecoverableResults(t *testing.T) {
	for _, withURL := range []bool{false, true} {
		t.Run(fmt.Sprint(withURL), func(t *testing.T) {
			s, db := newMediaRecoveryTestService(t)
			task := seedMediaTask(t, db, providerConfig{})
			reservation, err := s.newMediaTemp(mediaStagingBudget)
			if err != nil {
				t.Fatal(err)
			}
			_ = reservation.Close()
			ref := protocol.MediaReference{DataURL: dataURL("image/png", mediaTestPNG(t))}
			if withURL {
				ref.URL = "https://example.com/result.png"
			}
			for i := 0; i < cap(mediaRecoverySlots); i++ {
				mediaRecoverySlots <- struct{}{}
			}
			defer func() {
				for len(mediaRecoverySlots) > 0 {
					<-mediaRecoverySlots
				}
			}()
			ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
			_, handled, failure := recoverProtocolMedia(ctx, providerConfig{}, "image", []protocol.MediaReference{ref}, nil)
			if !handled || failure == nil {
				t.Fatal("expected controlled delivery failure")
			}
			saved, _ := s.repo.Task(task.ID)
			if !withURL {
				if !errors.Is(failure, errMediaStagingBusy) || saved.MediaRecoveryJSON != "" {
					t.Fatal("inline-only result must not claim durable recovery", failure)
				}
				return
			}
			checkpoint, err := s.decodeMediaCheckpoint(saved)
			if err != nil || checkpoint.Items[0].Reference.URL != ref.URL || checkpoint.Items[0].Reference.DataURL != "" {
				t.Fatal("URL fallback checkpoint missing", err)
			}
		})
	}
}
