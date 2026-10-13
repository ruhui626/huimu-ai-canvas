import { describe, expect, test } from "bun:test";
import { importedCanvasMetadata, uploadCanvasImportFile } from "@/services/canvas-import";
import { ApiError } from "@/services/api/request";
import { ResourceUploadError, type RemoteResource, type uploadResourceFile } from "@/services/api/resources";

describe("画布导入", () => {
    test("新副本清理旧素材与生成任务身份，保留提示词和多图结构", () => {
        const original = { content: "/old.png", storageKey: "resource:old", assetId: "old-asset", taskId: "old-task", generationEffectKeys: ["old-effect"], prompt: "苹果", isBatchRoot: true, batchChildIds: ["child"], primaryImageId: "child", generationOutputCount: 4 };
        const next = importedCanvasMetadata(original);
        expect(next.assetId).toBeUndefined();
        expect(next.taskId).toBeUndefined();
        expect(next.generationEffectKeys).toBeUndefined();
        expect(next).toMatchObject({ prompt: "苹果", isBatchRoot: true, batchChildIds: ["child"], primaryImageId: "child", generationOutputCount: 4, status: "success" });
        expect(original.assetId).toBe("old-asset");
    });

    test("429 按 Retry-After 等待并复用同一上传幂等键", async () => {
        const keys: string[] = [];
        const delays: number[] = [];
        const result = { id: "new-resource" } as RemoteResource;
        const upload: typeof uploadResourceFile = async (_file, _kind, meta) => {
            keys.push(meta!.idempotencyKey!);
            if (keys.length === 1) throw new ResourceUploadError("限流", { status: 429, permanent: false, cause: new ApiError("限流", { status: 429, retryAfterMs: 31000 }) });
            return result;
        };
        expect(await uploadCanvasImportFile(new Blob(["image"]), "image", "image.png", upload, async (delay) => { delays.push(delay); })).toBe(result);
        expect(delays).toEqual([31000]);
        expect(keys.length).toBe(2);
        expect(keys[0]).toBeTruthy();
        expect(keys[0]).toBe(keys[1]);
    });

    test("限流重试有上限，不无限等待", async () => {
        let attempts = 0;
        await expect(uploadCanvasImportFile(new Blob(), "image", "image.png", async () => {
            attempts++;
            throw new ResourceUploadError("限流", { status: 429, permanent: false, cause: new ApiError("限流", { status: 429 }) });
        }, async () => {})).rejects.toThrow("限流");
        expect(attempts).toBe(3);
    });

    test.each([true, false])("上传失败不伪装为成功或静默降级（permanent=%s）", async (permanent) => {
        let attempts = 0;
        await expect(uploadCanvasImportFile(new Blob(), "audio", "audio.wav", async () => {
            attempts++;
            throw new ResourceUploadError("upload failed", { permanent });
        }, async () => { throw new Error("不应等待"); })).rejects.toThrow("upload failed");
        expect(attempts).toBe(1);
    });
});
