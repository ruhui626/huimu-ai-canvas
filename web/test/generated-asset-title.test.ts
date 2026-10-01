import { describe, expect, test } from "bun:test";

import { allocateGeneratedAssetTitle, generatedAssetTitleBase, generationTaskAssetTitleContext } from "@/lib/generated-asset-title";
import type { Asset } from "@/stores/use-asset-store";

function videoAsset(title: string, metadata?: Record<string, unknown>): Asset {
    return {
        id: title,
        kind: "video",
        title,
        coverUrl: "",
        tags: [],
        createdAt: "2026-09-30T00:00:00.000Z",
        updatedAt: "2026-09-30T00:00:00.000Z",
        metadata,
        data: { url: "video.mp4", width: 1920, height: 1080, bytes: 1, mimeType: "video/mp4" },
    };
}

describe("generated asset titles", () => {
    test("uses a meaningful source node title and removes duplicate type suffixes", () => {
        expect(generatedAssetTitleBase({ kind: "video", sourceTitle: "镜头03·苹果产品特写" })).toBe("镜头03·苹果产品特写 · 视频");
        expect(generatedAssetTitleBase({ kind: "video", sourceTitle: "苹果特写 · 视频" })).toBe("苹果特写 · 视频");
    });

    test("falls back from generic node titles to a cleaned prompt", () => {
        expect(generatedAssetTitleBase({ kind: "audio", sourceTitle: "音频", prompt: "@文本1 雨夜街道环境声。" })).toBe("雨夜街道环境声 · 音频");
    });

    test("allocates the next stable sequence from metadata and legacy titles", () => {
        const baseTitle = "镜头03·苹果产品特写 · 视频";
        const assets = [
            videoAsset(baseTitle),
            videoAsset(`${baseTitle} · 02`, { generationTitleBase: baseTitle, generationTitleSequence: 2, generationTitleSourceNodeId: "node-1" }),
            videoAsset(`${baseTitle} · 04`),
        ];
        expect(allocateGeneratedAssetTitle({ kind: "video", baseTitle, sourceNodeId: "node-1", assets })).toEqual({
            title: `${baseTitle} · 05`,
            baseTitle,
            sequence: 5,
        });
    });

    test("reads the persisted task naming snapshot", () => {
        expect(generationTaskAssetTitleContext(JSON.stringify({ metadata: { assetTitleBase: "镜头1 · 视频", assetTitleSourceNodeId: "node-1", assetTitleSourceNodeTitle: "镜头1" } }))).toEqual({
            baseTitle: "镜头1 · 视频",
            sourceNodeId: "node-1",
            sourceNodeTitle: "镜头1",
        });
    });
});
