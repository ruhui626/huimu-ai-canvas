import { buildVideoGenerationConfig } from "@/lib/video-generation-config";
import type { AiConfig } from "@/stores/use-config-store";
import type { CreationSettings } from "./creation-types";

// 创作台没有音频和水印开关；报价与提交共用所选模型的默认值和能力限制。
export function creationVideoConfig(config: AiConfig, model: string, settings: Pick<CreationSettings, "ratio" | "seconds" | "videoQuality">): AiConfig {
    return buildVideoGenerationConfig(config, model, {
        ratio: settings.ratio,
        seconds: settings.seconds,
        resolution: settings.videoQuality,
    });
}
