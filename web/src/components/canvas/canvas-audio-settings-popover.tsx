import { AudioSettingsPanel } from "@/components/audio-settings-panel";
import { audioFormatLabelForConfig, audioSpeedForConfig, audioSpeedLabel, audioVoiceLabelForConfig, isDoubaoAudioConfig } from "@/lib/audio-generation";
import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import type { AiConfig } from "@/stores/use-config-store";
import { CanvasSettingsPopover, type CanvasSettingsPlacement } from "./canvas-settings-popover";

export type CanvasAudioSettingKey = "audioVoice" | "audioFormat" | "audioSpeed" | "audioSampleRate" | "audioPitch" | "audioVolume" | "audioLanguage" | "audioDialect" | "audioInstructions" | "audioEmotionControlMethod" | "audioEmotionRandom" | "audioEmotionHappy" | "audioEmotionAngry" | "audioEmotionSad" | "audioEmotionAfraid" | "audioEmotionDisgusted" | "audioEmotionMelancholic" | "audioEmotionSurprised" | "audioEmotionCalm";
type AudioPopoverProps = { config: AiConfig; onConfigChange: (key: CanvasAudioSettingKey, value: string) => void; onReset?: () => void; buttonClassName?: string; placement?: CanvasSettingsPlacement };

export function CanvasAudioSettingsPopover({ config, onConfigChange, onReset, ...popover }: AudioPopoverProps) {
    const theme = canvasThemes[useActiveTheme()];
    const parts = [audioFormatLabelForConfig(config, config.audioFormat), audioSpeedLabel(audioSpeedForConfig(config))];
    if (!isDoubaoAudioConfig(config)) parts.unshift(audioVoiceLabelForConfig(config, config.audioVoice) || "不指定音色");
    return <CanvasSettingsPopover {...popover} label="音频设置" summary={parts.join(" · ")}>
        <AudioSettingsPanel config={config} onConfigChange={onConfigChange} onReset={onReset} theme={theme} className="space-y-4" />
    </CanvasSettingsPopover>;
}
