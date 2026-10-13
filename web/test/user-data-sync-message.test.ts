import { describe, expect, test } from "bun:test";

import { formatLocalSavedRemotePending } from "@/services/user-data-sync";
import { ApiError } from "@/services/api/request";
import { isRetryableCanvasSyncError } from "@/lib/canvas/canvas-sync-error";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";

describe("本地已保存、云端同步失败的文案", () => {
    test("只有暂时性错误提示有限重试", () => {
        expect(formatLocalSavedRemotePending("素材已在本地保存", new ApiError("网络中断", { retryable: true }))).toBe("素材已在本地保存，云端同步失败：网络中断。将有限重试，也可手动重试。");
    });

    test("没有 Error.message 时使用未知错误", () => {
        expect(formatLocalSavedRemotePending("已在本地还原", "x")).toBe("已在本地还原，云端同步失败：未知错误。请处理问题后手动重试。");
    });
    test("冲突、权限、缺失文件和取消不自动重试", () => {
        for (const status of [400, 401, 403, 404, 409, 428]) expect(isRetryableCanvasSyncError(new ApiError("error", { status }))).toBe(false);
        expect(isRetryableCanvasSyncError(new DOMException("cancel", "AbortError"))).toBe(false);
        expect(isRetryableCanvasSyncError(new Error("local storage failed"))).toBe(false);
        for (const status of [408, 429, 500, 503]) expect(isRetryableCanvasSyncError(new ApiError("error", { status }))).toBe(true);
        expect(isRetryableCanvasSyncError({ permanent: false })).toBe(true);
        expect(isRetryableCanvasSyncError({ permanent: true })).toBe(false);
    });
    test("新一轮修改清除旧草稿确认和重试状态", () => {
        const store = useSyncProgressStore.getState();
        store.setProjectProgress("test", { phase: "error", localDraftSaved: true, retryable: true, retryScheduled: true });
        store.setProjectProgress("test", { phase: "pending" });
        expect(useSyncProgressStore.getState().syncingProjects.test).toMatchObject({ localDraftSaved: false, retryable: false, retryScheduled: false });
        store.clearAll();
    });
});
