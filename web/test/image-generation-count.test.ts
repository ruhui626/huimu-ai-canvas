import { expect, test } from "bun:test";
import { IMAGE_GENERATION_COUNTS, normalizeImageGenerationCount } from "../src/lib/image-generation-count";

test("image generation offers 1, 2 and 4 outputs", () => {
    expect(IMAGE_GENERATION_COUNTS).toEqual([1, 2, 4]);
    for (const count of IMAGE_GENERATION_COUNTS) expect(normalizeImageGenerationCount(String(count))).toBe(count);
});

test("saved counts stay within the UI and model limits", () => {
    expect(normalizeImageGenerationCount("15", 15)).toBe(4);
    expect(normalizeImageGenerationCount("3", 15)).toBe(2);
    expect(normalizeImageGenerationCount("4", 3)).toBe(2);
    expect(normalizeImageGenerationCount("4", 1)).toBe(1);
    expect(normalizeImageGenerationCount(undefined)).toBe(1);
    expect(normalizeImageGenerationCount("invalid")).toBe(1);
    expect(normalizeImageGenerationCount("-2")).toBe(1);
});
