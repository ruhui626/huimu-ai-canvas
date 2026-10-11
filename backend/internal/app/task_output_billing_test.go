package app

import (
	"reflect"
	"testing"

	"yingce/backend/internal/model"
)

func TestTaskSummaryBillingDisplayAmount(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status model.BillingStatus
		actual int64
		want   int64
	}{
		{"settled actual", model.BillingStatusSettled, 1_280_000, 1_280_000},
		{"settled zero", model.BillingStatusSettled, 0, 0},
		{"reserved", model.BillingStatusReserved, 1_280_000, 160_000},
		{"running", model.BillingStatusRunning, 1_280_000, 160_000},
		{"uncertain", model.BillingStatusUncertain, 1_280_000, 160_000},
		{"refunded", model.BillingStatusRefunded, 0, 160_000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			order := model.BillingOrder{AmountMicrocredits: 160_000, ActualAmountMicrocredits: tc.actual, Status: tc.status}
			orders := map[string]model.BillingOrder{"task": order}
			result := taskSummariesForOutputWithBilling([]model.Task{{ID: "task"}, {ID: "unbilled"}}, orders)
			if result[0].Billing == nil || result[0].Billing.AmountMicrocredits != tc.want || result[0].Billing.Status != tc.status {
				t.Fatalf("unexpected billing summary: %+v", result[0].Billing)
			}
			if result[1].Billing != nil {
				t.Fatal("unbilled task acquired a billing summary")
			}
			if !reflect.DeepEqual(orders["task"], order) {
				t.Fatal("display conversion modified the billing order")
			}
		})
	}
}
