import { ConfigProvider, Slider } from "antd";
import { youchuanImageControls, youchuanImageOptions, type YouchuanImageSettings } from "@/lib/youchuan-image";

export function YouchuanImageSettingsPanel({ config, onChange, protocol, model }: {
    config: YouchuanImageSettings;
    protocol?: string;
    model?: string;
    onChange: (key: keyof YouchuanImageSettings, value: string) => void;
}) {
    const controls = youchuanImageControls(protocol, model);
    const values = youchuanImageOptions(config, protocol, model);
    return <details className="space-y-3" data-canvas-no-zoom data-canvas-wheel-scroll>
        <summary className="cursor-pointer text-xs font-medium">高级设置</summary>
        {controls.map(({ key, parameter, label, max }) => <div key={key}>
            <div className="flex justify-between text-xs"><span>{label}</span><output>{values[parameter]}</output></div>
            <ConfigProvider theme={{ components: { Slider: { handleSize: 6, handleSizeHover: 6, handleLineWidth: 1, handleLineWidthHover: 1 } } }}>
                <Slider min={0} max={max} step={1} value={values[parameter]} ariaLabelForHandle={label} onChange={(value) => onChange(key, String(value))} />
            </ConfigProvider>
        </div>)}
        <button type="button" className="text-xs underline" onClick={() => controls.forEach(({ key, defaultValue }) => onChange(key, String(defaultValue)))}>恢复默认值</button>
    </details>;
}
