import { ApiError } from "@/services/api/request";

export function isRetryableCanvasSyncError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === "AbortError") return false;
    if (error instanceof ApiError) {
        if (error.status === 409 || error.status === 428 || error.reason === "canvas_history_resources_missing") return false;
        return error.retryable;
    }
    return typeof error === "object" && error !== null && "permanent" in error && error.permanent === false;
}
