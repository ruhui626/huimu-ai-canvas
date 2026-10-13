package protocol

import (
	"context"
	"strings"
	"testing"
)

func TestRunningHubYouchuanRequests(t *testing.T) {
	a := officialPackageAdapter(t, "runninghub-youchuan-image.yingce-plugin", "runninghub-youchuan-image")
	for model, path := range map[string]string{"v8.1": "text-to-image-v81", "v8.2": "text-to-image-v8.2-fast", "v7": "text-to-image-v7"} {
		for _, ratio := range []string{"1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3"} {
			r := GenerationRequest{Model: model, Prompt: "一只猫", ImageCount: 1, AspectRatio: ratio, Images: []MediaReference{{URL: "https://example.com/a.png", Role: "edit_source"}}, ProviderOptions: map[string]map[string]any{
				"runninghub-youchuan-image": {"stylize": 0, "weird": 0, "chaos": 0, "hd": true, "quality": "4", "sref": "https://example.com/style.png"},
				"youchuan-image":            {"stylize": 900},
			}}
			spec, err := a.BuildCreate(context.Background(), RequestContext{Request: r})
			if err != nil {
				t.Fatal(err)
			}
			body := manifestTestBody(t, spec)
			if !spec.OriginPath || spec.Path != "/openapi/v2/youchuan/"+path || spec.Auth.Type != "bearer" || body["prompt"] != "一只猫" || body["aspectRatio"] != ratio || body["imageUrl"] != "https://example.com/a.png" || body["quality"] != "1" || body["stylize"] != float64(0) || body["chaos"] != float64(0) {
				t.Fatalf("spec=%+v body=%+v", spec, body)
			}
			if model == "v7" {
				if _, ok := body["hd"]; ok {
					t.Fatal("V7 received hd")
				}
			} else if body["hd"] != false {
				t.Fatal("hd must be false", body)
			}
			if model == "v8.1" {
				if _, ok := body["weird"]; ok {
					t.Fatal("V8.1 received weird")
				}
			} else if body["weird"] != float64(0) {
				t.Fatal(body)
			}
			for _, key := range []string{"model", "text", "sref", "oref", "draft", "webhookUrl"} {
				if _, ok := body[key]; ok {
					t.Fatalf("unexpected %s", key)
				}
			}
		}
	}
	spec, err := a.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{Model: "v8.2", Prompt: "cat"}})
	if err != nil {
		t.Fatal(err)
	}
	body := manifestTestBody(t, spec)
	if body["stylize"] != float64(100) || body["weird"] != float64(50) || body["chaos"] != float64(5) || body["aspectRatio"] != "1:1" {
		t.Fatal(body)
	}
	if _, ok := body["imageUrl"]; ok {
		t.Fatal("empty reference sent")
	}
	poll, err := a.BuildPoll(context.Background(), PollContext{TaskID: "rh-42"})
	if err != nil || !poll.OriginPath || poll.Method != "POST" || poll.Path != "/openapi/v2/query" || poll.Auth.Type != "bearer" || manifestTestBody(t, poll)["taskId"] != "rh-42" {
		t.Fatalf("poll=%+v %v", poll, err)
	}
}

