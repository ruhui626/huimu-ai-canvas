import { expect, test } from "bun:test";
import { canvasMentionCategories, mentionMenuZIndex, scopedMentionCandidates } from "../src/components/canvas/canvas-mention-menu";
import type { CanvasResourceReference } from "../src/lib/canvas/canvas-resource-references";

const reference = (kind: CanvasResourceReference["kind"], active = false): CanvasResourceReference => ({ id: kind, nodeId: kind, kind, title: kind, label: kind, active });

test("canvas folders count unconnected nodes by kind and omit empty folders", () => {
    expect(canvasMentionCategories([reference("image"), reference("image"), reference("video"), reference("audio"), reference("text"), reference("character"), reference("video", true), reference("skill"), reference("tool")])).toEqual([
        { value: "canvas:image", label: "图片", count: 2 },
        { value: "canvas:video", label: "视频", count: 1 },
        { value: "canvas:audio", label: "音频", count: 1 },
        { value: "canvas:text", label: "文本", count: 1 },
        { value: "canvas:character", label: "角色", count: 1 },
    ]);
    expect(canvasMentionCategories([reference("image", true)])).toEqual([]);
    expect(canvasMentionCategories([])).toEqual([]);
});

test("menu keyboard selection uses displayed buttons instead of hidden global candidates", async () => {
    const menu = await Bun.file(new URL("../src/components/canvas/canvas-mention-menu.tsx", import.meta.url)).text();
    const editor = await Bun.file(new URL("../src/components/canvas/canvas-resource-mention-textarea.tsx", import.meta.url)).text();
    expect(menu).toContain('".canvas-resource-mention-scroll button"');
    expect(menu).not.toContain("selectReference(filteredReferences[0])");
    expect(editor).not.toContain("insertReference(candidates[");
    expect(editor.match(/menuKeyboardHandlerRef.current\?\.\(event\)/g)).toHaveLength(2);
    expect(menu).toContain("query ? searchReferences : canvasKind");
});

test("scope search separates node and asset identities and prioritizes connected nodes without mutation", () => {
    const node = { ...reference("image"), id: "node:1", assetId: "same-resource" };
    const connected = { ...reference("image", true), id: "node:2" };
    const asset = { ...node, id: "asset:1" };
    const candidates = [asset, node, connected];
    expect(scopedMentionCandidates(candidates, [node, connected])).toEqual([connected, node]);
    expect(scopedMentionCandidates(candidates, [asset])).toEqual([asset]);
    expect(scopedMentionCandidates(candidates, [])).toEqual([]);
    expect(candidates).toEqual([asset, node, connected]);
});

test("mention menu uses viewport space rather than modal bounds", async () => {
    const menu = await Bun.file(new URL("../src/components/canvas/canvas-mention-menu.tsx", import.meta.url)).text();
    expect(menu).toContain("const boundary = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }");
    expect(menu).not.toContain('anchor.closest(".ant-modal-container")?.getBoundingClientRect()');
    expect(menu).toContain("Math.min(320, showAbove ? spaceAbove : spaceBelow)");
});

test("mention menu follows actual modal layers and leaves ordinary editors unchanged", () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { getComputedStyle: (element: { layer: string }) => ({ zIndex: element.layer }) } });
    try {
        const ancestor = { layer: "auto", parentElement: null };
        const modal = { layer: "1200", parentElement: ancestor };
        const anchor = { closest: () => modal } as unknown as HTMLElement;
        expect(mentionMenuZIndex(anchor)).toBe(1201);
        modal.layer = "1500";
        expect(mentionMenuZIndex(anchor)).toBe(1501);
        ancestor.layer = "2000";
        expect(mentionMenuZIndex(anchor)).toBe(2001);
        expect(mentionMenuZIndex({ closest: () => null } as unknown as HTMLElement)).toBeUndefined();
    } finally {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
    }
});
