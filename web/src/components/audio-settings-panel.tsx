import { useId } from "react";
import { Input, InputNumber, Radio } from "antd";
import { Select } from "@/components/ui/base/select";
import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { audioFormatOptionsForConfig, audioSpeedForConfig, audioSpeedLabel, audioVoiceOptionsForConfig, doubaoAudioOptions, doubaoSampleRates, isDoubaoAudioConfig, isMiniMaxAudioConfig, normalizeAudioFormatForConfig, normalizeAudioSpeedValue, normalizeAudioVoiceForConfig } from "@/lib/audio-generation";
import type { CanvasTheme } from "@/lib/canvas-theme";
import type { AiConfig } from "@/stores/use-config-store";
import type { CanvasAudioSettingKey } from "@/components/canvas/canvas-audio-settings-popover";

type AudioSettingsPanelProps = { config: AiConfig; onConfigChange: (key: CanvasAudioSettingKey, value: string) => void; onReset?: () => void; theme: CanvasTheme; showTitle?: boolean; className?: string };

export function AudioSettingsPanel({ config, onConfigChange, onReset, theme, showTitle = true, className = "w-[var(--panel-width-compact)] space-y-4" }: AudioSettingsPanelProps) {
    const listId = useId();
    const streaming = isDoubaoAudioConfig(config);
    const isMiniMax = isMiniMaxAudioConfig(config);
    const voice = normalizeAudioVoiceForConfig(config, config.audioVoice);
    const voices = audioVoiceOptionsForConfig(config);
    const currentVoice = voices.some((item) => item.value === voice) ? voices : [{ value: voice, label: voice || "不指定音色" }, ...voices];
    const formats = audioFormatOptionsForConfig(config);
    const format = normalizeAudioFormatForConfig(config, config.audioFormat);
    const speed = audioSpeedForConfig(config);
    const doubaoOptions = doubaoAudioOptions(config);
    const selectVoice = (value: string) => onConfigChange("audioVoice", value);
    return (
        <ImageSettingsTheme theme={theme}>
            <section className={className} style={{ color: theme.node.text }} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} aria-label="音频生成参数">
                {showTitle ? <h3 className="text-base font-semibold">音频设置</h3> : null}
                <fieldset className="space-y-2">
                    <legend className="mb-2 text-xs" style={{ color: theme.node.muted }}>
                        {streaming ? "声音参考" : isMiniMax ? "MiniMax 音色" : "音色"}
                    </legend>
                    {streaming ? (
                        <>
                            <p className="text-xs leading-5" style={{ color: theme.node.muted }}>
                                无参考素材时按提示词生成；可连接最多 3 段音频或 1 张图片，图片与音频不能混用。
                            </p>
                            {voice ? <p className="text-xs">当前指定音色：{voice} <button type="button" className="underline" onClick={() => selectVoice("")}>清除</button></p> : null}
                        </>
                    ) : (
                        <>
                            {!isMiniMax ? (
                                <>
                                    <Input aria-label="渠道音色 ID" value={config.audioVoice || ""} list={listId} placeholder="输入渠道音色 ID" onChange={(event) => selectVoice(event.target.value)} />
                                    <datalist id={listId}>
                                        {currentVoice.map((item) => (
                                            <option value={item.value} key={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </datalist>
                                </>
                            ) : null}
                            <Radio.Group aria-label="常用音色" value={voice} onChange={(event) => selectVoice(event.target.value)} options={currentVoice} className="flex flex-wrap gap-2" />
                        </>
                    )}
                </fieldset>
                <fieldset>
                    <legend className="mb-2 text-xs" style={{ color: theme.node.muted }}>
                        音频格式
                    </legend>
                    <Radio.Group aria-label="音频格式" value={format} options={formats} onChange={(event) => onConfigChange("audioFormat", event.target.value)} className="flex flex-wrap gap-2" />
                </fieldset>
                <fieldset className="space-y-2">
                    <legend className="mb-2 text-xs" style={{ color: theme.node.muted }}>
                        语速
                    </legend>
                    <Radio.Group aria-label="常用语速" value={speed} options={["0.75", "1", "1.25", "1.5"].map((value) => ({ value, label: audioSpeedLabel(value) }))} onChange={(event) => onConfigChange("audioSpeed", event.target.value)} />
                    <InputNumber
                        aria-label="自定义语速"
                        min={streaming ? 0.5 : 0.25}
                        max={streaming ? 2 : 4}
                        step={0.05}
                        value={Number(speed)}
                        className="w-full"
                        onChange={(value) => {
                            if (value !== null) onConfigChange("audioSpeed", normalizeAudioSpeedValue(String(value)));
                        }}
                    />
                </fieldset>
                {streaming ? (
                    <details className="space-y-3">
                        <summary className="cursor-pointer text-sm">高级设置</summary>
                        <label className="flex flex-col gap-2 text-xs">
                            采样率
                            <Select ariaLabel="采样率" value={String(doubaoOptions.sample_rate)} onChange={(value) => onConfigChange("audioSampleRate", value)} options={doubaoSampleRates.map((value) => ({ value: String(value), label: `${value / 1000} kHz` }))} />
                        </label>
                        <label className="flex flex-col gap-2 text-xs">
                            音调（0 为不调整）
                            <InputNumber aria-label="音调" min={-12} max={12} step={1} value={doubaoOptions.pitch_rate} onChange={(value) => { if (value !== null) onConfigChange("audioPitch", String(value)); }} />
                        </label>
                        <label className="flex flex-col gap-2 text-xs">
                            音量倍率（1 为不调整）
                            <InputNumber aria-label="音量倍率" min={0.5} max={2} step={0.05} value={1 + doubaoOptions.loudness_rate / 100} onChange={(value) => { if (value !== null) onConfigChange("audioVolume", String(value)); }} />
                        </label>
                        {onReset ? <button type="button" className="text-sm underline" onClick={onReset}>恢复默认设置</button> : null}
                    </details>
                ) : null}
                {!streaming && !isMiniMax ? (
                    <label className="flex flex-col gap-2 text-xs" style={{ color: theme.node.muted }}>
                        声音指令
                        <Input.TextArea aria-label="声音指令" rows={3} value={config.audioInstructions || ""} placeholder="例如：自然、温暖的旁白" onChange={(event) => onConfigChange("audioInstructions", event.target.value)} />
                    </label>
                ) : null}
            </section>
        </ImageSettingsTheme>
    );
}
