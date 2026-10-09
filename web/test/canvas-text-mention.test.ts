import { expect, test } from "bun:test";
import { connectCanvasNodeMention } from "@/lib/canvas/canvas-text-mention";
import { buildNodeGenerationContext } from "@/components/canvas/canvas-node-generation";
import { applyCanvasConnectionPromptSync, canvasResourceMentionToken } from "@/lib/canvas/canvas-resource-references";
import { defaultConfig } from "@/stores/use-config-store";
import { defaultModelCapabilityConfig } from "@/lib/model-capabilities";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

const nodes: CanvasNodeData[] = [
    { id: "text", type: CanvasNodeType.Text, title: "镜头正文", position: { x: 0, y: 0 }, width: 300, height: 200, metadata: { content: "清晨，人物推开木门" } },
    { id: "video", type: CanvasNodeType.Video, title: "镜头1", position: { x: 500, y: 0 }, width: 300, height: 200 },
];

test("media mentions connect existing nodes, deduplicate edges and clean removed references", () => {
    for (const type of [CanvasNodeType.Image, CanvasNodeType.Video, CanvasNodeType.Audio]) {
        const source: CanvasNodeData = { ...nodes[0], id: "media", type, title: "参考素材", metadata: { content: "https://example.com/media" } };
        const config = { ...defaultConfig, channels: [], models: [], videoModels: [] };
        const linked = connectCanvasNodeMention([...nodes, source], [], "video", "media", "media-edge", config);
        expect(linked.reference.nodeId).toBe("media");
        expect(linked.reference.active).toBe(true);
        expect(linked.nodes).toHaveLength(3);
        expect(connectCanvasNodeMention(linked.nodes, linked.connections, "video", "media", "duplicate", config).connections).toHaveLength(1);
        const withPrompt = linked.nodes.map((node) => node.id === "video" ? { ...node, metadata: { prompt: `${canvasResourceMentionToken(linked.reference)} 缓慢运镜` } } : node);
        const removed = applyCanvasConnectionPromptSync(withPrompt, linked.connections, withPrompt, []);
        expect(removed.find((node) => node.id === "video")?.metadata?.prompt).toBe("缓慢运镜");
    }
});

test("media mentions reject empty nodes and incompatible input types without mutating the graph", () => {
    const image: CanvasNodeData = { ...nodes[1], id: "image", type: CanvasNodeType.Image };
    const audio: CanvasNodeData = { ...nodes[0], id: "audio", type: CanvasNodeType.Audio, metadata: { content: "https://example.com/audio.mp3" } };
    const current = [...nodes, image, audio];
    expect(() => connectCanvasNodeMention(current, [], "video", "image", "edge")).toThrow();
    expect(() => connectCanvasNodeMention(current, [], "image", "audio", "edge")).toThrow("不能连接参考音频");
    expect(current).toHaveLength(4);
});

test("media mentions enforce reference capacity through Config receivers", () => {
    const profile = defaultModelCapabilityConfig(undefined, "test-video");
    profile.video!.references.maxImages = 1;
    const config = { ...defaultConfig, videoModels: ["test::test-video"], channels: [{ ...defaultConfig.channels[0], id: "test", models: ["test-video"], modelCosts: [{ model: "test-video", capability: "video" as const, billingMode: "fixed_request" as const, unitPriceMicrocredits: 1, capabilityConfig: profile }] }] };
    const image: CanvasNodeData = { ...nodes[0], id: "image", type: CanvasNodeType.Image, metadata: { content: "https://example.com/image.png" } };
    const receiver: CanvasNodeData = { ...nodes[1], id: "config", type: CanvasNodeType.Config };
    const current = [...nodes, image, { ...image, id: "other-image" }, receiver];
    const edges = [{ id: "receiver", fromNodeId: "video", toNodeId: "config" }, { id: "existing", fromNodeId: "text", toNodeId: "config" }];
    const linked = connectCanvasNodeMention(current, edges, "video", "image", "new", config);
    expect(linked.connections.at(-1)?.toNodeId).toBe("config");
    expect(() => connectCanvasNodeMention(linked.nodes, linked.connections, "video", "other-image", "overflow", config)).toThrow("最多支持 1");
    expect(linked.connections).toHaveLength(3);
});

test("selecting an unconnected text mention connects and expands its content for video generation", () => {
    const linked = connectCanvasNodeMention(nodes, [], "video", "text", "edge");
    expect(linked.connections).toEqual([{ id: "edge", fromNodeId: "text", toNodeId: "video" }]);
    expect(linked.reference.active).toBe(true);
    const prompt = `${canvasResourceMentionToken(linked.reference)} 缓慢运镜`;
    const context = buildNodeGenerationContext("video", linked.nodes, linked.connections, prompt, []);
    expect(context.prompt).toContain("清晨，人物推开木门");
    expect(context.prompt).toContain("缓慢运镜");
    expect(connectCanvasNodeMention(linked.nodes, linked.connections, "video", "text", "duplicate").connections).toHaveLength(1);
});

test("text mentions follow a connected Config and reject cycles, self references and locked targets", () => {
    const config: CanvasNodeData = { ...nodes[1], id: "config", type: CanvasNodeType.Config };
    const other: CanvasNodeData = { ...nodes[0], id: "other" };
    const linked = connectCanvasNodeMention([...nodes, config, other], [{ id: "config-edge", fromNodeId: "video", toNodeId: "config" }, { id: "existing", fromNodeId: "other", toNodeId: "config" }], "video", "text", "edge");
    expect(linked.connections[2].toNodeId).toBe("config");
    expect(linked.reference.label).toBe("文本2");
    expect(linked.reference.nodeId).toBe("text");
    expect(() => connectCanvasNodeMention(nodes, [{ id: "reverse", fromNodeId: "video", toNodeId: "text" }], "video", "text", "edge")).toThrow("循环");
    expect(() => connectCanvasNodeMention(nodes, [], "text", "text", "edge")).toThrow();
    expect(() => connectCanvasNodeMention(nodes.map((node) => node.id === "video" ? { ...node, metadata: { locked: true } } : node), [], "video", "text", "edge")).toThrow();
});

test("appending a text reference preserves existing mention numbering with an empty Config", () => {
    const other: CanvasNodeData = { ...nodes[0], id: "other", metadata: { content: "原有文本" } };
    const config: CanvasNodeData = { ...nodes[1], id: "config", type: CanvasNodeType.Config };
    const linked = connectCanvasNodeMention([...nodes, other, config], [{ id: "old", fromNodeId: "other", toNodeId: "video" }, { id: "config", fromNodeId: "video", toNodeId: "config" }], "video", "text", "new");
    expect(linked.connections[2].toNodeId).toBe("video");
    expect(linked.reference.label).toBe("文本2");
    const context = buildNodeGenerationContext("video", linked.nodes, linked.connections, "@文本1 @文本2", []);
    expect(context.prompt).toContain("原有文本");
    expect(context.prompt).toContain("清晨，人物推开木门");
});
