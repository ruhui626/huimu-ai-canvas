export type QuickVideoCategory = "selling" | "commercial" | "store";
export type QuickVideoLanguage = "zh" | "en";
export type QuickVideoImageRole = "product" | "person" | "store" | "feature" | "reference";

export const QUICK_VIDEO_CATEGORIES: Array<{ value: QuickVideoCategory; title: string; description: string }> = [
    { value: "selling", title: "带货视频", description: "突出商品卖点、使用场景和购买理由" },
    { value: "commercial", title: "广告大片", description: "强化品牌质感、视觉氛围和产品记忆点" },
    { value: "store", title: "探店引流", description: "展示门店环境、特色内容和到店吸引力" },
];

export const QUICK_VIDEO_ROLE_LABELS: Record<QuickVideoImageRole, string> = {
    product: "商品图",
    person: "人物图",
    store: "门店图",
    feature: "特色商品 / 菜品 / 服务",
    reference: "其他参考图",
};

export function quickVideoRoles(category: QuickVideoCategory): QuickVideoImageRole[] {
    if (category === "selling") return ["product", "person", "reference"];
    if (category === "commercial") return ["product", "person", "reference"];
    return ["store", "feature", "person", "reference"];
}

export function buildQuickVideoPrompt(input: { category: QuickVideoCategory; description: string; language: QuickVideoLanguage; personOnScreen: boolean; imageRoles: QuickVideoImageRole[] }) {
    const categoryInstruction: Record<QuickVideoCategory, string> = {
        selling: "制作节奏清晰的带货视频。快速呈现商品，突出核心卖点、使用效果和购买理由，结尾形成自然的行动引导。",
        commercial: "制作具有品牌质感的产品广告。用有记忆点的镜头、光影、材质和运动表现产品，避免单调静态展示。",
        store: "制作真实、有吸引力的探店引流视频。建立门店环境，再突出特色商品、菜品或服务，结尾强化到店动机。",
    };
    const roleCounts = input.imageRoles.reduce<Partial<Record<QuickVideoImageRole, number>>>((counts, role) => {
        counts[role] = (counts[role] || 0) + 1;
        return counts;
    }, {});
    const references = Object.entries(roleCounts)
        .map(([role, count]) => `${QUICK_VIDEO_ROLE_LABELS[role as QuickVideoImageRole]} ${count} 张`)
        .join("、");
    const personInstruction = input.personOnScreen && roleCounts.person ? "参考人物需要自然出镜，并尽量保持人物外观一致。" : "不安排人物出镜，以商品、空间和细节镜头为主。";
    const languageInstruction = input.language === "zh" ? "如画面包含口播、字幕或可读文案，统一使用简体中文。" : "If the video contains speech, captions, or readable copy, use English only.";

    return [
        categoryInstruction,
        personInstruction,
        languageInstruction,
        references ? `已提供的参考素材包括：${references}。参考图只用于保持主体、人物或场景的一致性，不要把多张图片机械拼贴在画面中。` : "没有参考图，请根据需求自行完成主体和场景设计。",
        `用户需求：${input.description.trim()}`,
        "输出一个连贯完整的单条短视频，镜头运动自然，主体清晰，不要生成分镜表、解释文字或制作说明。",
    ].join("\n");
}
