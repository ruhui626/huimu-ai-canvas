package app

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/payment"
)

func TestPaymentQueryFailureRecordsAttempt(t *testing.T) {
	svc, _ := newPaymentLifecycleService(t, model.PaymentOrderPending)
	svc.paymentRegistry, _ = payment.NewRegistry()
	order, err := svc.repo.PaymentOrder("active-order")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.queryPaymentOrder(context.Background(), order); err == nil {
		t.Fatal("expected missing provider failure")
	}
	order, err = svc.repo.PaymentOrder("active-order")
	if err != nil {
		t.Fatal(err)
	}
	if order.LastQueriedAt == nil || order.Status != model.PaymentOrderPending {
		t.Fatalf("order = %+v", order)
	}
}

func TestPaymentOrderBatchBoundedAndCancelable(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	started := make(chan struct{}, 8)
	release := make(chan struct{})
	done := make(chan struct{})
	var calls atomic.Int32
	go func() {
		runPaymentOrderBatch(ctx, make([]model.PaymentOrder, 32), func(*model.PaymentOrder) {
			calls.Add(1)
			started <- struct{}{}
			<-release
		})
		close(done)
	}()
	for range 4 {
		select {
		case <-started:
		case <-time.After(5 * time.Second):
			t.Fatal("workers did not start")
		}
	}
	if calls.Load() != 4 {
		t.Fatalf("concurrency = %d", calls.Load())
	}
	cancel()
	close(release)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("workers did not stop")
	}
	// A canceled batch must not execute newly dispatched jobs.
	if calls.Load() != 4 {
		t.Fatalf("processed after cancellation: %d", calls.Load())
	}
}

func TestPaymentOrderBatchProcessesEveryOrderOnce(t *testing.T) {
	orders := make([]model.PaymentOrder, 33)
	for i := range orders {
		orders[i].ID = string(rune('a' + i))
	}
	counts := make(chan string, len(orders))
	runPaymentOrderBatch(context.Background(), orders, func(order *model.PaymentOrder) { counts <- order.ID })
	close(counts)
	seen := make(map[string]bool)
	for id := range counts {
		if seen[id] {
			t.Fatalf("duplicate %s", id)
		}
		seen[id] = true
	}
	if len(seen) != len(orders) {
		t.Fatalf("processed %d of %d", len(seen), len(orders))
	}
}
