import { modelCapabilityConfigFor, normalizeVideoValue } from "@/lib/model-capabilities";
import { resolveModelVideoBooleanOptions } from "@/lib/model-selection";
import type { AiConfig } from "@/stores/use-config-store";

export type VideoGenerationSettings = {
    ratio: string;
    seconds: string;
    resolution: string;
    generateAudio?: string;
    watermark?: string;
};

export function buildVideoGenerationConfig(config: AiConfig, model: string, settings: VideoGenerationSettings): AiConfig {
    const profile = modelCapabilityConfigFor(config, model).video!;
    const normalized = normalizeVideoValue(profile, {
        ratio: settings.ratio,
        seconds: settings.seconds,
        resolution: settings.resolution,
    });
    return {
        ...config,
        model,
        videoModel: model,
        size: normalized.ratio,
        videoSeconds: normalized.seconds,
        vquality: normalized.resolution.replace(/p$/i, ""),
        ...resolveModelVideoBooleanOptions(
            config,
            model,
            {
                videoGenerateAudio: settings.generateAudio,
                videoWatermark: settings.watermark,
            },
            {
                videoGenerateAudio: config.videoGenerateAudio,
                videoWatermark: config.videoWatermark,
            },
        ),
    };
}
