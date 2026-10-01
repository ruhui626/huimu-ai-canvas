package app

import (
	"encoding/json"
	"testing"
	"time"

	"infinite-canvas/backend/internal/model"
)

func TestGeneratedAssetBaseTitleUsesSourceOrPrompt(t *testing.T) {
	if got := generatedAssetBaseTitle("video", "镜头03·苹果产品特写", "", time.Time{}); got != "镜头03·苹果产品特写 · 视频" {
		t.Fatalf("unexpected source title: %q", got)
	}
	if got := generatedAssetBaseTitle("audio", "音频", "@文本1 雨夜街道环境声。", time.Time{}); got != "雨夜街道环境声 · 音频" {
		t.Fatalf("unexpected prompt title: %q", got)
	}
}

func TestAllocateGeneratedAssetTitleUsesMetadataAndExistingTitles(t *testing.T) {
	baseTitle := "镜头03·苹果产品特写 · 视频"
	metadata, err := json.Marshal(map[string]any{"metadata": map[string]any{"generationTitleBase": baseTitle, "generationTitleSequence": 2, "generationTitleSourceNodeId": "node-1"}})
	if err != nil {
		t.Fatal(err)
	}
	assets := []model.Asset{
		{Kind: "video", Title: baseTitle},
		{Kind: "video", Title: baseTitle + " · 02", PayloadJSON: string(metadata)},
		{Kind: "video", Title: baseTitle + " · 04"},
	}
	got := allocateGeneratedAssetTitle("video", baseTitle, "node-1", assets)
	if got.Title != baseTitle+" · 05" || got.Sequence != 5 || got.BaseTitle != baseTitle {
		t.Fatalf("unexpected allocation: %#v", got)
	}
}

func TestGeneratedAssetTitleContextFromTaskReadsSnapshot(t *testing.T) {
	task := model.Task{
		InputJSON: `{"metadata":{"assetTitleBase":"镜头1 · 视频","assetTitleSourceNodeId":"node-1","assetTitleSourceNodeTitle":"镜头1"}}`,
		Prompt:    "ignored",
	}
	got := generatedAssetTitleContextFromTask(task, "video")
	if got.BaseTitle != "镜头1 · 视频" || got.SourceNodeID != "node-1" || got.SourceNodeTitle != "镜头1" {
		t.Fatalf("unexpected context: %#v", got)
	}
}
