import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { VIDEO_SEGMENT_MIN_MS } from "@/lib/canvas/canvas-video-segment-range";
import type { CanvasTimelineSegmentItem } from "@/lib/canvas/canvas-video-timeline-segments";

const FILMSTRIP_FRAME_COUNT = 12;

type CanvasVideoSegmentRangeEditorProps = {
    videoUrl: string;
    durationMs: number;
    currentTimeMs: number;
    segment: CanvasTimelineSegmentItem;
    theme: CanvasTheme;
    onChange: (patch: Pick<CanvasTimelineSegmentItem, "startMs" | "endMs">) => void;
    onSeek: (timeMs: number) => void;
};

export function CanvasVideoSegmentRangeEditor({ videoUrl, durationMs, currentTimeMs, segment, theme, onChange, onSeek }: CanvasVideoSegmentRangeEditorProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<"start" | "end" | null>(null);
    const [thumbnails, setThumbnails] = useState<string[]>([]);

    useEffect(() => {
        if (!videoUrl || durationMs <= 0) {
            setThumbnails([]);
            return;
        }
        let cancelled = false;
        setThumbnails([]);
        void captureFilmstrip(videoUrl, durationMs, FILMSTRIP_FRAME_COUNT).then((frames) => {
            if (!cancelled) setThumbnails(frames);
        });
        return () => {
            cancelled = true;
        };
    }, [durationMs, videoUrl]);

    const timeAtPointer = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || durationMs <= 0) return 0;
        return Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * durationMs);
    };
    const updateBoundary = (kind: "start" | "end", value: number) => {
        if (kind === "start") {
            const startMs = Math.max(0, Math.min(Math.round(value), Math.max(0, segment.endMs - VIDEO_SEGMENT_MIN_MS)));
            onChange({ startMs, endMs: segment.endMs });
            onSeek(startMs);
            return;
        }
        const endMs = Math.min(durationMs, Math.max(Math.round(value), segment.startMs + VIDEO_SEGMENT_MIN_MS));
        onChange({ startMs: segment.startMs, endMs });
        onSeek(Math.max(segment.startMs, endMs - 1));
    };
    const startDrag = (kind: "start" | "end", event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = kind;
        trackRef.current?.setPointerCapture(event.pointerId);
        updateBoundary(kind, timeAtPointer(event.clientX));
    };
    const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        updateBoundary(dragRef.current, timeAtPointer(event.clientX));
    };
    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const nudgeBoundary = (kind: "start" | "end", event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const amount = event.shiftKey ? 500 : 100;
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        updateBoundary(kind, (kind === "start" ? segment.startMs : segment.endMs) + amount * direction);
    };

    const startPercent = percent(segment.startMs, durationMs);
    const endPercent = percent(segment.endMs, durationMs);
    const currentPercent = percent(currentTimeMs, durationMs);
    const selectionWidth = Math.max(0, endPercent - startPercent);

    return (
        <div className="space-y-2">
            <div
                ref={trackRef}
                className="relative h-20 touch-none select-none overflow-hidden rounded-lg border bg-black"
                style={{ borderColor: theme.toolbar.border }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={(event) => onSeek(timeAtPointer(event.clientX))}
            >
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${FILMSTRIP_FRAME_COUNT}, minmax(0, 1fr))` }} aria-hidden="true">
                    {Array.from({ length: FILMSTRIP_FRAME_COUNT }, (_, index) => thumbnails[index]
                        ? <img key={index} src={thumbnails[index]} alt="" draggable={false} className="size-full object-cover" />
                        : <span key={index} className="border-r last:border-r-0" style={{ borderColor: theme.toolbar.border, background: theme.node.fill }} />)}
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 bg-black/60" style={{ width: `${startPercent}%` }} />
                <div className="pointer-events-none absolute inset-y-0 right-0 bg-black/60" style={{ width: `${Math.max(0, 100 - endPercent)}%` }} />
                <div
                    className="pointer-events-none absolute inset-y-0 border-y-2"
                    style={{ left: `${startPercent}%`, width: `${selectionWidth}%`, borderColor: theme.accent.primary, boxShadow: `inset 0 0 0 1px ${theme.accent.primarySoft}` }}
                />
                <span
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                >
                    {formatRangeDuration(segment.endMs - segment.startMs)}
                </span>
                <span className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white/90" style={{ left: `${currentPercent}%` }} aria-hidden="true" />
                <RangeHandle
                    side="start"
                    percent={startPercent}
                    value={segment.startMs}
                    max={Math.max(0, segment.endMs - VIDEO_SEGMENT_MIN_MS)}
                    color={theme.accent.primary}
                    onPointerDown={(event) => startDrag("start", event)}
                    onKeyDown={(event) => nudgeBoundary("start", event)}
                />
                <RangeHandle
                    side="end"
                    percent={endPercent}
                    value={segment.endMs}
                    max={durationMs}
                    color={theme.accent.primary}
                    onPointerDown={(event) => startDrag("end", event)}
                    onKeyDown={(event) => nudgeBoundary("end", event)}
                />
            </div>
            <div className="flex items-center justify-between text-[var(--fs-tiny)] opacity-55">
                <span>0:00</span>
                <span>拖动两侧手柄调整片段，点击胶片可定位播放</span>
                <span>{formatRangeDuration(durationMs)}</span>
            </div>
        </div>
    );
}

function RangeHandle({ side, percent: position, value, max, color, onPointerDown, onKeyDown }: {
    side: "start" | "end";
    percent: number;
    value: number;
    max: number;
    color: string;
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
    return (
        <button
            type="button"
            className="absolute inset-y-0 z-30 w-5 cursor-ew-resize touch-none rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ left: `${position}%`, transform: side === "start" ? "translateX(0)" : "translateX(-100%)", background: color, outlineColor: color }}
            aria-label={side === "start" ? "调整片段起点" : "调整片段终点"}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={value}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onClick={(event) => event.stopPropagation()}
        >
            <span className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
        </button>
    );
}

function percent(value: number, durationMs: number) {
    if (durationMs <= 0) return 0;
    return Math.max(0, Math.min(100, value / durationMs * 100));
}

function formatRangeDuration(durationMs: number) {
    const seconds = Math.max(0, durationMs) / 1000;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

async function captureFilmstrip(source: string, durationMs: number, count: number): Promise<string[]> {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    if (isCrossOrigin(source)) video.crossOrigin = "anonymous";
    try {
        video.src = source;
        video.load();
        await waitForVideoMetadata(video);
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const context = canvas.getContext("2d");
        if (!context) return [];
        const durationSec = Math.min(durationMs / 1000, Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationMs / 1000);
        const frames: string[] = [];
        for (let index = 0; index < count; index += 1) {
            const time = Math.max(0, Math.min(Math.max(0, durationSec - 0.01), durationSec * ((index + 0.5) / count)));
            await seekVideo(video, time);
            drawCover(context, video, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.66));
        }
        return frames;
    } catch {
        return [];
    } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
    }
}

function waitForVideoMetadata(video: HTMLVideoElement) {
    if (video.readyState >= 1) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => finish(() => reject(new Error("视频缩略图读取超时"))), 8000);
        const finish = (next: () => void) => {
            window.clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", handleLoaded);
            video.removeEventListener("error", handleError);
            next();
        };
        const handleLoaded = () => finish(resolve);
        const handleError = () => finish(() => reject(new Error("视频缩略图读取失败")));
        video.addEventListener("loadedmetadata", handleLoaded, { once: true });
        video.addEventListener("error", handleError, { once: true });
    });
}

function seekVideo(video: HTMLVideoElement, time: number) {
    if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) return Promise.resolve();
    return new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => finish(), 1500);
        const finish = () => {
            window.clearTimeout(timeout);
            video.removeEventListener("seeked", finish);
            resolve();
        };
        video.addEventListener("seeked", finish, { once: true });
        video.currentTime = time;
    });
}

function drawCover(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
    const sourceWidth = Math.max(1, video.videoWidth);
    const sourceHeight = Math.max(1, video.videoHeight);
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function isCrossOrigin(source: string) {
    try {
        return new URL(source, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
}
