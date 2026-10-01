package auth

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/model"

	"gorm.io/gorm"
)

type registrationVerificationHost struct{ nopHost }

func (registrationVerificationHost) SettingsEncryptionKey() ([]byte, error) {
	return []byte("registration-test-encryption-key"), nil
}

func TestRegistrationModeDefaultsToEmailCodeAndRejectsUnknownValues(t *testing.T) {
	svc, db := newRegistrationTestService(t)
	admin := &model.User{ID: "admin", Username: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}

	setting, err := svc.AdminRegistrationSetting(admin)
	if err != nil {
		t.Fatal(err)
	}
	if setting.Mode != RegistrationModeEmailCode {
		t.Fatalf("default registration mode = %q", setting.Mode)
	}

	if err := db.Create(&model.SystemSetting{Key: registrationSettingKey, ValueJSON: `{"enabled":true}`}).Error; err != nil {
		t.Fatal(err)
	}
	mode, err := svc.RegistrationMode()
	if err != nil || mode != RegistrationModeEmailCode {
		t.Fatalf("legacy registration mode = %q, err=%v", mode, err)
	}

	invalid := "open"
	if _, err := svc.UpdateRegistrationSetting(admin, RegistrationSettingRequest{Enabled: true, Mode: &invalid}); err == nil || !strings.Contains(err.Error(), "注册方式无效") {
		t.Fatalf("invalid registration mode error = %v", err)
	}
}

func TestEmailOnlyRegistrationRequiresUniqueValidEmailAndLeavesItUnverified(t *testing.T) {
	svc, db := newRegistrationTestService(t)
	if err := db.Create(&model.User{ID: "admin", Username: "admin", Email: "admin@example.com", Role: model.UserRoleAdmin, Status: model.UserStatusActive}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.SystemSetting{Key: registrationSettingKey, ValueJSON: `{"enabled":true,"mode":"email_only"}`}).Error; err != nil {
		t.Fatal(err)
	}

	for _, req := range []RegisterRequest{
		{Username: "missing-email", Password: "password", AcceptedTerms: true},
		{Username: "invalid-email", Email: "not-an-email", Password: "password", AcceptedTerms: true},
	} {
		if _, err := svc.Register(req); err == nil {
			t.Fatalf("Register(%q) accepted invalid email %q", req.Username, req.Email)
		}
	}

	result, err := svc.Register(RegisterRequest{Username: "member", Email: "member@example.com", Password: "password", AcceptedTerms: true})
	if err != nil {
		t.Fatal(err)
	}
	if result.User.Email != "member@example.com" || result.User.DisplayName != "member" || result.User.EmailVerifiedAt != nil {
		t.Fatalf("email-only user = %#v", result.User)
	}
	stored, err := svc.repo.UserByEmail("member@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if stored.EmailVerifiedAt != nil {
		t.Fatalf("email-only registration marked email verified at %v", stored.EmailVerifiedAt)
	}

	if _, err := svc.Register(RegisterRequest{Username: "duplicate", Email: "member@example.com", Password: "password", AcceptedTerms: true}); err == nil || !strings.Contains(err.Error(), "邮箱已被注册") {
		t.Fatalf("duplicate email error = %v", err)
	}
}

