package app

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"yingce/backend/internal/protocol"
)

func TestRunningHubYouchuanCapabilityDefaults(t *testing.T) {
	for name, limit := range map[string]int{"v8.1": 8130, "v8.2": 5850, "v7": 8192} {
		profile := DefaultImageCapabilityConfig("runninghub-youchuan-image", name)
		if profile.References.MaxImages != 1 || profile.References.PromptMaxChars != limit || profile.MaxOutputs != 1 || profile.Quality.Supported || profile.References.MaskSupported || profile.Size.Parameter != "aspect_ratio" || len(profile.Size.Values) != 7 {
			t.Fatalf("%s: %+v", name, profile)
		}
	}
	if DefaultImageCapabilityConfig("youchuan-image", "v8.2").References.MaxImages != 20 {
		t.Fatal("direct Youchuan changed")
	}
}

func TestRunningHubYouchuanEmptySuccessAndCredentialIsolation(t *testing.T) {
	if _, err := finishProtocolResult(context.Background(), providerConfig{InterfaceType: "runninghub-youchuan-image"}, "image", "rh-42", &protocol.Result{}, videoPollPolicy{}); err == nil {
		t.Fatal("empty success accepted")
	}
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" || r.Header.Get("x-youchuan-secret") != "" {
			t.Error("credentials leaked to CDN")
		}
		_, _ = w.Write([]byte("image"))
	}))
	defer destination.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Error("public media download must not carry the API key")
		}
		http.Redirect(w, r, destination.URL+"/image", http.StatusFound)
	}))
	defer source.Close()
	config := providerConfig{InterfaceType: "runninghub-youchuan-image", BaseURL: source.URL, APIKey: "test-key"}
	for _, url := range []string{source.URL + "/image", destination.URL + "/image"} {
		if _, _, err := getProviderExternalBinary(context.Background(), config, url); err != nil {
			t.Fatal(err)
		}
	}
}
