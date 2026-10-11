package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

func rebindFixture(t *testing.T, handler http.HandlerFunc) (*Service, *gorm.DB, OSSRebindOptions) {
	t.Helper()
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".settings-key"), make([]byte, 32), 0600); err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { sqlDB.Close() })
	if err := db.AutoMigrate(&model.Resource{}, &model.StorageLocation{}, &model.UserOSSSetting{}, &model.SystemSetting{}, &model.ResourceDeletionJob{}); err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db), dataDir: dir}
	value := ossSettingValue{Enabled: true, Provider: "aliyun", Endpoint: server.URL, Bucket: "new", AccessKeyID: "test", AccessKeySecret: "test"}
	digest := storageLocationDigest(value)
	encrypted, err := svc.encryptOSSSettingSecrets(value)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(encrypted)
	location := model.StorageLocation{ID: "target", Scope: "platform", Provider: "aliyun", LocationDigest: digest, ValueJSON: string(encoded)}
	setting := model.SystemSetting{Key: ossSettingKey, ValueJSON: string(encoded)}
	for _, item := range []any{&location, &setting} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range []string{"a", "b"} {
		r := model.Resource{ID: id, UserID: "user", Provider: "aliyun", Endpoint: server.URL, Bucket: "old", ObjectKey: id + ".mp4", Size: 12, Status: model.ResourceStatusReady, UpdatedAt: time.Now().UTC()}
		if err := db.Create(&r).Error; err != nil {
			t.Fatal(err)
		}
	}
	return svc, db, OSSRebindOptions{Endpoint: server.URL, FromBucket: "old", ToBucket: "new"}
}

func TestOSSRebindPreviewApply(t *testing.T) {
	svc, db, opts := rebindFixture(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "HEAD" {
			t.Error("only HEAD allowed")
		}
		w.Header().Set("Content-Length", "12")
		w.WriteHeader(200)
	})
	ctx := context.Background()
	report, err := svc.RebindCopiedOSS(ctx, opts)
	if err != nil {
		t.Fatal(err)
	}
	if report.Applied || report.Checked != 2 {
		t.Fatalf("preview: %+v", report)
	}
	var count int64
	db.Model(&model.Resource{}).Where("bucket = ?", "old").Count(&count)
	if count != 2 {
		t.Fatal("preview wrote resources")
	}
	opts.Apply = true
	if _, err := svc.RebindCopiedOSS(ctx, opts); err == nil {
		t.Fatal("missing backup/maintenance accepted")
	}
	opts.BackupConfirmed = true
	opts.MaintenanceConfirmed = true
	report, err = svc.RebindCopiedOSS(ctx, opts)
	if err != nil {
		t.Fatal(err)
	}
	if !report.Applied || report.Checked != 2 {
		t.Fatal("not applied")
	}
	resource, _ := svc.repo.Resource("a")
	if resource.Bucket != "new" || resource.StorageSettingID != "target" || resource.ObjectKey != "a.mp4" || resource.UserID != "user" {
		t.Fatalf("bad binding: %+v", resource)
	}
	setting, err := svc.ossSettingForResource("user", resource)
	if err != nil || setting.Bucket != "new" {
		t.Fatalf("resolution: %v", err)
	}
	report, err = svc.RebindCopiedOSS(ctx, opts)
	if err != nil || report.Resources != 0 || report.Applied {
		t.Fatalf("repeat: %+v %v", report, err)
	}
}

func TestOSSRebindAdminGuards(t *testing.T) {
	svc := &Service{}
	for _, actor := range []*model.User{nil, {ID: "user", Role: "user"}} {
		if _, err := svc.AdminRebindCopiedOSS(context.Background(), actor, OSSRebindRequest{}, false); err == nil {
			t.Fatal("non-admin accepted")
		}
	}
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	if _, err := svc.AdminRebindCopiedOSS(context.Background(), admin, OSSRebindRequest{}, true); err == nil {
		t.Fatal("missing check token accepted")
	}
	ossRebindMu.Lock()
	defer ossRebindMu.Unlock()
	if _, err := svc.AdminRebindCopiedOSS(context.Background(), admin, OSSRebindRequest{}, false); err == nil {
		t.Fatal("concurrent request accepted")
	}
}

