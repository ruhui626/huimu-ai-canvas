import { describe, expect, test } from "bun:test";
import { audioSpeedForConfig, doubaoAudioOptions, doubaoAudioPromptError } from "../src/lib/audio-generation";
import { backendProviderConfig, prepareBackendGenerationTask } from "../src/services/api/generation-task";
import { defaultConfig } from "../src/stores/use-config-store";
import { specFromConfig, generationSpecMetadata, validateGenerationSpec } from "../src/lib/canvas/generation-contract";
import {
    audioFormatFor,
    audioFormatOptionsFor,
    audioVoiceFor,
    audioVoiceLabel,
    audioVoiceOptionsFor,
    doubaoAudioVoiceOptions,
    isDoubaoAudioConfig,
    isMiniMaxSpeech,
    normalizeAudioVoiceForConfig,
    normalizeAudioFormatForConfig,
    normalizeAudioVoiceValue,
} from "../src/lib/audio-generation";

const config = (protocol: string) =>
    ({
        provider: "custom",
        model: "models/index-tts",
        audioModel: "models/index-tts",
        apiKey: "",
        baseUrl: "",
        channels: [{ models: ["index-tts"], modelCosts: [], interfaceType: protocol, baseUrl: "", apiKey: "" }],
    }) as any;

test("豆包高级参数仅发送到豆包，切换模型保留合法语速", () => {
    const values = { ...defaultConfig, ...config("doubao-streaming-tts"), audioSpeed: "1.25", audioPitch: "-3", audioVolume: "1.5", audioSampleRate: "24000" };
    expect(doubaoAudioOptions(values)).toEqual({ sample_rate: 24000, pitch_rate: -3, loudness_rate: 50 });
    expect(backendProviderConfig(values, "audio")).toMatchObject({ audioPitch: "-3", audioVolume: "1.5", audioSampleRate: "24000", audioSpeed: "1.25" });
    const other = { ...values, ...config("minimax-speech") };
    expect(doubaoAudioOptions(other)).toEqual({});
    expect(backendProviderConfig(other, "audio")).not.toHaveProperty("audioPitch");
    expect(audioSpeedForConfig(other)).toBe("1.25");
    expect(audioSpeedForConfig({ ...values, audioSpeed: "4" })).toBe("2");
    expect(normalizeAudioVoiceForConfig({ ...values, audioVoice: "female-yujie" }, "female-yujie")).toBe("");
});

test("豆包采样率默认 24 kHz，旧空值同样发送 24000，保留已选采样率", () => {
    const values = { ...defaultConfig, ...config("doubao-streaming-tts") };
    expect(defaultConfig.audioSampleRate).toBe("24000");
    for (const audioSampleRate of [undefined, "", "invalid", "24000"]) {
        const settings = { ...values, audioSampleRate };
        expect(doubaoAudioOptions(settings).sample_rate).toBe(24000);
        expect(backendProviderConfig(settings, "audio").audioSampleRate).toBe("24000");
    }
    expect(doubaoAudioOptions({ ...values, audioSampleRate: "48000" }).sample_rate).toBe(48000);
});

test("豆包默认 WAV，其他协议默认 MP3，保留已选择格式", () => {
    const doubao = { ...defaultConfig, ...config("doubao-streaming-tts") };
    expect(normalizeAudioFormatForConfig(doubao, defaultConfig.audioFormat)).toBe("wav");
    expect(backendProviderConfig(doubao, "audio").audioFormat).toBe("wav");
    expect(normalizeAudioFormatForConfig(doubao, "mp3")).toBe("mp3");
    expect(normalizeAudioFormatForConfig(config("minimax-speech"), defaultConfig.audioFormat)).toBe("mp3");
});

test("豆包限制最终提示词字符数，包含引用展开的正文", async () => {
    expect(doubaoAudioPromptError("中".repeat(3000))).toBe("");
    expect(doubaoAudioPromptError("中".repeat(3001))).toContain("3001");
    expect(doubaoAudioPromptError("😀".repeat(3000))).toBe("");
    await expect(prepareBackendGenerationTask({ mode: "audio", prompt: "温柔朗读【文本1】\n" + "中".repeat(3000), config: { ...defaultConfig, ...config("doubao-streaming-tts") } })).rejects.toThrow("含引用文本");
});

