import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { canvasThemes } from "../src/lib/canvas-theme";
import { defaultImageCapabilityConfig, normalizeImageValue } from "../src/lib/model-capabilities";
import { isYouchuanImage } from "../src/lib/youchuan-image";
import { prepareBackendGenerationTask } from "../src/services/api/generation-task";
import { createModelChannel, defaultConfig, encodeChannelModel } from "../src/stores/use-config-store";

test("RunningHub uses its own limits, ratios and filtered shared controls", async () => {
    const protocol = "runninghub-youchuan-image";
    for (const [name, limit] of [["v8.1", 8130], ["v8.2", 5850], ["v7", 8192]] as const) {
        const profile = defaultImageCapabilityConfig(protocol, name);
        expect(profile.references.maxImages).toBe(1);
        expect(profile.references.promptMaxChars).toBe(limit);
        expect(profile.maxOutputs).toBe(1);
        expect(profile.quality.supported).toBe(false);
        const channel = createModelChannel({ id: "rh", name: "RunningHub", baseUrl: "https://www.runninghub.ai", apiKey: "test", interfaceType: protocol, models: [name], modelCosts: [{ model: name, capability: "image", protocol, billingMode: "fixed_request", unitPriceMicrocredits: 123 }] });
        const model = encodeChannelModel(channel.id, name);
        const config = { ...defaultConfig, channels: [channel], model, imageModel: model, size: "16:9", count: "4", youchuanStylize: "0", youchuanWeird: "0", youchuanChaos: "0" };
        expect(isYouchuanImage(config)).toBe(true);
        const normalized = normalizeImageValue(profile, config);
        expect(normalized.count).toBe("1");
        const task = await prepareBackendGenerationTask({ mode: "image", prompt: "cat", config: { ...config, ...normalized } });
        const input = task.input as { config: { count: string; size: string; secretKey?: string }; metadata: { providerOptions: Record<string, unknown> } };
        expect(input.config.count).toBe("1");
        expect(input.config.size).toBe("16:9");
        expect(input.metadata.providerOptions[protocol]).toEqual(name === "v8.1" ? { stylize: 0, chaos: 0 } : { stylize: 0, chaos: 0, weird: 0 });
        expect(input.metadata.providerOptions["youchuan-image"]).toBeUndefined();
        expect(channel.modelCosts?.[0].unitPriceMicrocredits).toBe(123);
        const html = renderToStaticMarkup(<ImageSettingsPanel config={config} theme={Object.values(canvasThemes)[0]} onConfigChange={() => {}} onYouchuanChange={() => {}} />);
        expect(html).toContain("风格化程度");
        expect(html).toContain("多样性");
        expect(html.includes("怪异度")).toBe(name !== "v8.1");
        expect(html).not.toContain("每次一组 4 张");
        expect(html).toContain("最多一张普通参考图");
        for (const ratio of profile.size.values) expect(html).toContain(`<span>${ratio}</span>`);
    }
    expect(defaultImageCapabilityConfig("youchuan-image", "v8.2").references.maxImages).toBe(20);
});
