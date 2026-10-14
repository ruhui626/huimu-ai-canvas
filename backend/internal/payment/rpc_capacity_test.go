package payment

import (
	"context"
	"errors"
	"testing"
)

func TestRPCProviderNotificationCapacityIsolatedAndReleased(t *testing.T) {
	for range cap(notificationRPCSlots) {
		notificationRPCSlots <- struct{}{}
	}
	defer func() {
		for len(notificationRPCSlots) > 0 {
			<-notificationRPCSlots
		}
	}()
	p := &RPCProvider{}
	_, err := p.VerifyNotification(context.Background(), nil, nil, []byte("invalid"))
	if !errors.Is(err, ErrNotificationBusy) {
		t.Fatalf("busy error = %v", err)
	}
	// Ordinary operations must still reach executable validation, not callback capacity.
	_, err = p.QueryOrder(context.Background(), nil, QueryRequest{})
	var providerErr *ProviderError
	if !errors.As(err, &providerErr) || providerErr.Code != "plugin_executable_missing" {
		t.Fatalf("query error = %v", err)
	}
	if len(paymentRPCSlots) != 0 {
		t.Fatal("ordinary slot leaked on startup failure")
	}
	<-notificationRPCSlots
	_, err = p.VerifyNotification(context.Background(), nil, nil, []byte("invalid"))
	if errors.Is(err, ErrNotificationBusy) {
		t.Fatal("released slot remained busy")
	}
	if len(notificationRPCSlots) != cap(notificationRPCSlots)-1 {
		t.Fatal("notification slot leaked")
	}
	notificationRPCSlots <- struct{}{}
}

func TestRPCProviderCapacityWaitHonorsCancellation(t *testing.T) {
	for range cap(paymentRPCSlots) {
		paymentRPCSlots <- struct{}{}
	}
	defer func() {
		for range cap(paymentRPCSlots) {
			<-paymentRPCSlots
		}
	}()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := (&RPCProvider{}).QueryOrder(ctx, nil, QueryRequest{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v", err)
	}
}
