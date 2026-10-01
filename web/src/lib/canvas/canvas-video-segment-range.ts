export type NormalizedVideoSegmentRange = {
    startMs: number;
    endMs: number;
};

export const VIDEO_SEGMENT_END_TOLERANCE_MS = 250;
export const VIDEO_SEGMENT_MIN_MS = 100;
export const VIDEO_SEGMENT_DEFAULT_MS = 3000;

export function createVideoSegmentRangeAt(durationMs: number, preferredStartMs: number): NormalizedVideoSegmentRange {
    const duration = Math.max(VIDEO_SEGMENT_MIN_MS, Math.round(durationMs));
    const startMs = Math.max(0, Math.min(Math.round(preferredStartMs), duration - VIDEO_SEGMENT_MIN_MS));
    const endMs = Math.min(duration, Math.max(startMs + VIDEO_SEGMENT_MIN_MS, startMs + Math.min(VIDEO_SEGMENT_DEFAULT_MS, duration)));
    return { startMs, endMs };
}

/**
 * Normalizes a requested range against confirmed source metadata. Small tail
 * discrepancies are common between MP4 container timestamps and HTML media
 * metadata, so only that bounded difference is clamped automatically.
 */
export function normalizeVideoSegmentRange(range: NormalizedVideoSegmentRange, durationMs?: number): NormalizedVideoSegmentRange {
    if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)) throw new Error("片段时间无效");
    const startMs = Math.max(0, Math.round(range.startMs));
    let endMs = Math.round(range.endMs);
    const normalizedDurationMs = durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : undefined;
    if (normalizedDurationMs !== undefined) {
        if (startMs >= normalizedDurationMs) throw new Error("片段开始时间不能晚于视频结尾");
        if (endMs > normalizedDurationMs) {
            if (endMs - normalizedDurationMs > VIDEO_SEGMENT_END_TOLERANCE_MS) throw new Error("片段结束时间超过视频时长");
            endMs = normalizedDurationMs;
        }
    }
    if (endMs <= startMs) throw new Error("片段结束时间必须晚于开始时间");
    return { startMs, endMs };
}
