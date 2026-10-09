import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { canvasReferenceDisplayName, canvasResourceMentionToken, normalizeCanvasNodeMentionTokens, type CanvasResourceReference } from "../src/lib/canvas/canvas-resource-references";
import { syncInlineMentionPreviews } from "../src/components/canvas/canvas-mention-chips";

const reference: CanvasResourceReference = { id: "apple", nodeId: "apple", kind: "image", title: "绿色苹果", label: "图片2", active: true, mentionToken: "@[node:apple]" };

test("名称优先，空名称回退编号，不截断底层名称", () => {
    expect(canvasReferenceDisplayName(reference)).toBe("绿色苹果");
    expect(canvasReferenceDisplayName({ ...reference, title: "  " })).toBe("图片2");
    const title = "很长的素材名称".repeat(40);
    expect(canvasReferenceDisplayName({ ...reference, title })).toBe(title);
});

test("重名和改名不改变引用身份及模型编号转换", () => {
    const renamed = { ...reference, title: "苹果特写" };
    const duplicate = { ...renamed, id: "other", nodeId: "other", label: "图片3", mentionToken: "@[node:other]" };
    expect(canvasReferenceDisplayName(renamed)).toBe(canvasReferenceDisplayName(duplicate));
    expect(canvasResourceMentionToken(renamed)).toBe(canvasResourceMentionToken(reference));
    expect(canvasResourceMentionToken(duplicate)).not.toBe(canvasResourceMentionToken(reference));
    expect(normalizeCanvasNodeMentionTokens("@[node:apple] 转动", [renamed])).toBe("@图片2 转动");
});

test("无需重写编辑器或令牌即可刷新改名和悬停名称", () => {
    const label = { textContent: "旧名称" };
    const chip = {
        dataset: { mentionReferenceId: reference.id, mentionToken: reference.mentionToken },
        title: "",
        querySelector: (selector: string) => selector === ".canvas-resource-inline-label" ? label : null,
    };
    const editor = { querySelectorAll: () => [chip] } as unknown as HTMLElement;
    syncInlineMentionPreviews(editor, [reference]);
    expect(label.textContent).toBe("绿色苹果");
    expect(chip.title).toContain("绿色苹果 · 图片2");
    syncInlineMentionPreviews(editor, [{ ...reference, title: "改名后", label: "图片1" }]);
    expect(label.textContent).toBe("改名后");
    expect(chip.title).toContain("改名后 · 图片1");
    expect(chip.dataset.mentionToken).toBe("@[node:apple]");
});

test("输入标签、候选菜单和参考卡片共用名称规则，序列化仍读取令牌", () => {
    for (const file of ["canvas-mention-chips.tsx", "canvas-mention-menu.tsx", "canvas-node-prompt-references.tsx"]) {
        expect(readFileSync(`${import.meta.dir}/../src/components/canvas/${file}`, "utf8")).toContain("canvasReferenceDisplayName(reference)");
    }
    const editable = readFileSync(`${import.meta.dir}/../src/components/canvas/canvas-mention-editable.ts`, "utf8");
    expect(editable).toContain("if (token) return token;");
});

test("参考区隐藏常驻名称但保留悬停名称和插入操作", () => {
    const source = readFileSync(`${import.meta.dir}/../src/components/canvas/canvas-node-prompt-references.tsx`, "utf8");
    expect(source).not.toContain('<span className="truncate">{displayName}</span>');
    expect(source).toContain('<AtSign className="size-3.5 opacity-55" aria-hidden="true" />');
    expect(source).toContain('aria-label={`插入 @${displayName} · ${reference.label}`}');
    expect(source).toContain('onClick={() => onInsert(reference)}');
    expect(source).toContain('title={`${displayName} · ${reference.label}');
});