func TestRegistrationModeControlsCodeIssuanceAndPublicSettings(t *testing.T) {
	svc, db := newRegistrationTestService(t)
	if err := db.Create(&model.User{ID: "admin", Username: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.SystemSetting{Key: registrationSettingKey, ValueJSON: `{"enabled":true,"mode":"email_only"}`}).Error; err != nil {
		t.Fatal(err)
	}

	settings, err := svc.PublicAuthSettings()
	if err != nil {
		t.Fatal(err)
	}
	if settings.EmailCodeRequired || settings.EmailRegistration || settings.SMSRegistration || settings.SMSAndEmailRegistration {
		t.Fatalf("email-only public settings = %#v", settings)
	}
	if err := svc.SendRegistrationEmailCode("member@example.com"); err == nil || !strings.Contains(err.Error(), "不需要邮箱验证码") {
		t.Fatalf("email-only code issuance error = %v", err)
	}
	if _, err := svc.Register(RegisterRequest{Username: "stale-code", Email: "stale@example.com", EmailCode: "123456", Password: "password", AcceptedTerms: true}); err == nil || !strings.Contains(err.Error(), "注册方式已更新") {
		t.Fatalf("email-only stale verification error = %v", err)
	}

	codeMode := RegistrationModeEmailCode
	admin := &model.User{ID: "admin", Username: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}
	if _, err := svc.UpdateRegistrationSetting(admin, RegistrationSettingRequest{Enabled: true, Mode: &codeMode}); err != nil {
		t.Fatal(err)
	}
	settings, err = svc.PublicAuthSettings()
	if err != nil {
		t.Fatal(err)
	}
	if !settings.EmailCodeRequired {
		t.Fatalf("email-code public settings = %#v", settings)
	}
	if _, err := svc.Register(RegisterRequest{Username: "missing-code", Email: "missing@example.com", Password: "password", AcceptedTerms: true}); err == nil {
		t.Fatal("email-code registration accepted a missing code")
	}
}

func TestEmailCodeRegistrationAcceptsGenericVerificationTicket(t *testing.T) {
	svc, db := newRegistrationTestService(t)
	if err := db.AutoMigrate(&model.AuthVerification{}, &model.NotificationQuota{}); err != nil {
		t.Fatal(err)
	}
	svc.host = registrationVerificationHost{}
	if err := db.Create(&model.User{ID: "admin", Username: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.SystemSetting{Key: registrationSettingKey, ValueJSON: `{"enabled":true,"mode":"email_code"}`}).Error; err != nil {
		t.Fatal(err)
	}

	var code string
	svc.SetMailSender(func(_ EmailSettingValue, _, _, body string) error {
		code = regexp.MustCompile(`\b\d{6}\b`).FindString(body)
		return nil
	})
	ticket, err := svc.StartVerification(context.Background(), nil, VerificationRequest{Purpose: "register", Method: "email", Email: "member@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if ticket.Ticket == "" || code == "" {
		t.Fatalf("verification delivery = ticket %q, code %q", ticket.Ticket, code)
	}

	result, err := svc.Register(RegisterRequest{Username: "member", Email: "member@example.com", Ticket: ticket.Ticket, EmailCode: code, Password: "password", AcceptedTerms: true})
	if err != nil {
		t.Fatal(err)
	}
	if result.User.EmailVerifiedAt == nil || result.User.DisplayName != "member" {
		t.Fatalf("ticket registration user = %#v", result.User)
	}
}

func TestRegistrationClosurePrecedesBothEmailModes(t *testing.T) {
	for _, mode := range []string{RegistrationModeEmailCode, RegistrationModeEmailOnly} {
		t.Run(mode, func(t *testing.T) {
			svc, db := newRegistrationTestService(t)
			if err := db.Create(&model.User{ID: "admin", Username: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&model.SystemSetting{Key: registrationSettingKey, ValueJSON: `{"enabled":false,"mode":"` + mode + `"}`}).Error; err != nil {
				t.Fatal(err)
			}
			_, err := svc.Register(RegisterRequest{Username: "member", Email: "member@example.com", Password: "password", AcceptedTerms: true})
			var authErr *AuthError
			if !errors.As(err, &authErr) || authErr.Status != 403 || authErr.Message != "管理员未开放新用户注册" {
				t.Fatalf("Register() error = %v", err)
			}
			if _, err := svc.repo.UserByUsername("member"); !errors.Is(err, gorm.ErrRecordNotFound) {
				t.Fatalf("closed registration wrote user: %v", err)
			}
		})
	}
}
