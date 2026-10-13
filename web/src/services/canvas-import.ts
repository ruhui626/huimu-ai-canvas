import { ApiError } from "@/services/api/request";
import { uploadResourceFile, ResourceUploadError } from "@/services/api/resources";
import { retryCanvasAssetSyncAfterRateLimit } from "@/services/project-asset-sync";
import { resetGenerationTaskMetadata } from "@/lib/canvas/canvas-task-state";
import type { CanvasNodeMetadata } from "@/types/canvas";
import { getActiveUserScope } from "@/lib/user-scope";

export function importedCanvasMetadata(metadata: CanvasNodeMetadata | undefined): CanvasNodeMetadata {
    const next = resetGenerationTaskMetadata(metadata, metadata?.content ? "success" : "idle");
    delete next.assetId;
    delete next.agentGenerationContinuation;
    delete next.generationEffectKeys;
    next.generationOutputCount = metadata?.generationOutputCount;
    return next;
}

export async function uploadCanvasImportFile(file: Blob, kind: Parameters<typeof uploadResourceFile>[1], fileName: string, upload = uploadResourceFile, wait?: (delay: number) => Promise<void>) {
    const idempotencyKey = crypto.randomUUID();
    const scope = getActiveUserScope();
    return retryCanvasAssetSyncAfterRateLimit(async () => {
        if (scope !== getActiveUserScope()) throw new Error("账号已切换，已停止导入");
        try {
            return await upload(file, kind, { fileName, idempotencyKey });
        } catch (error) {
            // 上传层包装了 ApiError；复用现有 Retry-After 处理，不把限流降级为导入成功。
            if (error instanceof ResourceUploadError && error.cause instanceof ApiError && error.cause.status === 429) throw error.cause;
            throw error;
        }
    }, { wait });
}