func TestOSSRebindAdminCheckAndApply(t *testing.T) {
	svc, db, _ := rebindFixture(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "12")
		w.WriteHeader(200)
	})
	actor := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	req := OSSRebindRequest{FromBucket: "old"}
	report, err := svc.AdminRebindCopiedOSS(context.Background(), actor, req, false)
	if err != nil || report.ToBucket != "new" || report.CheckToken == "" || report.Applied {
		t.Fatalf("check: %+v %v", report, err)
	}
	req.CheckToken = report.CheckToken
	if _, err := svc.AdminRebindCopiedOSS(context.Background(), actor, req, true); err == nil {
		t.Fatal("missing confirmations accepted")
	}
	req.BackupConfirmed, req.MaintenanceConfirmed = true, true
	if err := db.Model(&model.Resource{}).Where("id = ?", "a").Update("public_url", "changed").Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AdminRebindCopiedOSS(context.Background(), actor, req, true); err == nil {
		t.Fatal("stale check accepted")
	}
	report, err = svc.AdminRebindCopiedOSS(context.Background(), actor, req, false)
	if err != nil {
		t.Fatal(err)
	}
	req.CheckToken = report.CheckToken
	report, err = svc.AdminRebindCopiedOSS(context.Background(), actor, req, true)
	if err != nil || !report.Applied || report.Checked != 2 {
		t.Fatalf("apply: %+v %v", report, err)
	}
}

func TestOSSRebindRejectsWholeBatch(t *testing.T) {
	for _, kind := range []string{"missing", "size", "personal", "null-personal", "pending", "derived", "deletion", "duplicate", "config-changed", "write-error"} {
		t.Run(kind, func(t *testing.T) {
			var dbRef *gorm.DB
			svc, db, opts := rebindFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/b.mp4" {
					if kind == "missing" {
						w.WriteHeader(404)
						return
					}
					if kind == "size" {
						w.Header().Set("Content-Length", "13")
						w.WriteHeader(200)
						return
					}
					if kind == "config-changed" {
						dbRef.Model(&model.SystemSetting{}).Where("key = ?", ossSettingKey).Update("value_json", "{}")
					}
				}
				w.Header().Set("Content-Length", "12")
				w.WriteHeader(200)
			})
			dbRef = db
			switch kind {
			case "personal", "null-personal":
				db.Create(&model.UserOSSSetting{ID: "personal", UserID: "user"})
				if kind == "null-personal" {
					db.Model(&model.Resource{}).Where("id = ?", "a").Update("storage_setting_id", nil)
				}
			case "pending":
				db.Model(&model.Resource{}).Where("id = ?", "b").Update("status", "pending")
			case "derived":
				db.Model(&model.Resource{}).Where("id = ?", "b").Update("thumbnail_status", "ready")
			case "deletion":
				db.Create(&model.ResourceDeletionJob{ID: "job", Provider: "aliyun", Endpoint: opts.Endpoint, Bucket: "old", ObjectKey: "a.mp4"})
			case "duplicate":
				db.Create(&model.Resource{ID: "duplicate", Provider: "aliyun", Endpoint: opts.Endpoint, Bucket: "new", ObjectKey: "a.mp4"})
			case "write-error":
				// Force the second write to fail, proving the first update rolls back.
				if err := db.Exec("CREATE TRIGGER reject_second BEFORE UPDATE ON resources WHEN OLD.id = 'b' BEGIN SELECT RAISE(ABORT, 'test failure'); END;").Error; err != nil {
					t.Fatal(err)
				}
			}
			opts.Apply = true
			opts.BackupConfirmed = true
			opts.MaintenanceConfirmed = true
			if _, err := svc.RebindCopiedOSS(context.Background(), opts); err == nil {
				t.Fatal("unsafe batch accepted")
			}
			var count int64
			db.Model(&model.Resource{}).Where("id IN ? AND bucket = ?", []string{"a", "b"}, "old").Count(&count)
			if count != 2 {
				t.Fatal("partial migration persisted")
			}
		})
	}
}
