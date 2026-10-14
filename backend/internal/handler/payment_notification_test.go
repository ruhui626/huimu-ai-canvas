package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/service"
)

func TestPaymentNotificationRejectsEmptyBodyBeforeService(t *testing.T) {
	router := gin.New()
	RegisterPaymentRoutes(router.Group("/api"), &service.Service{})
	for _, method := range []string{http.MethodGet, http.MethodPost} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(method, "/api/payments/notify/wechat-native/config", nil))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("%s status = %d", method, response.Code)
		}
	}
}

func TestPaymentNotificationBusyResponseIsFailure(t *testing.T) {
	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	writePaymentNotificationFailure(ctx, &service.Service{}, "wechat-native", http.StatusServiceUnavailable)
	ctx.Writer.WriteHeaderNow()
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("busy status = %d", response.Code)
	}
}
