import { describe, expect, test } from "bun:test";

import {
    audioFormatFor,
    audioFormatOptionsFor,
    audioVoiceFor,
    audioVoiceLabel,
    audioVoiceOptionsFor,
    isMiniMaxSpeech,
} from "../src/lib/audio-generation";

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
