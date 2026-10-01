import { describe, expect, test } from "bun:test";

import { normalizeManagedImageAssetLocators } from "@/services/asset-resource-locators";
import type { Asset } from "@/stores/use-asset-store";

const baseImage: Asset = {
    id: "image-1",
    kind: "image",
    title: "生成图片",
    coverUrl: "https://oss.example.com/a.png?Expires=1&Signature=expired",
    tags: [],
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    data: {
        dataUrl: "https://oss.example.com/a.png?Expires=1&Signature=expired",
        storageKey: "resource:res-image-1",
        width: 2,
        height: 3,
        bytes: 1,
        mimeType: "image/png",
    },
};

describe("受管图片持久化地址", () => {
    test("有 resource ID 时用稳定平台地址替换过期签名地址", () => {
        const normalized = normalizeManagedImageAssetLocators(baseImage);
        expect(normalized.kind).toBe("image");
        expect(normalized.coverUrl).toEndWith("/resources/res-image-1/file");
        if (normalized.kind === "image") {
            expect(normalized.data.dataUrl).toBe(normalized.coverUrl);
            expect(normalized.data.dataUrl).not.toContain("Signature=");
        }
    });

    test("外部图片和本地图片不改写", () => {
        const external = { ...baseImage, data: { ...baseImage.data, storageKey: undefined } };
        expect(normalizeManagedImageAssetLocators(external)).toBe(external);
    });
});
