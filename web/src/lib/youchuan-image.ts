import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";
import { isYouchuanImageProtocol } from "./model-protocols";

export type YouchuanImageSettings = {
    youchuanStylize?: string;
    youchuanWeird?: string;
    youchuanChaos?: string;
};

export const YOUCHUAN_CONTROLS = [
    { key: "youchuanStylize", parameter: "stylize", label: "风格化程度", max: 1000, defaultValue: 100 },
    { key: "youchuanWeird", parameter: "weird", label: "怪异度", max: 3000, defaultValue: 50 },
    { key: "youchuanChaos", parameter: "chaos", label: "多样性", max: 100, defaultValue: 5 },
] as const;

export function isYouchuanImage(config: AiConfig, model = config.model || config.imageModel) {
    const channel = resolveModelChannel(config, model);
    return isYouchuanImageProtocol(channel.modelCosts?.find((item) => item.model === modelOptionName(model))?.protocol || channel.interfaceType);
}

export function youchuanImageControls(protocol = "youchuan-image", model = "") {
    return YOUCHUAN_CONTROLS.filter(({ parameter }) => !(protocol === "runninghub-youchuan-image" && model === "v8.1" && parameter === "weird"));
}

export function youchuanImageOptions(settings: YouchuanImageSettings, protocol = "youchuan-image", model = "") {
    return Object.fromEntries(youchuanImageControls(protocol, model).map(({ key, parameter, max, defaultValue }) => {
        const raw = settings[key];
        const value = raw === undefined || raw.trim() === "" ? defaultValue : Number(raw);
        return [parameter, Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : defaultValue];
    }));
}

export function youchuanNodeSettings(global: YouchuanImageSettings, node?: YouchuanImageSettings): YouchuanImageSettings {
    return Object.fromEntries(YOUCHUAN_CONTROLS.map(({ key }) => [key, node?.[key] ?? global[key]]));
}
