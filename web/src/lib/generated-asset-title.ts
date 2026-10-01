import type { Asset } from "@/stores/use-asset-store";

export type GeneratedAssetKind = "image" | "video" | "audio";

export type GeneratedAssetNaming = {
    title: string;
    baseTitle: string;
    sequence: number;
};

const TYPE_LABELS: Record<GeneratedAssetKind, string> = {
    image: "图片",
    video: "视频",
    audio: "音频",
};

const GENERIC_SOURCE_TITLES = new Set([
    "图片",
    "视频",
    "音频",
    "生成图片",
    "生成视频",
    "生成音频",
    "生成作品",
    "生成配置",
    "image",
    "video",
    "audio",
    "generated image",
    "generated video",
    "generated audio",
]);

const MAX_TITLE_SOURCE_LENGTH = 32;

export function generatedAssetTitleBase(input: {
    kind: GeneratedAssetKind;
    sourceTitle?: string;
    prompt?: string;
    createdAt?: string;
}) {
    const typeLabel = TYPE_LABELS[input.kind];
    const sourceTitle = cleanTitleSource(input.sourceTitle || "", typeLabel);
    const promptTitle = cleanTitleSource(input.prompt || "", typeLabel);
    const subject = sourceTitle && !GENERIC_SOURCE_TITLES.has(sourceTitle.toLowerCase())
        ? sourceTitle
        : promptTitle && !GENERIC_SOURCE_TITLES.has(promptTitle.toLowerCase())
          ? promptTitle
          : fallbackTimeLabel(input.createdAt);
    return subject ? `${subject} · ${typeLabel}` : `生成${typeLabel}`;
}

export function allocateGeneratedAssetTitle(input: {
    kind: GeneratedAssetKind;
    baseTitle: string;
    sourceNodeId?: string;
    assets: Asset[];
}): GeneratedAssetNaming {
    const escapedBase = escapeRegExp(input.baseTitle);
    const numberedTitle = new RegExp(`^${escapedBase} · (\\d+)$`, "u");
    let maximum = 0;
    for (const asset of input.assets) {
        if (asset.kind !== input.kind) continue;
        const metadataSourceNodeId = stringMetadata(asset.metadata, "generationTitleSourceNodeId");
        const metadataBase = stringMetadata(asset.metadata, "generationTitleBase");
        const metadataSequence = numberMetadata(asset.metadata, "generationTitleSequence");
        if (input.sourceNodeId && metadataSourceNodeId === input.sourceNodeId && metadataSequence > 0) {
            maximum = Math.max(maximum, metadataSequence);
            continue;
        }
        if (metadataBase === input.baseTitle && metadataSequence > 0) {
            maximum = Math.max(maximum, metadataSequence);
            continue;
        }
        if (asset.title === input.baseTitle) {
            maximum = Math.max(maximum, 1);
            continue;
        }
        const match = numberedTitle.exec(asset.title);
        if (match) maximum = Math.max(maximum, Number(match[1]) || 0);
    }
    const sequence = maximum + 1;
    return {
        title: sequence === 1 ? input.baseTitle : `${input.baseTitle} · ${String(sequence).padStart(2, "0")}`,
        baseTitle: input.baseTitle,
        sequence,
    };
}

export function generationTaskAssetTitleContext(inputJson: string | undefined) {
    if (!inputJson) return {};
    try {
        const input = JSON.parse(inputJson) as { metadata?: Record<string, unknown> };
        return {
            baseTitle: titleMetadata(input.metadata?.assetTitleBase, 80),
            sourceNodeId: titleMetadata(input.metadata?.assetTitleSourceNodeId, 80),
            sourceNodeTitle: titleMetadata(input.metadata?.assetTitleSourceNodeTitle, 80),
        };
    } catch {
        return {};
    }
}

function titleMetadata(value: unknown, maximumLength: number) {
    return typeof value === "string" ? Array.from(value.trim()).slice(0, maximumLength).join("") : "";
}

function cleanTitleSource(value: string, typeLabel: string) {
    const mentionFree = value
        .replace(/@\[[^\]]+\]/gu, " ")
        .replace(/@(图片|视频|音频|文本|角色|绘图)\d+/gu, " ")
        .replace(/[\u0000-\u001f\u007f]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .replace(new RegExp(`(?:\\s*[·|｜/\\-]\\s*)?(?:生成)?${escapeRegExp(typeLabel)}(?:\\s*[·|｜/\\-]\\s*\\d+)?$`, "iu"), "")
        .replace(/^[，。；：、,.!！?？\s]+|[，。；：、,.!！?？\s]+$/gu, "")
        .trim();
    return Array.from(mentionFree).slice(0, MAX_TITLE_SOURCE_LENGTH).join("");
}

function fallbackTimeLabel(value?: string) {
    const date = value ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
}

function stringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === "string" ? value : "";
}

function numberMetadata(metadata: Record<string, unknown> | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
