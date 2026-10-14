package repository

import (
	"fmt"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestPaymentRetryFairnessBeyondFirstBatch(t *testing.T) {
	db := openPaymentTestDB(t)
	repo := New(db)
	now := time.Now()
	for i := range 33 {
		id := fmt.Sprintf("retry-%02d", i)
		order := model.PaymentOrder{ID: id, UserID: "user", IdempotencyKey: id,
			MerchantOrderNo: id, ProviderID: "wechat-native", Status: model.PaymentOrderPending,
			ProviderStatus: "NOTPAY", CreatedAt: now.Add(time.Duration(i-100) * time.Minute),
			UpdatedAt: now.Add(time.Duration(i-100) * time.Minute), ExpiresAt: now.Add(-time.Hour)}
		if err := db.Create(&order).Error; err != nil {
			t.Fatal(err)
		}
	}
	first, err := repo.PaymentOrdersNeedingQuery(now, 32)
	if err != nil || len(first) != 32 {
		t.Fatalf("first = %d, %v", len(first), err)
	}
	for _, order := range first {
		if err := repo.RecordPaymentQueryAttempt(order.ID); err != nil {
			t.Fatal(err)
		}
	}
	// Even after cooldown expires, the never-queried 33rd order must go first.
	next, err := repo.PaymentOrdersNeedingQuery(time.Now().Add(time.Minute), 32)
	if err != nil || len(next) == 0 || next[0].ID != "retry-32" {
		t.Fatalf("next = %+v, %v", next, err)
	}
	var saved model.PaymentOrder
	if err := db.First(&saved, "id = ?", first[0].ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.LastQueriedAt == nil || saved.ProviderStatus != "NOTPAY" || saved.Status != model.PaymentOrderPending {
		t.Fatalf("attempt changed payment evidence: %+v", saved)
	}
	claimed, err := repo.ClaimExpiredPaymentOrders(4)
	if err != nil || len(claimed) != 4 {
		t.Fatalf("claimed = %d, %v", len(claimed), err)
	}
	for _, order := range claimed {
		if err := repo.RestoreClosingPaymentOrder(order.ID, "temporary failure"); err != nil {
			t.Fatal(err)
		}
	}
	nextClosed, err := repo.ClaimExpiredPaymentOrders(4)
	if err != nil || len(nextClosed) != 4 {
		t.Fatalf("next close = %d, %v", len(nextClosed), err)
	}
	for _, order := range nextClosed {
		for _, previous := range claimed {
			if order.ID == previous.ID {
				t.Fatal("failed close starved later orders")
			}
		}
	}
}
