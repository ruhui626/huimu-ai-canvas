import { expect, test } from "bun:test";

import { buildQuickVideoPrompt, quickVideoRoles } from "../src/pages/quick-video/quick-video-strategies";

test("快速成片为三种类型提供对应素材入口", () => {
    expect(quickVideoRoles("selling")).toEqual(["product", "person", "reference"]);
    expect(quickVideoRoles("commercial")).toEqual(["product", "person", "reference"]);
    expect(quickVideoRoles("store")).toEqual(["store", "feature", "person", "reference"]);
});

test("关闭人物出镜后提示词不再要求参考人物出现", () => {
    const prompt = buildQuickVideoPrompt({
        category: "selling",
        description: "突出便携咖啡的浓郁口感",
        language: "zh",
        personOnScreen: false,
        imageRoles: ["product"],
    });
    expect(prompt).toContain("带货视频");
    expect(prompt).toContain("不安排人物出镜");
    expect(prompt).toContain("商品图 1 张");
    expect(prompt).toContain("突出便携咖啡的浓郁口感");
});

test("英文模式明确约束口播、字幕和可读文案", () => {
    const prompt = buildQuickVideoPrompt({
        category: "store",
        description: "Show the signature dishes",
        language: "en",
        personOnScreen: true,
        imageRoles: ["store", "feature", "person"],
    });
    expect(prompt).toContain("use English only");
    expect(prompt).toContain("参考人物需要自然出镜");
    expect(prompt).toContain("门店图 1 张");
});
