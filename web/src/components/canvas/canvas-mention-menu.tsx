// @ 引用候选菜单：分组列表、预览与定位。

import { canvasReferenceDisplayName, type CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import { type KeyboardEvent, type MutableRefObject, type MouseEvent, type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import { type AssetCategory } from "@/stores/use-asset-store";
import { ASSET_CATEGORY_LABELS } from "@/lib/asset-category";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, FileText, Folder, Image as ImageIcon, Music2, Pencil, Search, UserRound, Video, Workflow } from "lucide-react";
import { CanvasNodeType } from "@/types/canvas";
import { primeVideoPreviewFrame } from "./canvas-mention-chips";
import { pointForOffset } from "./canvas-mention-editable";
import { CachedResourceImage } from "@/components/cached-resource-image";

export const CANVAS_MENTION_CATEGORIES = { image: "图片", video: "视频", audio: "音频", text: "文本", character: "角色" } as const;
type MentionCategory = AssetCategory | `canvas:${keyof typeof CANVAS_MENTION_CATEGORIES}`;
export type MentionMenuKeyboardHandler = (event: KeyboardEvent<HTMLElement>) => boolean;

export function scopedMentionCandidates(candidates: CanvasResourceReference[], sources: CanvasResourceReference[]) {
    const ids = new Set(sources.map((item) => item.id));
    return candidates.filter((item) => ids.has(item.id)).sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));
}

export function canvasMentionCategories(references: CanvasResourceReference[]) {
    return Object.entries(CANVAS_MENTION_CATEGORIES).map(([kind, label]) => ({
        value: `canvas:${kind}` as MentionCategory, label,
        count: references.filter((item) => !item.active && item.kind === kind).length,
    })).filter((item) => item.count > 0);
}