test("豆包参考素材在上传前拒绝混用、超长和超量", async () => {
    const base = { mode: "audio" as const, prompt: "你好", config: { ...defaultConfig, ...config("doubao-streaming-tts"), audioVoice: "" } };
    const audio = { id: "a", name: "台词", type: "audio/mpeg", url: "https://example.com/a.mp3", durationMs: 31000 };
    await expect(prepareBackendGenerationTask({ ...base, referenceAudios: [audio] })).rejects.toThrow("30 秒");
    await expect(prepareBackendGenerationTask({ ...base, referenceImages: [{ id: "i", name: "图片", type: "image/png", dataUrl: "https://example.com/i.png" }], referenceAudios: [audio] })).rejects.toThrow("不能与");
});

test("高级音频设置经过画布合同保存回读后保留，默认采样率不被改写", () => {
    const spec = specFromConfig("audio", "你好", { ...defaultConfig, audioSampleRate: "", audioPitch: "-2", audioVolume: "1.25" });
    const metadata = generationSpecMetadata(validateGenerationSpec(JSON.parse(JSON.stringify(spec))));
    expect(metadata).toMatchObject({ audioSampleRate: "", audioPitch: "-2", audioVolume: "1.25" });
});

describe("audio voice protocol handling", () => {
    test("keeps custom voice identifiers for non-OpenAI channels", () => {
        expect(normalizeAudioVoiceValue("voice_001")).toBe("voice_001");
    });

    test("uses provider-specific Doubao defaults instead of OpenAI alloy", () => {
        const doubao = { ...config("doubao-streaming-tts"), model: "seed-audio-1.0", audioModel: "seed-audio-1.0" } as any;
        expect(isDoubaoAudioConfig(doubao)).toBe(true);
        expect(normalizeAudioVoiceForConfig(doubao, "alloy")).toBe("");
    });

    test("lists every official Doubao 1.0 voice in Chinese", () => {
        const values = doubaoAudioVoiceOptions.map((item) => item.value);
        expect(doubaoAudioVoiceOptions).toHaveLength(103);
        expect(new Set(values).size).toBe(values.length);
        expect(values).toContain("zh_female_shuangkuaisisi_moon_bigtts");
        expect(values).toContain("zh_female_yueyunv_mars_bigtts");
        expect(values).toContain("zh_male_qingcang_mars_bigtts");
        expect(values).not.toContain("zh_female_vv_uranus_bigtts");
        expect(values).not.toContain("zh_female_xiaohe_uranus_bigtts");
        expect(doubaoAudioVoiceOptions.every((item) => /[\u4e00-\u9fff]/.test(item.label) && /[\u4e00-\u9fff]/.test(item.scene))).toBe(true);
    });

    test("preserves manually entered official Doubao speaker IDs", () => {
        const doubao = { ...config("doubao-streaming-tts"), model: "seed-audio-1.0", audioModel: "seed-audio-1.0" } as any;
        expect(normalizeAudioVoiceForConfig(doubao, "zh_male_custom_official_speaker")).toBe("zh_male_custom_official_speaker");
    });
});

describe("MiniMax 音频参数", () => {
    test("按 minimax-speech 协议提供 MiniMax 音色和格式", () => {
        expect(isMiniMaxSpeech("minimax-speech")).toBe(true);
        expect(audioVoiceOptionsFor("minimax-speech").map((item) => item.value)).toContain("female-yujie");
        expect(audioFormatOptionsFor("minimax-speech").map((item) => item.value)).toEqual(["mp3", "wav", "flac"]);
        expect(audioVoiceLabel("female-yujie")).toBe("御姐");
    });

    test("旧的 OpenAI 默认值在 MiniMax 下安全回退", () => {
        expect(audioVoiceFor("alloy", "minimax-speech")).toBe("male-qn-qingse");
        expect(audioFormatFor("opus", "minimax-speech")).toBe("mp3");
    });

    test("其他音频协议保留原有选项", () => {
        expect(audioVoiceFor("alloy", "openai-audio")).toBe("alloy");
        expect(audioFormatOptionsFor("openai-audio").map((item) => item.value)).toContain("opus");
    });
});
