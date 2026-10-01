import { doubaoAudioVoiceOptions, doubaoDefaultAudioVoice } from "@/lib/doubao-audio-voices";
import { resolveModelRequestConfig } from "@/stores/use-config-store";
import type { AiConfig } from "@/stores/use-config-store";

export { doubaoAudioVoiceOptions, doubaoDefaultAudioVoice };

export const openAIAudioVoiceOptions = [
    { value: "alloy", label: "Alloy" },
    { value: "ash", label: "Ash" },
    { value: "ballad", label: "Ballad" },
    { value: "coral", label: "Coral" },
    { value: "echo", label: "Echo" },
    { value: "fable", label: "Fable" },
    { value: "nova", label: "Nova" },
    { value: "onyx", label: "Onyx" },
    { value: "sage", label: "Sage" },
    { value: "shimmer", label: "Shimmer" },
    { value: "verse", label: "Verse" },
    { value: "marin", label: "Marin" },
    { value: "cedar", label: "Cedar" },
];

export const minimaxVoiceOptions = [
    { value: "male-qn-qingse", label: "青涩青年" },
    { value: "male-qn-jingying", label: "精英青年" },
    { value: "male-qn-badao", label: "霸道青年" },
    { value: "male-qn-daxuesheng", label: "青年大学生" },
    { value: "female-shaonv", label: "少女" },
    { value: "female-yujie", label: "御姐" },
    { value: "female-chengshu", label: "成熟女性" },
    { value: "female-tianmei", label: "甜美女性" },
];

export const doubaoAudioLanguageOptions = [
    { value: "", label: "自动识别" },
    { value: "zh-cn", label: "中文（普通话）" },
    { value: "en", label: "英语" },
    { value: "ja", label: "日语" },
    { value: "es-mx", label: "西班牙语（墨西哥）" },
    { value: "id", label: "印尼语" },
    { value: "pt-br", label: "葡萄牙语（巴西）" },
    { value: "pt", label: "葡萄牙语" },
    { value: "ko", label: "韩语" },
    { value: "it", label: "意大利语" },
    { value: "de", label: "德语" },
    { value: "fr", label: "法语" },
    { value: "th", label: "泰语" },
    { value: "vi", label: "越南语" },
    { value: "ru", label: "俄语" },
    { value: "fil", label: "菲律宾语" },
    { value: "ms", label: "马来语" },
    { value: "ar", label: "阿拉伯语" },
    { value: "pl", label: "波兰语" },
    { value: "tr", label: "土耳其语" },
    { value: "sv", label: "瑞典语" },
    { value: "nl", label: "荷兰语" },
    { value: "no", label: "挪威语" },
    { value: "uk", label: "乌克兰语" },
    { value: "fi", label: "芬兰语" },
    { value: "da", label: "丹麦语" },
    { value: "cs", label: "捷克语" },
    { value: "hu", label: "匈牙利语" },
    { value: "el", label: "希腊语" },
    { value: "ro", label: "罗马尼亚语" },
    { value: "hi", label: "印地语" },
    { value: "es-es", label: "西班牙语（西班牙）" },
];

export const doubaoAudioDialectOptions = [
    { value: "", label: "自动" },
    { value: "beijing", label: "北京话" },
    { value: "dongbei", label: "东北话" },
    { value: "henan", label: "河南话" },
    { value: "shaanxi", label: "陕西话" },
    { value: "shanghai", label: "上海话" },
    { value: "sichuan", label: "四川话" },
    { value: "tianjin", label: "天津话" },
    { value: "yue", label: "粤语" },
];

export const openAIAudioFormatOptions = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "opus", label: "Opus" },
    { value: "aac", label: "AAC" },
    { value: "flac", label: "FLAC" },
    { value: "pcm", label: "PCM" },
];

export const doubaoAudioFormatOptions = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "ogg_opus", label: "OGG Opus" },
    { value: "pcm", label: "PCM" },
];

export const minimaxAudioFormatOptions = openAIAudioFormatOptions.filter((item) => ["mp3", "wav", "flac"].includes(item.value));

export function isMiniMaxSpeech(interfaceType?: string) {
    return interfaceType === "minimax-speech";
}

export function isMiniMaxAudioConfig(config: AiConfig) {
    return isMiniMaxSpeech(resolveModelRequestConfig(config, config.model || config.audioModel).interfaceType);
}