export function MentionMenu({
    anchor,
    connectedReferences,
    assetReferences,
    filteredReferences,
    query,
    cursorOffset,
    activeReferenceId,
    preferredWidth,
    onQueryChange,
    onClose,
    onSelect,
    keyboardHandlerRef,
    enableSourceScopes = false,
}: {
    anchor: HTMLElement;
    connectedReferences: CanvasResourceReference[];
    assetReferences: CanvasResourceReference[];
    filteredReferences: CanvasResourceReference[];
    query: string;
    cursorOffset: number;
    activeReferenceId?: string;
    preferredWidth: number;
    onQueryChange: (query: string) => void;
    onClose: () => void;
    onSelect: (reference: CanvasResourceReference) => void;
    keyboardHandlerRef: MutableRefObject<MentionMenuKeyboardHandler | null>;
    enableSourceScopes?: boolean;
}) {
    const menuRef = useRef<HTMLDivElement | null>(null);
    const selectedRef = useRef(false);
    const [category, setCategory] = useState<MentionCategory | null>(null);
    const [scope, setScope] = useState<"canvas" | "library">("canvas");
    const showCanvas = !enableSourceScopes || scope === "canvas";
    const showLibrary = !enableSourceScopes || scope === "library";
    const changeScope = (next: "canvas" | "library") => {
        setScope(next);
        setCategory(null);
        const scroll = menuRef.current?.querySelector(".canvas-resource-mention-scroll");
        if (scroll) scroll.scrollTop = 0;
        menuRef.current?.querySelector("input")?.focus();
    };
    const previousCategory = useRef(category);
    const [position, setPosition] = useState(() => mentionMenuPosition(anchor, cursorOffset, preferredWidth));

    useLayoutEffect(() => {
        let frame = 0;
        const updatePosition = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setPosition(mentionMenuPosition(anchor, cursorOffset, preferredWidth)));
        };
        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        observer.observe(anchor);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [anchor, cursorOffset, preferredWidth]);

    const stopCanvasInteraction = (event: PointerEvent | MouseEvent) => {
        event.stopPropagation();
    };
    const selectReference = (reference: CanvasResourceReference) => {
        if (selectedRef.current) return;
        selectedRef.current = true;
        window.setTimeout(() => { selectedRef.current = false; }, 0);
        onSelect(reference);
    };
    const categoryItems = Object.entries(ASSET_CATEGORY_LABELS)
        .map(([value, label]) => ({ value: value as AssetCategory, label, count: assetReferences.filter((item) => item.category === value).length }))
        .filter((item) => item.count > 0);
    const connectedNodes = connectedReferences.filter((item) => item.kind !== "skill" && item.active);
    const unconnectedNodes = connectedReferences.filter((item) => item.kind !== "skill" && !item.active);
    const skillReferences = connectedReferences.filter((item) => item.kind === "skill");
    const canvasCategories = canvasMentionCategories(unconnectedNodes);
    const canvasKind = category?.startsWith("canvas:") ? category.slice(7) as keyof typeof CANVAS_MENTION_CATEGORIES : null;
    const categoryLabel = canvasKind ? CANVAS_MENTION_CATEGORIES[canvasKind] : category ? ASSET_CATEGORY_LABELS[category as AssetCategory] : "";
    const searchReferences = enableSourceScopes ? scopedMentionCandidates(filteredReferences, scope === "canvas" ? connectedReferences : assetReferences) : filteredReferences;
    const visibleReferences = query ? searchReferences : canvasKind ? unconnectedNodes.filter((item) => item.kind === canvasKind) : category ? assetReferences.filter((item) => item.category === category) : [];
    const handleMenuKeyDown: MentionMenuKeyboardHandler = (event) => {
        if (event.nativeEvent.isComposing) return false;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            anchor.focus();
            return true;
        }
        const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(".canvas-resource-mention-scroll button") || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            event.stopPropagation();
            const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index < 0 ? buttons.length - 1 : (index - 1 + buttons.length) % buttons.length);
            buttons[next]?.focus();
            return true;
        }
        if (event.key === "Enter" && index < 0) {
            if (event.target instanceof Element && event.target.closest("[data-mention-scope-control]")) return false;
            event.preventDefault();
            event.stopPropagation();
            buttons[0]?.click();
            return true;
        }
        if (event.key === "Tab" && event.target === anchor) {
            event.preventDefault();
            buttons[0]?.focus();
            return true;
        }
        return false;
    };
    useLayoutEffect(() => {
        keyboardHandlerRef.current = handleMenuKeyDown;
        return () => { keyboardHandlerRef.current = null; };
    });
    useLayoutEffect(() => {
        if (previousCategory.current === category) return;
        previousCategory.current = category;
        menuRef.current?.querySelector<HTMLElement>(category ? ".canvas-resource-mention-back" : "input")?.focus();
    }, [category]);

    useLayoutEffect(() => {
        const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node) || menuRef.current?.contains(target) || anchor.contains(target)) return;
            onClose();
        };
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        return () => window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
    }, [anchor, onClose]);

    return createPortal(
        <div
            ref={menuRef}
            data-canvas-resource-mention-menu="true"
            className="canvas-resource-mention-menu fixed z-[var(--z-tooltip)]"
            data-placement={position.showAbove ? "top" : "bottom"}
            style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, transform: position.showAbove ? "translateY(-100%)" : undefined, zIndex: position.zIndex }}
            onPointerDown={stopCanvasInteraction}
            onMouseDown={stopCanvasInteraction}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { handleMenuKeyDown(event); event.stopPropagation(); }}
        >
            {enableSourceScopes ? <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-border p-2" role="group" aria-label="引用搜索范围">
                <button type="button" data-mention-scope-control aria-pressed={scope === "canvas"} className={`rounded-md px-2 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${scope === "canvas" ? "bg-muted font-semibold text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground opacity-60 hover:opacity-100"}`} onClick={() => changeScope("canvas")}>当前画布</button>
                <button type="button" data-mention-scope-control aria-pressed={scope === "library"} className={`rounded-md px-2 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${scope === "library" ? "bg-muted font-semibold text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground opacity-60 hover:opacity-100"}`} onClick={() => changeScope("library")}>我的素材库</button>
            </div> : null}
            <div className="canvas-resource-mention-search">
                <Search aria-hidden />
                <input
                    value={query}
                    placeholder={enableSourceScopes ? scope === "canvas" ? "搜索当前画布节点或技能" : "搜索我的素材库" : "搜索节点、素材或技能"}
                    aria-label="搜索引用素材"
                    onChange={(event) => onQueryChange(event.target.value)}
                    onPointerDown={(event) => event.stopPropagation()}
                />
            </div>
            {enableSourceScopes && scope === "library" ? <p className="shrink-0 px-3 pb-1 text-xs text-muted-foreground">跨画布素材，仅搜索当前已加载内容</p> : null}
            <div className="canvas-resource-mention-scroll thin-scrollbar">
                {query ? (
                    <MentionReferenceList references={visibleReferences} activeReferenceId={activeReferenceId} onSelect={selectReference} />
                ) : category ? (
                    <>
                        <button type="button" className="canvas-resource-mention-back" onClick={() => setCategory(null)}>
                            <ArrowLeft aria-hidden />
                            <span>{categoryLabel}</span>
                            <small>{visibleReferences.length}</small>
                        </button>
                        <MentionReferenceList references={visibleReferences} activeReferenceId={activeReferenceId} onSelect={selectReference} />
                    </>
                ) : (
                    <>
                        {showCanvas && connectedNodes.length ? (
                            <section className="canvas-resource-mention-section">
                                <h4>
                                    <span>已添加参考</span>
                                    <small>{connectedNodes.length}</small>
                                </h4>
                                <MentionReferenceList references={connectedNodes} activeReferenceId={activeReferenceId} onSelect={selectReference} />
                            </section>
                        ) : null}
                        {showCanvas ? <section className="canvas-resource-mention-section">
                            <h4><span>当前画布</span><small>{unconnectedNodes.length}</small></h4>
                            {canvasCategories.length ? canvasCategories.map((item) => (
                                <button key={item.value} type="button" className="canvas-resource-mention-folder" onClick={() => setCategory(item.value)}>
                                    <Folder aria-hidden /><span>{item.label}</span><small>{item.count}</small><ChevronRight aria-hidden />
                                </button>
                            )) : <p className="px-3 text-xs opacity-60">暂无其他可引用节点</p>}
                        </section> : null}
                        {showCanvas && skillReferences.length ? (
                            <section className="canvas-resource-mention-section">
                                <h4>
                                    <span>技能库</span>
                                    <small>{skillReferences.length}</small>
                                </h4>
                                <MentionReferenceList references={skillReferences} activeReferenceId={activeReferenceId} onSelect={selectReference} />
                            </section>
                        ) : null}
                        {showLibrary && categoryItems.length ? (
                            <section className="canvas-resource-mention-section">
                                <h4>
                                    <span>我的素材库</span>
                                    <small>{assetReferences.length}</small>
                                </h4>
                                {categoryItems.map((item) => (
                                    <button key={item.value} type="button" className="canvas-resource-mention-folder" onClick={() => setCategory(item.value)}>
                                        <Folder aria-hidden />
                                        <span>{item.label}</span>
                                        <small>{item.count}</small>
                                        <ChevronRight aria-hidden />
                                    </button>
                                ))}
                            </section>
                        ) : null}
                        {enableSourceScopes && scope === "library" && !categoryItems.length ? <p className="px-3 text-xs text-muted-foreground">暂无已加载的可引用素材</p> : null}
                    </>
                )}
                {enableSourceScopes && scope === "canvas" && (query ? !visibleReferences.length : !connectedNodes.length && !unconnectedNodes.length && !skillReferences.length) ? <button type="button" data-mention-scope-control className="canvas-resource-mention-folder" onClick={() => changeScope("library")}>去我的素材库搜索<ChevronRight aria-hidden /></button> : null}
            </div>
        </div>,
        document.body,
    );
}

