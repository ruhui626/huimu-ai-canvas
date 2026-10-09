import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { defaultModelCapabilityConfig, normalizeModelCapabilityConfig, normalizeVideoValue } from "../src/lib/model-capabilities";
import { videoSizeLabel } from "../src/components/video-settings-panel";
import { videoDimensionsForRatioAndResolution } from "../src/lib/video-generation-options";

test("configured adaptive ratio survives save, reload and selection", () => {
    const config = defaultModelCapabilityConfig("volcengine-ark-video", "test-video");
    config.video!.ratios = ["16:9", "adaptive"];
    config.video!.defaultRatio = "adaptive";
    const profile = normalizeModelCapabilityConfig(JSON.parse(JSON.stringify(config))).video!;
    expect(profile.defaultRatio).toBe("adaptive");
    expect(normalizeVideoValue(profile, { ratio: "adaptive", resolution: "720p", seconds: "6" }).ratio).toBe("adaptive");
    expect(normalizeVideoValue(profile, { ratio: "16:9" }).ratio).toBe("16:9");
    expect(videoSizeLabel("adaptive")).toBe("自适应");
    expect(videoDimensionsForRatioAndResolution("adaptive", "720p")).toBeUndefined();
});

test("model without adaptive keeps its declared fallback", () => {
    const profile = defaultModelCapabilityConfig("volcengine-ark-video", "test-video").video!;
    profile.ratios = ["16:9"];
    profile.defaultRatio = "16:9";
    expect(normalizeVideoValue(profile, { ratio: "adaptive" }).ratio).toBe("16:9");
    expect(profile.ratios).toEqual(["16:9"]);
});

test("admin exposes adaptive only for video and creation displays its label", () => {
    const editor = readFileSync(new URL("../src/components/model-capability-editor.tsx", import.meta.url), "utf8");
    expect(editor).toContain('const ratioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]');
    expect(editor).toContain('label: "自适应", value: "adaptive"');
    // The admin dialog uses section="protocol", not the combined editor below it.
    const videoEditor = editor.slice(editor.indexOf('if (section === "protocol")'), editor.indexOf("function ImageCapabilityEditor"));
    const protocolPanel = videoEditor.slice(0, videoEditor.indexOf("<CapabilityBlock"));
    expect(protocolPanel).toContain('label="支持比例"');
    expect(protocolPanel).toContain("options={videoRatioOptions}");
    expect(videoEditor.match(/options=\{videoRatioOptions\}/g)).toHaveLength(2);
    expect(videoEditor.match(/label: item === "adaptive" \? "自适应" : item/g)).toHaveLength(2);
    const creation = readFileSync(new URL("../src/pages/create/creation-workspace.tsx", import.meta.url), "utf8");
    expect(creation).toContain("videoSizeLabel(props.ratio)");
    expect(creation).toContain("videoSizeLabel(value)");
});
