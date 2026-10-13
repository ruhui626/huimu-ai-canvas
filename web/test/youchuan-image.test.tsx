import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageSizePicker } from "../src/components/image-size-picker";
import { YouchuanImageSettingsPanel } from "../src/components/youchuan-image-settings";
import { defaultImageCapabilityConfig } from "../src/lib/model-capabilities";
import { youchuanImageOptions, youchuanNodeSettings } from "../src/lib/youchuan-image";
import { prepareBackendGenerationTask } from "../src/services/api/generation-task";
import { createModelChannel, defaultConfig, encodeChannelModel } from "../src/stores/use-config-store";
import { buildGenerationConfig } from "../src/lib/canvas/canvas-project-generation";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";
import { synchronizeGenerationSpec } from "../src/lib/canvas/generation-contract";
import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { canvasThemes } from "../src/lib/canvas-theme";
import { imageSizeForParameter } from "../src/lib/image-size-presets";
import { ImageRatioOnlyEditor } from "../src/components/image-size-presets-editor";

test("admin parameter switching restores seven ratios without relying on pixel presets", () => {
    const profile = defaultImageCapabilityConfig("youchuan-image", "v8.2");
    const ratios = ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3"];
    expect(profile.size.values).toEqual(ratios);
    for (const values of [["auto"], ["1024x1024"], ratios]) {
        const size = imageSizeForParameter({ ...profile, size: { parameter: "size", values, default: "auto", allowCustom: false } }, "aspect_ratio", ratios);
        expect(size.values).toEqual(ratios);
        expect(size.default).toBe("1:1");
        expect(size.presets).toBeUndefined();
        const html = renderToStaticMarkup(<ImageRatioOnlyEditor size={size} values={ratios} onChange={() => {}} />);
        expect(html).toContain('aria-label="默认输出"');
        for (const ratio of ratios) expect(html).toContain(`>${ratio}</button>`);
        expect(html).not.toContain('>自动</button>');
    }
    expect(imageSizeForParameter({ ...profile, size: { ...profile.size, default: "9:16" } }, "aspect_ratio", ratios).default).toBe("9:16");
});

test("Youchuan ratios use configured values without fabricated resolution tiers", () => {
    for (const model of ["v8.1", "v8.2", "v7", "niji-7"]) {
        const profile = defaultImageCapabilityConfig("youchuan-image", model);
        const html = renderToStaticMarkup(<ImageSizePicker profile={profile} size="16:9" ratioOnly onChange={() => {}} />);
        for (const ratio of profile.size.values) expect(html).toContain(`<span>${ratio}</span>`);
        expect(html).toMatch(/aria-pressed="true"[^]*?<span>16:9<\/span>/);
        expect(html).not.toContain("未配置预设尺寸");
        expect(html).not.toContain("1K");
        profile.size.values = ["1:1", "9:16"];
        const limited = renderToStaticMarkup(<ImageSizePicker profile={profile} size="9:16" ratioOnly onChange={() => {}} />);
        expect(limited).not.toContain("<span>16:9</span>");
    }
});

test("creative defaults and explicit zero survive node overrides and serialization", () => {
    expect(youchuanImageOptions({})).toEqual({ stylize: 100, weird: 50, chaos: 5 });
    expect(youchuanImageOptions({ youchuanWeird: "0", youchuanChaos: "0" })).toEqual({ stylize: 100, weird: 0, chaos: 0 });
    const saved = JSON.parse(JSON.stringify({ youchuanStylize: "0", youchuanWeird: "3000", youchuanChaos: "100" }));
    expect(youchuanImageOptions(youchuanNodeSettings({ youchuanStylize: "200" }, saved))).toEqual({ stylize: 0, weird: 3000, chaos: 100 });
    const html = renderToStaticMarkup(<YouchuanImageSettingsPanel config={saved} onChange={() => {}} />);
    for (const label of ["风格化程度", "怪异度", "多样性", "恢复默认值"]) expect(html).toContain(label);
    expect(html).not.toContain("高清");
});

test("canvas settings reach task metadata only for Youchuan, without changing count or billing", async () => {
    for (const protocol of ["youchuan-image", "openai-image"]) {
        const channel = createModelChannel({ id: "test", name: "test", baseUrl: "https://example.com", apiKey: "test", secretKey: "test", interfaceType: protocol, models: ["v8.2"], modelCosts: [{ model: "v8.2", capability: "image", protocol, billingMode: "fixed_request", unitPriceMicrocredits: 42 }] });
        const model = encodeChannelModel(channel.id, "v8.2");
        const config = { ...defaultConfig, channels: [channel], model, imageModel: model, youchuanStylize: "400", youchuanWeird: "10", youchuanChaos: "5" };
        const node = { id: "image", type: CanvasNodeType.Image, metadata: { model, size: "16:9" } } as CanvasNodeData;
        const updated = synchronizeGenerationSpec(node, { youchuanStylize: "0", youchuanWeird: "120", youchuanChaos: "8" });
        const selected = buildGenerationConfig(config, JSON.parse(JSON.stringify(updated)), "image");
        expect(selected.youchuanStylize).toBe("0");
        const task = await prepareBackendGenerationTask({ mode: "image", prompt: "cat", config: selected });
        const input = task.input as { metadata?: { providerOptions?: Record<string, unknown> }; config: { count: string; size: string } };
        expect(input.config.size).toBe("16:9");
        expect(input.config.count).toBe("1");
        if (protocol === "youchuan-image") expect(input.metadata?.providerOptions?.[protocol]).toEqual({ stylize: 0, weird: 120, chaos: 8 });
        else expect(input.metadata?.providerOptions?.["youchuan-image"]).toBeUndefined();
        expect(channel.modelCosts?.[0].unitPriceMicrocredits).toBe(42);
        const panel = renderToStaticMarkup(<ImageSettingsPanel config={selected} theme={Object.values(canvasThemes)[0]} onConfigChange={() => {}} onYouchuanChange={() => {}} />);
        expect(panel.includes("怪异度")).toBe(protocol === "youchuan-image");
    }
});