export function MentionReferenceList({ references, activeReferenceId, onSelect }: { references: CanvasResourceReference[]; activeReferenceId?: string; onSelect: (reference: CanvasResourceReference) => void }) {
    const activeRef = useRef<HTMLButtonElement | null>(null);

    useLayoutEffect(() => {
        activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [activeReferenceId]);

    if (!references.length) return <div className="canvas-resource-mention-empty">没有匹配的引用</div>;
    return references.map((reference) => (
        <button
            key={reference.id}
            ref={reference.id === activeReferenceId ? activeRef : null}
            type="button"
            className={`canvas-resource-mention-item ${reference.kind === "skill" ? "is-skill" : ""} ${reference.id === activeReferenceId ? "is-active" : ""}`}
            aria-selected={reference.id === activeReferenceId}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(reference);
            }}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.detail === 0) onSelect(reference);
            }}
        >
            <ReferencePreview reference={reference} />
            <span className="canvas-resource-mention-copy">
                <span className="canvas-resource-mention-title-row">
                    <strong title={canvasReferenceDisplayName(reference)}>{canvasReferenceDisplayName(reference)}</strong>
                    {reference.kind === "skill" ? <em>技能</em> : null}
                </span>
                {reference.kind !== "skill" ? <span className="canvas-resource-mention-meta">{reference.assetId ? "素材库" : `${reference.label} · ${reference.active ? "已连接" : "选择后连接"}`}</span> : null}
                {reference.kind === "skill" ? (
                    <span className="canvas-resource-mention-meta">
                        <span>{reference.skill?.description || reference.text || "工作流技能"}</span>
                        <small>
                            {reference.skill?.version ? `v${reference.skill.version}` : ""}
                            {reference.skill?.fileCount ? ` · ${reference.skill.fileCount} 文件` : ""}
                        </small>
                    </span>
                ) : reference.text && reference.text !== reference.title ? (
                    <span className="canvas-resource-mention-meta">
                        <span>{reference.text}</span>
                    </span>
                ) : null}
            </span>
        </button>
    ));
}

