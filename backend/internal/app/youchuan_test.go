package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/platform"
	"yingce/backend/internal/protocol"
)

func TestYouchuanJobSavesFourImagesAndResumesWithoutRebilling(t *testing.T) {
	testYouchuanJobRecovery(t, "youchuan-image")
}

func TestRunningHubYouchuanJobSavesFourImagesAndResumesWithoutRebilling(t *testing.T) {
	testYouchuanJobRecovery(t, "runninghub-youchuan-image")
}

func testYouchuanJobRecovery(t *testing.T, protocolID string) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	s, db := newMediaRecoveryTestService(t)
	s.coordinator = platform.NewCoordinatorWithRedis(nil, "youchuan-test")
	png := mediaTestPNG(t)
	var creates, polls, downloads atomic.Int32
	var failLast atomic.Bool
	failLast.Store(true)
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if protocolID == "runninghub-youchuan-image" {
			wantAuth := "Bearer institution"
			if strings.HasPrefix(r.URL.Path, "/image/") {
				wantAuth = ""
			}
			if r.Header.Get("Authorization") != wantAuth || r.Header.Get("x-youchuan-secret") != "" || r.Header.Get("x-youchuan-app") != "" {
				t.Errorf("wrong RunningHub auth for %s", r.URL.Path)
			}
		} else if r.Header.Get("x-youchuan-app") != "institution" || r.Header.Get("x-youchuan-secret") != "test-secret" || r.Header.Get("Authorization") != "" {
			t.Errorf("wrong auth for %s", r.URL.Path)
		}
		switch r.URL.Path {
		case "/v1/tob/diffusion", "/openapi/v2/youchuan/text-to-image-v8.2-fast":
			creates.Add(1)
			if r.Method != http.MethodPost {
				t.Error("create must POST")
			}
			if protocolID == "runninghub-youchuan-image" {
				var body map[string]any
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["prompt"] != "a cat" || body["quality"] != "1" || body["hd"] != false {
					t.Errorf("bad body: %+v %v", body, err)
				}
				fmt.Fprint(w, `{"taskId":"job-42","status":"RUNNING","results":null}`)
			} else {
				fmt.Fprint(w, `{"id":"job-42","status":1,"urls":[]}`)
			}
		case "/v1/tob/job/job-42", "/openapi/v2/query":
			polls.Add(1)
			urls := []string{}
			for i := 0; i < 4; i++ {
				urls = append(urls, fmt.Sprintf("%s/image/%d", server.URL, i))
			}
			if protocolID == "runninghub-youchuan-image" {
				var body map[string]any
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil || r.Method != http.MethodPost || body["taskId"] != "job-42" {
					t.Errorf("bad poll: %+v %v", body, err)
				}
				results := []map[string]any{}
				for _, url := range urls {
					results = append(results, map[string]any{"url": url, "outputType": "png"})
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"taskId": "job-42", "status": "SUCCESS", "results": results, "usage": map[string]any{"thirdPartyConsumeMoney": "9.99"}})
			} else {
				_ = json.NewEncoder(w).Encode(map[string]any{"id": "job-42", "status": 2, "urls": urls, "cost": map[string]any{"feeCost": 50}})
			}
		default:
			if !strings.HasPrefix(r.URL.Path, "/image/") {
				t.Errorf("unexpected request path %s", r.URL.Path)
				http.NotFound(w, r)
				return
			}
			downloads.Add(1)
			if r.URL.Path == "/image/3" && failLast.Swap(false) {
				w.WriteHeader(503)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(png)
		}
	}))
	defer server.Close()
	config := providerConfig{InterfaceType: protocolID, BaseURL: server.URL, APIKey: "institution", SecretKey: "test-secret", Model: "v8.2", Count: "1", Size: "1:1"}
	task := seedMediaTask(t, db, config)
	order := model.BillingOrder{ID: newID(), UserID: task.UserID, TaskID: task.ID, IdempotencyKey: newID(), Capability: "image", BillingMode: "fixed_request", UnitPriceMicrocredits: 600000, MultiplierBasisPoints: 10000, Quantity: 1, AmountMicrocredits: 600000, ReservedAmountMicrocredits: 600000, Status: model.BillingStatusRunning}
	if err := db.Create(&model.CreditAccount{UserID: task.UserID, AvailableMicrocredits: 9400000, ReservedMicrocredits: 600000}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatal(err)
	}
	task.BillingOrderID = order.ID
	if err := db.Model(task).Update("billing_order_id", order.ID).Error; err != nil {
		t.Fatal(err)
	}
	adapter, ok := loadOfficialFallbackRegistry().Resolve(protocolID)
	if !ok {
		t.Fatal("missing plugin")
	}
	ctx := context.WithValue(withProviderAnalytics(context.Background(), s, *task), mediaExecutionTaskKey{}, *task)
	_, err := runProtocolAdapterTaskWithPolicy(ctx, canvasGenerationInput{Mode: "image", Config: config, Prompt: "a cat"}, adapter, videoPollPolicy{Sleep: func(context.Context, time.Duration) error { return nil }})
	if err == nil {
		t.Fatal("expected last image save failure")
	}
	if err := s.handleMediaRecoveryFailure(task, err); err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("UPDATE tasks SET next_poll_at = ? WHERE id = ?", time.Now().Add(-time.Second), task.ID).Error; err != nil {
		t.Fatal(err)
	}
	restarted := &Service{repo: s.repo, dataDir: s.dataDir, activeCancels: make(map[string]context.CancelFunc)}
	claimed, err := restarted.repo.ClaimNextTask("worker-b", time.Minute)
	if err != nil || claimed == nil {
		t.Fatalf("claim: %v", err)
	}
	if err := restarted.taskWorker().processClaimedTask(claimed, nil); err != nil {
		t.Fatal(err)
	}
	completed, err := s.repo.Task(task.ID)
	if err != nil || completed.Status != model.TaskStatusSucceeded {
		t.Fatalf("completion=%+v %v", completed, err)
	}
	var result struct {
		Images []map[string]any `json:"images"`
	}
	if err := json.Unmarshal([]byte(completed.ResultJSON), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Images) != 4 || creates.Load() != 1 || polls.Load() != 1 || downloads.Load() != 5 {
		t.Fatalf("images=%d create=%d poll=%d downloads=%d", len(result.Images), creates.Load(), polls.Load(), downloads.Load())
	}
	for i, item := range result.Images {
		if protocolID != "youchuan-image" {
			if _, ok := item["youchuan"]; ok {
				t.Fatal("RunningHub result incorrectly identified as direct Youchuan")
			}
			continue
		}
		source := item["youchuan"].(map[string]any)
		if source["imageNo"] != float64(i) || source["taskId"] != "job-42" {
			t.Fatalf("source=%+v", source)
		}
	}
	if err := restarted.registerRecoveredMediaAssets(*completed); err != nil {
		t.Fatal(err)
	}
	var assets []model.Asset
	if err := db.Find(&assets, "user_id = ?", task.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if len(assets) != 4 {
		t.Fatalf("assets=%d", len(assets))
	}
	for _, asset := range assets {
		if protocolID == "youchuan-image" && !strings.Contains(asset.PayloadJSON, `"youchuan"`) {
			t.Fatal("missing asset source")
		}
	}
	autoSettled, err := s.repo.BillingOrder(order.ID)
	if err != nil || autoSettled.Status != model.BillingStatusSettled {
		t.Fatalf("worker did not settle recovered result: %+v %v", autoSettled, err)
	}
	for i := 0; i < 2; i++ {
		if err := s.SettleBilling(order.ID, "job-42"); err != nil {
			t.Fatal(err)
		}
	}
	settled, err := s.repo.BillingOrder(order.ID)
	if err != nil || settled.Status != model.BillingStatusSettled || settled.ActualAmountMicrocredits != 600000 || settled.Quantity != 1 {
		t.Fatalf("settlement=%+v %v", settled, err)
	}
	var account model.CreditAccount
	if err := db.First(&account, "user_id = ?", task.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if account.AvailableMicrocredits != 9400000 || account.ReservedMicrocredits != 0 {
		t.Fatalf("account=%+v", account)
	}
}

func TestYouchuanAuthAndDownloadRedirectIsolation(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-youchuan-secret") != "" || r.Header.Get("x-youchuan-app") != "" {
			t.Error("credentials leaked across redirect")
		}
		_, _ = w.Write([]byte("image"))
	}))
	defer destination.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-youchuan-secret") != "secret" {
			t.Error("missing source auth")
		}
		http.Redirect(w, r, destination.URL+"/image", http.StatusFound)
	}))
	defer source.Close()
	config := providerConfig{InterfaceType: "youchuan-image", BaseURL: source.URL, APIKey: "app", SecretKey: "secret"}
	if _, _, err := getProviderExternalBinary(context.Background(), config, source.URL+"/image"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := getProviderExternalBinary(context.Background(), config, destination.URL+"/image"); err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest(http.MethodGet, source.URL, nil)
	if err := applyProtocolAuth(req, providerConfig{APIKey: "app"}, protocol.ManifestAuth{Type: "youchuan", Field: "apiKey", SecretField: "secretKey"}); err == nil {
		t.Fatal("accepted missing secret")
	}
	legacy, _ := http.NewRequest(http.MethodGet, source.URL, nil)
	if err := applyMediaDownloadAuth(legacy, providerConfig{BaseURL: source.URL, APIKey: "legacy"}); err != nil || legacy.Header.Get("Authorization") != "Bearer legacy" {
		t.Fatal("changed existing auth", err)
	}
}
