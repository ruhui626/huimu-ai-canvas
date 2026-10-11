package platform

import "testing"

func TestRuntimeConcurrencyDefaultsAndOverrides(t *testing.T) {
	t.Setenv("CANVAS_WORKER_CONCURRENCY", "")
	t.Setenv("CANVAS_CHANNEL_CONCURRENCY", "")
	policy := DefaultRuntimePolicy()
	if policy.Task.WorkerConcurrency != 32 || policy.Task.ChannelConcurrency != 32 {
		t.Fatalf("unexpected concurrency defaults: %+v", policy.Task)
	}
	if err := validateRuntimePolicy(policy); err != nil {
		t.Fatalf("invalid default policy: %v", err)
	}
	t.Setenv("CANVAS_WORKER_CONCURRENCY", "9")
	t.Setenv("CANVAS_CHANNEL_CONCURRENCY", "7")
	policy = DefaultRuntimePolicy()
	if policy.Task.WorkerConcurrency != 9 || policy.Task.ChannelConcurrency != 7 {
		t.Fatal("explicit environment concurrency must override defaults")
	}
}

func TestMediaRuntimeDefaults(t *testing.T) {
	policy := DefaultRuntimePolicy()
	if err := validateRuntimePolicy(policy); err != nil {
		t.Fatalf("invalid default policy: %v", err)
	}
	if policy.Resource.ResourceUploadMB != 128 || policy.Resource.GeneratedFileMB != 128 || policy.Request.CustomRelayResponseMB != 128 {
		t.Fatal("media size defaults must be 128 MB")
	}
	if policy.Storage.TransferTimeoutSeconds != 180 || policy.Task.ImageTimeoutMinutes != 12 || policy.Task.AudioTimeoutMinutes != 10 {
		t.Fatal("unexpected media timeout defaults")
	}
	if policy.Task.ActiveTaskLimit != 5 || policy.Request.CustomRelayConcurrency != 4 || policy.Storage.NonSeekableBufferMB != 64 {
		t.Fatal("media defaults must not increase concurrency or upload buffering")
	}
	if policy.Task.TextTimeoutMinutes != 8 || policy.Task.VideoTimeoutMinutes != 60 || policy.Resource.StoredFileGB != 20 {
		t.Fatal("unrelated timeout and account quota defaults changed")
	}
}