export function ReferencePreview({ reference }: { reference: CanvasResourceReference }) {
    const previewStorageKey = reference.kind === "video" ? reference.previewStorageKey : reference.storageKey;
    const visualReference = reference.kind === "image" || reference.kind === "video" || reference.kind === "character";
    const fallback = <ReferencePreviewFallback reference={reference} />;
    if (visualReference && (reference.previewUrl || previewStorageKey)) {
        return (
            <span className={`canvas-resource-mention-preview is-${reference.kind}`}>
                <CachedResourceImage
                    storageKey={previewStorageKey}
                    src={reference.previewUrl}
                    alt=""
                    eager
                    loading={reference.kind === "video" ? "lazy" : undefined}
                    decoding={reference.kind === "video" ? "async" : undefined}
                    className={reference.kind === "character" ? "size-full object-contain" : "size-full object-cover"}
                    wrapperClassName="size-full"
                    fallback={fallback}
                    loadingFallback={fallback}
                />
            </span>
        );
    }
    if (reference.kind === "video" && reference.mediaUrl) {
        return <video src={reference.mediaUrl} aria-hidden="true" muted playsInline preload="metadata" className="canvas-resource-mention-preview is-video" onLoadedMetadata={(event) => primeVideoPreviewFrame(event.currentTarget)} />;
    }
    if (reference.kind === "skill") {
        return (
            <span className="canvas-resource-mention-preview is-skill">
                <Workflow aria-hidden />
            </span>
        );
    }
    return fallback;
}

function ReferencePreviewFallback({ reference }: { reference: CanvasResourceReference }) {
    const Icon = reference.sourceType === CanvasNodeType.Drawing ? Pencil : reference.kind === "character" ? UserRound : reference.kind === "audio" ? Music2 : reference.kind === "video" ? Video : reference.kind === "image" ? ImageIcon : FileText;
    return (
        <span className="canvas-resource-mention-preview is-fallback">
            <Icon aria-hidden />
        </span>
    );
}

export type MentionAnchorRect = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;