func TestRunningHubYouchuanValidation(t *testing.T) {
	a := officialPackageAdapter(t, "runninghub-youchuan-image.yingce-plugin", "runninghub-youchuan-image")
	base := GenerationRequest{Model: "v8.2", Prompt: "cat", ImageCount: 1}
	cases := []GenerationRequest{}
	for _, model := range []string{"niji-7", "v6", "../../query"} {
		r := base
		r.Model = model
		cases = append(cases, r)
	}
	for _, prompt := range []string{"", "cat --hd", "cat --sref x"} {
		r := base
		r.Prompt = prompt
		cases = append(cases, r)
	}
	for _, role := range []string{"mask", "style_reference", "subject_reference"} {
		r := base
		r.Images = []MediaReference{{URL: "https://example.com/a.png", Role: role}}
		cases = append(cases, r)
	}
	for _, count := range []int{-1, 2, 4} {
		r := base
		r.ImageCount = count
		cases = append(cases, r)
	}
	for _, value := range []any{-1, 1001, 0.5, "100", true} {
		r := base
		r.ProviderOptions = map[string]map[string]any{"runninghub-youchuan-image": {"stylize": value}}
		cases = append(cases, r)
	}
	r := base
	r.Images = []MediaReference{{URL: "https://example.com/a.png"}, {URL: "https://example.com/b.png"}}
	cases = append(cases, r)
	r = base
	r.Images = []MediaReference{{DataURL: "data:image/png;base64,aA=="}}
	cases = append(cases, r)
	r = base
	r.AspectRatio = "21:9"
	cases = append(cases, r)
	r = base
	r.Videos = []MediaReference{{URL: "https://example.com/a.mp4"}}
	cases = append(cases, r)
	for _, r := range cases {
		if _, err := a.BuildCreate(context.Background(), RequestContext{Request: r}); err == nil {
			t.Fatalf("accepted %+v", r)
		}
	}
	for model, limit := range map[string]int{"v8.1": 8130, "v8.2": 5850, "v7": 8192} {
		r := base
		r.Model = model
		r.Prompt = strings.Repeat("猫", limit)
		if _, err := a.BuildCreate(context.Background(), RequestContext{Request: r}); err != nil {
			t.Fatal(model, err)
		}
		r.Prompt += "猫"
		if _, err := a.BuildCreate(context.Background(), RequestContext{Request: r}); err != nil {
			t.Fatal("plugin must defer prompt length to model capabilities", model, err)
		}
	}
}

func TestRunningHubYouchuanResponses(t *testing.T) {
	a := officialPackageAdapter(t, "runninghub-youchuan-image.yingce-plugin", "runninghub-youchuan-image")
	for _, tc := range []struct {
		body   string
		status Status
		count  int
	}{
		{`{"taskId":"rh-42","status":"QUEUED","errorCode":"","results":[{"url":"https://example.com/early.png","outputType":"png"}]}`, StatusPending, 0},
		{`{"taskId":"rh-42","status":"RUNNING","results":null}`, StatusProcessing, 0},
		{`{"status":"SUCCESS","errorCode":"","results":[{"url":"https://example.com/a.png","outputType":"png"},{"url":"https://example.com/b.webp","outputType":"webp"},{"url":"https://example.com/log.txt","outputType":"txt"}],"usage":{"thirdPartyConsumeMoney":"0.6"}}`, StatusSucceeded, 2},
		{`{"status":"FAILED","errorCode":"1501","errorMessage":"审核失败"}`, StatusFailed, 0},
		{`{"status":"SUCCESS","errorCode":"1501","errorMessage":"失败"}`, StatusFailed, 0},
		{`{"status":"UNKNOWN"}`, StatusFailed, 0},
		{`{"code":401,"message":"invalid key"}`, StatusFailed, 0},
		{`{"status":"SUCCESS","results":[]}`, StatusSucceeded, 0},
	} {
		r, err := a.ParsePoll(context.Background(), PollContext{TaskID: "rh-42"}, []byte(tc.body))
		if err != nil || r.Status != tc.status {
			t.Fatalf("%s: %+v %v", tc.body, r, err)
		}
		count := 0
		if r.Result != nil {
			count = len(r.Result.Images)
			for _, item := range r.Result.Images {
				if !item.Ephemeral {
					t.Fatal("missing transient marker")
				}
			}
		}
		if count != tc.count {
			t.Fatalf("count=%d want=%d", count, tc.count)
		}
		if tc.count == 2 && r.Result.Usage["thirdPartyConsumeMoney"] != "0.6" {
			t.Fatal("usage lost")
		}
	}
}
