import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionPath } from "../src/components/canvas/canvas-connections";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

const from: CanvasNodeData = { id: "image", type: CanvasNodeType.Image, title: "Image", position: { x: 0, y: 0 }, width: 200, height: 200 };
const to: CanvasNodeData = { ...from, id: "video", type: CanvasNodeType.Video, position: { x: 500, y: 0 } };
const connection = { id: "edge", fromNodeId: from.id, toNodeId: to.id };

test("selected connection flows without hover, while idle and drag previews stay static", () => {
    const render = (active: boolean, hideVisual = false) => renderToStaticMarkup(<svg><ConnectionPath connection={connection} from={from} to={to} active={active} hideVisual={hideVisual} visualMode="hover-only" onSelect={() => {}} /></svg>);
    const selected = render(true);
    expect(selected.match(/class="canvas-connection-comet"/g)).toHaveLength(2);
    expect(selected).toContain('stroke-dasharray="160 160"');
    expect(selected).toContain('data-connection-id="edge"');
    expect(selected).toContain('pointer-events:none');
    expect(selected.match(/<path\b/g)).toHaveLength(3);
    expect(render(false)).not.toContain("canvas-connection-comet");
    expect(render(true, true)).not.toContain("canvas-connection-comet");
});

test("selected hover-only connections do not add another base stroke on hover", async () => {
    const source = await Bun.file(new URL("../src/components/canvas/canvas-connections.tsx", import.meta.url)).text();
    expect(source).toContain('visualMode === "full" || (hovered && !active)');
});
