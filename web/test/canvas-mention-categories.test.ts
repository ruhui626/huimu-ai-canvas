import { expect, test } from "bun:test";
import { canvasMentionCategories } from "../src/components/canvas/canvas-mention-menu";
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
    expect(menu).toContain("query ? filteredReferences : canvasKind");
});
