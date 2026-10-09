import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("canvas text count is not displayed or read from saved metadata", () => {
    const panel = readFileSync(new URL("../src/components/canvas/canvas-node-prompt-panel.tsx", import.meta.url), "utf8");
    const executor = readFileSync(new URL("../src/pages/canvas/canvas-text-generation-executor.ts", import.meta.url), "utf8");
    expect(panel).not.toContain("<InputNumber");
    expect(panel).not.toContain("文本生成份数");
    expect(executor).not.toContain("metadata?.textCount");
    expect(executor).toContain("const childIds = generateInPlace ? [] : [nanoid()]");
});