export function mentionMenuZIndex(anchor: HTMLElement): number | undefined {
    const modal = anchor.closest(".ant-modal-wrap");
    if (!modal) return undefined;
    // 菜单挂在 body，必须高于弹窗实际层级（AntD 嵌套浮层会叠加层级）。
    let highest = 0;
    for (let element: Element | null = modal; element; element = element.parentElement) {
        const layer = Number.parseFloat(window.getComputedStyle(element).zIndex);
        if (Number.isFinite(layer)) highest = Math.max(highest, layer);
    }
    return highest + 1;
}

export function mentionMenuPosition(anchor: HTMLElement, cursorOffset: number, preferredWidth: number) {
    const caret = mentionCaretRect(anchor, cursorOffset);
    // 菜单挂在 body，普通与展开编辑器统一使用视口空间，不受弹窗高度限制。
    const boundary = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const inset = 8;
    const gap = 8;
    const availableWidth = Math.max(0, boundary.right - boundary.left - inset * 2);
    const width = Math.min(preferredWidth, availableWidth);
    const left = clamp(caret.left, boundary.left + inset, boundary.right - width - inset);
    const spaceAbove = Math.max(0, caret.top - boundary.top - gap - inset);
    const spaceBelow = Math.max(0, boundary.bottom - caret.bottom - gap - inset);
    const showAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(320, showAbove ? spaceAbove : spaceBelow);
    const top = showAbove ? caret.top - gap : caret.bottom + gap;
    return { left, top, width, maxHeight, showAbove, zIndex: mentionMenuZIndex(anchor) };
}

export function mentionCaretRect(anchor: HTMLElement, cursorOffset: number): MentionAnchorRect {
    if (anchor instanceof HTMLTextAreaElement) return textareaCaretRect(anchor, cursorOffset);
    const point = pointForOffset(anchor, cursorOffset);
    const range = document.createRange();
    range.setStart(point.node, point.offset);
    range.collapse(true);
    const rangeRect = range.getClientRects()[0] || range.getBoundingClientRect();
    if (rangeRect && (rangeRect.height || rangeRect.width)) return rangeRect;
    return fallbackCaretRect(anchor);
}

export function textareaCaretRect(textarea: HTMLTextAreaElement, cursorOffset: number): MentionAnchorRect {
    const rect = textarea.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const marker = document.createElement("span");
    const copiedProperties = [
        "boxSizing",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "fontFamily",
        "fontSize",
        "fontStyle",
        "fontVariant",
        "fontWeight",
        "fontStretch",
        "lineHeight",
        "letterSpacing",
        "textAlign",
        "textIndent",
        "textTransform",
        "wordSpacing",
        "tabSize",
        "wordBreak",
        "overflowWrap",
    ] as const;
    copiedProperties.forEach((property) => {
        mirror.style[property] = computed[property];
    });
    Object.assign(mirror.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: "auto",
        minHeight: "0",
        maxHeight: "none",
        overflow: "hidden",
        visibility: "hidden",
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        zIndex: "-1",
    });
    mirror.append(document.createTextNode(textarea.value.slice(0, Math.max(0, cursorOffset))));
    marker.textContent = "\u200b";
    mirror.append(marker);
    document.body.append(mirror);
    const markerRect = marker.getBoundingClientRect();
    mirror.remove();

    const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.4 || 20;
    const top = clamp(markerRect.top - textarea.scrollTop, rect.top, rect.bottom - lineHeight);
    const left = clamp(markerRect.left - textarea.scrollLeft, rect.left, rect.right);
    return { left, right: left, top, bottom: top + lineHeight, width: 0, height: lineHeight };
}

export function fallbackCaretRect(anchor: HTMLElement): MentionAnchorRect {
    const rect = anchor.getBoundingClientRect();
    const computed = window.getComputedStyle(anchor);
    const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.4 || 20;
    const left = rect.left + Number.parseFloat(computed.paddingLeft || "0");
    const top = rect.top + Number.parseFloat(computed.paddingTop || "0");
    return { left, right: left, top, bottom: top + lineHeight, width: 0, height: lineHeight };
}

export function clamp(value: number, min: number, max: number) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}
