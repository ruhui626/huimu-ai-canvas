import { expect, test } from "bun:test";
import { createModelChannel, defaultConfig, encodeChannelModel } from "../src/stores/use-config-store";
import { isSeedanceVideoConfig, shouldShowSeedanceFrameRatioHint } from "../src/lib/seedance-video";

function configFor(model: string, protocol: string) {
    return {
        ...defaultConfig,
        model: encodeChannelModel("test", model),
        channels: [createModelChannel({
            id: "test", models: [model], baseUrl: "https://example.com/v1",
            modelCosts: [{ model, protocol }],
        })],
    };
}

test("Seedance protocol aliases show the hint without changing generation detection", () => {
    for (const model of ["cdance2.0-0807", "cdance2.5-0807"]) {
        const config = configFor(model, "volcengine-ark-video");
        expect(shouldShowSeedanceFrameRatioHint(config)).toBe(true);
        expect(isSeedanceVideoConfig(config)).toBe(false);
    }
});

test("hint keeps named Seedance and Plan support, excludes unrelated video and image protocols", () => {
    expect(shouldShowSeedanceFrameRatioHint(configFor("endpoint-123", "volcengine-ark-agent-plan-video"))).toBe(true);
    expect(shouldShowSeedanceFrameRatioHint(configFor("seedance-2.5", "newapi"))).toBe(true);
    expect(shouldShowSeedanceFrameRatioHint(configFor("other-video", "minimax-video"))).toBe(false);
    expect(shouldShowSeedanceFrameRatioHint(configFor("seedance-image", "volcengine-ark-image"))).toBe(false);
});