export function isDoubaoAudioConfig(config: AiConfig) {
    return resolveModelRequestConfig(config, config.model || config.audioModel).interfaceType === "doubao-streaming-tts";
}

export function audioVoiceOptionsForConfig(config: AiConfig) {
    if (isDoubaoAudioConfig(config)) return doubaoAudioVoiceOptions;
    if (isMiniMaxAudioConfig(config)) return minimaxVoiceOptions;
    return openAIAudioVoiceOptions;
}

export function audioFormatOptionsForConfig(config: AiConfig) {
    if (isDoubaoAudioConfig(config)) return doubaoAudioFormatOptions;
    if (isMiniMaxAudioConfig(config)) return minimaxAudioFormatOptions;
    return openAIAudioFormatOptions;
}

export function normalizeAudioVoiceForConfig(config: AiConfig, value: string) {
    const options = audioVoiceOptionsForConfig(config);
    const normalized = String(value || "").trim();
    if (isDoubaoAudioConfig(config)) {
        if (!normalized || normalized === "alloy") return "";
        return normalized;
    }
    if (isMiniMaxAudioConfig(config)) return minimaxVoiceOptions.some((item) => item.value === normalized) ? normalized : minimaxVoiceOptions[0].value;
    if (options.some((item) => item.value === normalized)) return normalized;
    return normalized || "alloy";
}

export function normalizeAudioFormatForConfig(config: AiConfig, value: string) {
    const options = audioFormatOptionsForConfig(config);
    return options.some((item) => item.value === value) ? value : "mp3";
}

export function audioVoiceLabelForConfig(config: AiConfig, value: string) {
    const normalized = normalizeAudioVoiceForConfig(config, value);
    const options = audioVoiceOptionsForConfig(config);
    return options.find((item) => item.value === normalized)?.label || normalized;
}

export function audioFormatLabelForConfig(config: AiConfig, value: string) {
    const normalized = normalizeAudioFormatForConfig(config, value);
    const options = audioFormatOptionsForConfig(config);
    return options.find((item) => item.value === normalized)?.label || normalized;
}

export function normalizeAudioVoiceValue(value: string) {
    const normalized = String(value || "").trim();
    return normalized || "alloy";
}

export const audioVoiceOptions = openAIAudioVoiceOptions;
export const audioFormatOptions = openAIAudioFormatOptions;

export function audioVoiceOptionsFor(interfaceType?: string) {
    return isMiniMaxSpeech(interfaceType) ? minimaxVoiceOptions : openAIAudioVoiceOptions;
}

export function audioFormatOptionsFor(interfaceType?: string) {
    return isMiniMaxSpeech(interfaceType) ? minimaxAudioFormatOptions : openAIAudioFormatOptions;
}

export function audioVoiceFor(value: string, interfaceType?: string) {
    const options = audioVoiceOptionsFor(interfaceType);
    return options.some((item) => item.value === value) ? value : options[0].value;
}

export function audioFormatFor(value: string, interfaceType?: string) {
    const options = audioFormatOptionsFor(interfaceType);
    return options.some((item) => item.value === value) ? value : "mp3";
}

export function normalizeAudioFormatValue(value: string) {
    return openAIAudioFormatOptions.some((item) => item.value === value) ? value : "mp3";
}

export function normalizeAudioSpeedValue(value: string) {
    const speed = Number(value);
    if (!Number.isFinite(speed)) return "1";
    return String(Math.max(0.25, Math.min(4, Number(speed.toFixed(2)))));
}

export function audioVoiceLabel(value: string) {
    const voice = normalizeAudioVoiceValue(value);
    return [...openAIAudioVoiceOptions, ...minimaxVoiceOptions, ...doubaoAudioVoiceOptions].find((item) => item.value === voice)?.label || voice;
}

export function audioFormatLabel(value: string) {
    const format = normalizeAudioFormatValue(value);
    return openAIAudioFormatOptions.find((item) => item.value === format)?.label || format;
}

export function audioSpeedLabel(value: string) {
    return `${normalizeAudioSpeedValue(value)}x`;
}

export function audioMimeType(format: string) {
    if (format === "wav") return "audio/wav";
    if (format === "opus") return "audio/opus";
    if (format === "aac") return "audio/aac";
    if (format === "flac") return "audio/flac";
    if (format === "pcm") return "audio/pcm";
    return "audio/mpeg";
}
