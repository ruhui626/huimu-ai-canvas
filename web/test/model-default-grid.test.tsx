import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelDefaultGrid } from "../src/pages/settings/model-default-grid";
import { createModelChannel, defaultConfig, normalizeConfigSnapshot } from "../src/stores/use-config-store";

test("default model cards distinguish grouped versions and channels without changing selection", () => {
    const channels = ["1", "2"].map((id) => createModelChannel({
        id, name: `Midjourney-渠道${id}`, scope: "system", interfaceType: "youchuan-image",
        models: ["v8.2", "v8.1", "v7", "niji-7"],
        modelCosts: ["v8.2", "v8.1", "v7", "niji-7"].map((model) => ({
            model, displayName: `Midjourney-渠道${id}`, channelLabel: model,
            capability: "image", protocol: "youchuan-image", billingMode: "fixed_request", unitPriceMicrocredits: 600000,
        })),
    }));
    const config = normalizeConfigSnapshot({ config: { ...defaultConfig, channels, imageModel: "2::v8.1" } }).config;
    const html = renderToStaticMarkup(<ModelDefaultGrid config={config} onChange={() => {}} />);
    for (const channel of channels) {
        for (const model of channel.models) expect(html).toContain(`title="${channel.name} · ${model}"`);
    }
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^]*?title="Midjourney-渠道2 · v8.1"/);
    expect(config.imageModel).toBe("2::v8.1");
});

test("personal models and repeated labels keep their original display names", () => {
    for (const scope of ["user", "system"] as const) {
        const channel = createModelChannel({
            id: "test", name: "渠道", scope, interfaceType: "youchuan-image", models: ["v7"],
            modelCosts: [{ model: "v7", displayName: "Midjourney V7", channelLabel: scope === "user" ? "另一个名称" : "Midjourney V7", capability: "image", billingMode: "fixed_request", unitPriceMicrocredits: 0 }],
        });
        const config = normalizeConfigSnapshot({ config: { ...defaultConfig, channels: [channel] } }).config;
        const html = renderToStaticMarkup(<ModelDefaultGrid config={config} onChange={() => {}} />);
        expect(html).toContain('title="Midjourney V7"');
        expect(html).not.toContain("Midjourney V7 ·");
    }
});
