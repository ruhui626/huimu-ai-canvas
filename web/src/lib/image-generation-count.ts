export const IMAGE_GENERATION_COUNTS = [1, 2, 4] as const;

export function normalizeImageGenerationCount(value: string | undefined, maxOutputs = 4): number {
    const limit = Math.max(1, Math.min(4, maxOutputs, Math.floor(Number(value) || 1)));
    return IMAGE_GENERATION_COUNTS.filter((count) => count <= limit).at(-1) || 1;
}
