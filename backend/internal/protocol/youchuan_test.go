package protocol

import (
	"context"
	"strings"
	"testing"
)

func TestYouchuanStandardJobRequest(t *testing.T) {
	a := officialPackageAdapter(t, "youchuan-image.yingce-plugin", "youchuan-image")
	for _, model := range []string{"v8.1", "v8.2", "v7", "niji-7"} {
		r := GenerationRequest{Model: model, Prompt: "一只猫", ImageCount: 1, AspectRatio: "16:9", Images: []MediaReference{
			{URL: "https://example.com/b.png?token=abc%2Bdef", Role: "reference_image", Order: 2},
			{URL: "https://example.com/a.png", Role: "edit_source", Order: 1},
		}}
		spec, err := a.BuildCreate(context.Background(), RequestContext{Request: r})
		if err != nil {
			t.Fatal(err)
		}
		body := manifestTestBody(t, spec)
		version := " --v " + strings.TrimPrefix(model, "v")
		if model == "niji-7" {
			version = " --niji 7"
		}
		want := "https://example.com/a.png https://example.com/b.png?token=abc%2Bdef 一只猫" + version + " --fast --ar 16:9 --stylize 100 --weird 50 --chaos 5"
		if len(body) != 1 || body["text"] != want || spec.Path != "/v1/tob/diffusion" || spec.Auth.Type != "youchuan" {
			t.Fatalf("spec=%+v body=%+v", spec, body)
		}
		poll, err := a.BuildPoll(context.Background(), PollContext{TaskID: "job-42", Model: model})
		if err != nil || poll.Path != "/v1/tob/job/job-42" || poll.Auth.SecretField != "secretKey" {
			t.Fatalf("poll=%+v %v", poll, err)
		}
	}
}

func TestYouchuanRejectsUnpricedAndUnsupportedRequests(t *testing.T) {
	a := officialPackageAdapter(t, "youchuan-image.yingce-plugin", "youchuan-image")
	for _, suffix := range []string{" --hd", " --turbo", " --draft", " --v 7", " --bs 4", "\n--q 4"} {
		if _, err := a.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{Model: "v8.2", Prompt: "cat" + suffix}}); err == nil {
			t.Fatalf("accepted %q", suffix)
		}
	}
	for _, r := range []GenerationRequest{
		{Model: "v6", Prompt: "cat"}, {Model: "v8.2", Prompt: "cat", ImageCount: 4},
		{Model: "v8.2", Prompt: "cat", AspectRatio: "2048x2048"}, {Model: "v8.2", Prompt: strings.Repeat("猫", 1025)},
		{Model: "v8.2", Prompt: "cat", Images: []MediaReference{{URL: "https://example.com/a.png", Role: "mask"}}},
		{Model: "v8.2", Prompt: "cat", Images: []MediaReference{{URL: "https://example.com/a.png --hd"}}},
		{Model: "v8.2", Prompt: "cat", Images: []MediaReference{{DataURL: "data:image/png;base64,aA=="}}},
	} {
		if _, err := a.BuildCreate(context.Background(), RequestContext{Request: r}); err == nil {
			t.Fatalf("accepted %+v", r)
		}
	}
}

func TestYouchuanCreativeControls(t *testing.T) {
	a := officialPackageAdapter(t, "youchuan-image.yingce-plugin", "youchuan-image")
	for _, model := range []string{"v8.1", "v8.2", "v7", "niji-7"} {
		for _, ratio := range []string{"1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "16:9", "9:16", "21:9"} {
			for _, values := range []map[string]any{{"stylize": 0, "weird": 0, "chaos": 0}, {"stylize": 1000, "weird": 3000, "chaos": 100}} {
				r := GenerationRequest{Model: model, Prompt: "cat", AspectRatio: ratio, ProviderOptions: map[string]map[string]any{"youchuan-image": values}}
				spec, err := a.BuildCreate(context.Background(), RequestContext{Request: r})
				if err != nil {
					t.Fatal(err)
				}
				text := manifestTestBody(t, spec)["text"].(string)
				want := " --stylize 0 --weird 0 --chaos 0"
				if values["stylize"] == 1000 {
					want = " --stylize 1000 --weird 3000 --chaos 100"
				}
				if !strings.HasSuffix(text, " --fast --ar "+ratio+want) || strings.Contains(text, "--hd") {
					t.Fatal(text)
				}
			}
		}
	}
	for key, maximum := range map[string]int{"stylize": 1000, "weird": 3000, "chaos": 100} {
		for _, value := range []any{-1, maximum + 1, 0.5, "0 --hd", "100", true} {
			r := GenerationRequest{Model: "v8.2", Prompt: "cat", ProviderOptions: map[string]map[string]any{"youchuan-image": {key: value}}}
			if _, err := a.BuildCreate(context.Background(), RequestContext{Request: r}); err == nil {
				t.Fatalf("accepted %s=%v", key, value)
			}
		}
	}
}

func TestYouchuanStatusesAndPartialAuditKeepOriginalIndex(t *testing.T) {
	a := officialPackageAdapter(t, "youchuan-image.yingce-plugin", "youchuan-image")
	for _, tc := range []struct {
		body   string
		status Status
		count  int
	}{
		{`{"id":"job-42","status":1,"urls":[]}`, StatusProcessing, 0},
		{`{"id":"job-42","status":2,"urls":["https://example.com/0.png","https://example.com/1.png","","https://example.com/3.png"],"audits":["","rejected","rejected",""]}`, StatusSucceeded, 2},
		{`{"id":"job-42","status":3,"comment":"审核未通过"}`, StatusFailed, 0},
		{`{"code":402,"message":"余额不足"}`, StatusFailed, 0},
		{`{"status":99,"urls":["https://example.com/a.png"]}`, StatusFailed, 0},
	} {
		r, err := a.ParsePoll(context.Background(), PollContext{TaskID: "job-42"}, []byte(tc.body))
		if err != nil || r.Status != tc.status {
			t.Fatalf("%s: %+v %v", tc.body, r, err)
		}
		count := 0
		if r.Result != nil {
			count = len(r.Result.Images)
		}
		if count != tc.count {
			t.Fatalf("count=%d want %d", count, tc.count)
		}
		if count == 2 && (r.Result.Images[1].Order != 3 || r.Result.Images[1].ID != "job-42") {
			t.Fatalf("lost source index: %+v", r.Result.Images)
		}
	}
}
