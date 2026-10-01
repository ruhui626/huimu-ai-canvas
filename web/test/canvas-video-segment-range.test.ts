import { describe, expect, test } from "bun:test";

import { createVideoSegmentRangeAt, normalizeVideoSegmentRange, VIDEO_SEGMENT_END_TOLERANCE_MS } from "../src/lib/canvas/canvas-video-segment-range";

describe("createVideoSegmentRangeAt", () => {
    test("creates a three-second segment at the current playhead", () => {
        expect(createVideoSegmentRangeAt(10_000, 2_000)).toEqual({ startMs: 2_000, endMs: 5_000 });
    });

    test("never creates an overrun when the playhead is at the video end", () => {
        expect(createVideoSegmentRangeAt(6_000, 6_000)).toEqual({ startMs: 5_900, endMs: 6_000 });
    });
});

describe("normalizeVideoSegmentRange", () => {
    test("keeps a valid range unchanged", () => {
        expect(normalizeVideoSegmentRange({ startMs: 1000, endMs: 5000 }, 6000)).toEqual({ startMs: 1000, endMs: 5000 });
    });

    test("clamps a small container timestamp discrepancy at the video tail", () => {
        expect(normalizeVideoSegmentRange({ startMs: 0, endMs: 6080 }, 6000)).toEqual({ startMs: 0, endMs: 6000 });
    });

    test("rejects a real overrun beyond the tail tolerance", () => {
        expect(() => normalizeVideoSegmentRange({ startMs: 0, endMs: 6000 + VIDEO_SEGMENT_END_TOLERANCE_MS + 1 }, 6000)).toThrow("片段结束时间超过视频时长");
    });

    test("rejects a start at the end and reversed ranges", () => {
        expect(() => normalizeVideoSegmentRange({ startMs: 6000, endMs: 6100 }, 6000)).toThrow("片段开始时间不能晚于视频结尾");
        expect(() => normalizeVideoSegmentRange({ startMs: 3000, endMs: 2000 }, 6000)).toThrow("片段结束时间必须晚于开始时间");
    });
});
