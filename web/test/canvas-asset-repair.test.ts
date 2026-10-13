import { beforeEach, describe, expect, test } from "bun:test";

import { collectCanvasMediaAssetIds, loadMissingCanvasGenerationAssets, rebindInconsistentCanvasAssets, repairMissingCanvasAssets, repairMissingCanvasVideoPreviews } from "@/services/canvas-asset-repair";
import { ApiError } from "@/services/api/request";
import { generationAssetId, useAssetStore, type Asset } from "@/stores/use-asset-store";
import type { GenerationTask } from "@/services/api/task-center";
import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import type { TimelineClip } from "@/types/timeline";

function videoAsset(id: string, storageKey?: string, url = ""): Asset {
    return {
        id,
        kind: "video",
        title: `素材 ${id}`,
        coverUrl: "",
        tags: [],
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        data: { url, ...(storageKey ? { storageKey } : {}), width: 1, height: 1, bytes: 1, mimeType: "video/mp4" },
    } as Asset;
}

function videoNode(id: string, assetId: string | undefined, storageKey: string): CanvasNodeData {
    return {
        id,
        type: CanvasNodeType.Video,
        title: "镜头",
        position: { x: 0, y: 0 },
        width: 320,
        height: 240,
        metadata: { assetId, storageKey, content: "blob:http://localhost/preview" },
    };
}

function project(id: string, nodes: CanvasNodeData[], clips: TimelineClip[] = []): CanvasProject {
    return {
        id,
        title: `画布 ${id}`,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        nodes,
        connections: [],
        chatSessions: [],
        activeChatId: null,
        viewport: { x: 0, y: 0, k: 1 },
        ...(clips.length ? { timeline: { clips } } : {}),
    };
}

function timelineClip(assetId: string | undefined, storageKey: string): TimelineClip {
    return { id: "clip-1", kind: "video", directMedia: { id: "media-1", assetId, kind: "video", title: "片段", storageKey } } as TimelineClip;
}

beforeEach(() => {
    useCanvasStore.setState({ projects: [] });
    useAssetStore.setState({ assets: [] });
});

describe("生成结果缺失绑定恢复", () => {
    const task = (result: object): GenerationTask => ({ id: "task", type: "canvas_image", status: "succeeded", prompt: "", attempts: 1, createdAt: "", updatedAt: "", resultJson: JSON.stringify(result) });

    test("已显示的四图与主节点按原输出恢复，保留名称、位置和主图，不新建素材", async () => {
        const keys = ["resource:r0", "resource:r1", "resource:r2", "resource:r3"];
        const children = keys.map((key, index) => ({ ...videoNode(`child-${index}`, undefined, key), type: CanvasNodeType.Image, metadata: { ...videoNode("", undefined, key).metadata, taskId: "task", status: "success" as const, batchRootId: "root", generationOutputCount: 1 } }));
        const root = { ...children[2], id: "root", title: "自定义主图", position: { x: 123, y: 456 }, metadata: { ...children[2].metadata, batchRootId: undefined, isBatchRoot: true, batchChildIds: children.map((node) => node.id), primaryImageId: children[2].id, generationOutputCount: 4 } };
        useCanvasStore.setState({ projects: [project("canvas-1", [root, ...children])] });
        let queries = 0;
        const ids = await Promise.all(keys.map((_, index) => generationAssetId(`materialize:task:${index}`)));
        await loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async (requested) => {
            expect([...requested]).toEqual(ids);
            useAssetStore.setState({ assets: keys.map((key, index) => ({ ...videoAsset(ids[index], key), kind: "image", data: { storageKey: key, dataUrl: "/image.png", width: 1024, height: 1024, bytes: 1, mimeType: "image/png" } } as Asset)) });
        }, async () => { queries++; return task({ images: keys.map((storageKey) => ({ storageKey, dataUrl: "/image.png" })) }); });
        expect(queries).toBe(1);
        expect(repairMissingCanvasAssets(new Set(["canvas-1"]), true)).toEqual({ createdAssets: 0, updatedProjects: 1 });
        const nodes = useCanvasStore.getState().projects[0].nodes;
        expect(nodes.map((node) => node.metadata?.assetId)).toEqual([ids[2], ...ids]);
        expect(nodes[0]).toMatchObject({ title: root.title, position: root.position, metadata: { primaryImageId: "child-2" } });
        await loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async () => { throw new Error("不应重复加载"); }, async () => { throw new Error("不应重复查询"); });
    });

    test.each(["video", "audio"] as const)("%s 单结果使用相同恢复流程", async (kind) => {
        const node = videoNode("node", undefined, "resource:r0");
        node.type = kind === "audio" ? CanvasNodeType.Audio : CanvasNodeType.Video;
        node.metadata!.taskId = "task";
        useCanvasStore.setState({ projects: [project("canvas-1", [node])] });
        const expected = await generationAssetId("materialize:task:0");
        await loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async (ids) => {
            expect([...ids]).toEqual([expected]);
        }, async () => task({ [kind]: { storageKey: "resource:r0", dataUrl: "/media" } }));
    });

    test("不从不匹配的任务资源推测绑定，不读取范围外画布", async () => {
        const node = videoNode("node", undefined, "resource:changed");
        node.metadata!.taskId = "task";
        useCanvasStore.setState({ projects: [project("canvas-1", [node])] });
        await loadMissingCanvasGenerationAssets(new Set(["other"]), async () => { throw new Error("不应加载"); }, async () => { throw new Error("不应查询"); });
        await loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async () => { throw new Error("不应加载"); }, async () => task({ video: { storageKey: "resource:original", dataUrl: "/media" } }));
        expect(node.metadata?.assetId).toBeUndefined();
    });

    test("查询或加载失败保留节点，不伪造成功或创建素材", async () => {
        const node = videoNode("node", undefined, "resource:r0");
        node.metadata!.taskId = "task";
        useCanvasStore.setState({ projects: [project("canvas-1", [node])] });
        await expect(loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async () => {}, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
        await expect(loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async () => { throw new Error("load failed"); }, async () => task({ video: { storageKey: "resource:r0", dataUrl: "/media" } }))).rejects.toThrow("load failed");
        expect(useCanvasStore.getState().projects[0].nodes).toEqual([node]);
        expect(useAssetStore.getState().assets).toEqual([]);
    });

    test("加载期间替换的资源不会绑定旧输出，已存在的素材无需查询任务", async () => {
        const node = videoNode("node", undefined, "resource:r0");
        node.metadata!.taskId = "task";
        useCanvasStore.setState({ projects: [project("canvas-1", [node])] });
        await loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async (ids) => {
            useCanvasStore.getState().updateProject("canvas-1", { nodes: [{ ...node, title: "用户改名", metadata: { ...node.metadata, storageKey: "resource:replacement" } }] });
            useAssetStore.setState({ assets: [videoAsset([...ids][0], "resource:r0")] });
        }, async () => task({ video: { storageKey: "resource:r0", dataUrl: "/media" } }));
        repairMissingCanvasAssets(new Set(["canvas-1"]), true);
        expect(useCanvasStore.getState().projects[0].nodes[0]).toMatchObject({ title: "用户改名", metadata: { storageKey: "resource:replacement", assetId: undefined } });
        useAssetStore.setState({ assets: [videoAsset("existing", "resource:replacement")] });
        await loadMissingCanvasGenerationAssets(new Set(["canvas-1"]), async () => { throw new Error("不应加载"); }, async () => { throw new Error("不应查询"); });
        repairMissingCanvasAssets(new Set(["canvas-1"]), true);
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId).toBe("existing");
    });
});

describe("repairMissingCanvasAssets 增量会话", () => {
    test("节点声明不能掩盖素材库的真实绑定，错误配对会被重绑", () => {
        useAssetStore.setState({ assets: [videoAsset("asset-a", "resource:R1"), videoAsset("asset-c", "resource:R2")] });
        useCanvasStore.setState({ projects: [project("canvas-1", [videoNode("node-1", "asset-a", "resource:R2")])] });

        const result = repairMissingCanvasAssets(new Set(["canvas-1"]), true);

        expect(result.createdAssets).toBe(0);
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId).toBe("asset-c");
    });

    test("本地未加载的素材仍按节点声明接受，不会为远端素材分叉新建", () => {
        useCanvasStore.setState({ projects: [project("canvas-1", [videoNode("node-1", "remote-only", "resource:R9")])] });

        const result = repairMissingCanvasAssets(new Set(["canvas-1"]), true);

        expect(result.createdAssets).toBe(0);
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId).toBe("remote-only");
    });
});

describe("rebindInconsistentCanvasAssets 强制对齐", () => {
    test("声明的素材引用了其他资源时重绑到引用同一资源的素材", () => {
        useCanvasStore.setState({ projects: [project("canvas-1", [videoNode("node-1", "asset-a", "resource:R2")])] });

        const result = rebindInconsistentCanvasAssets([videoAsset("asset-a", "resource:R1"), videoAsset("asset-c", "resource:R2")]);

        expect(result).toMatchObject({ reboundNodes: 1, createdAssets: 0, updatedProjects: 1 });
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId).toBe("asset-c");
    });

    test("没有素材引用节点资源时按节点新建素材并重绑", () => {
        useCanvasStore.setState({ projects: [project("canvas-1", [videoNode("node-1", "asset-a", "resource:R2")])] });

        const result = rebindInconsistentCanvasAssets([videoAsset("asset-a", "resource:R1")]);

        expect(result.reboundNodes).toBe(1);
        expect(result.createdAssets).toBe(1);
        const reboundId = useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId;
        const created = useAssetStore.getState().assets.find((asset) => asset.id === reboundId);
        expect(created?.kind).toBe("video");
        expect(created && "storageKey" in created.data ? created.data.storageKey : undefined).toBe("resource:R2");
    });

    test("时间线 directMedia 与节点走同一套绑定校验", () => {
        useCanvasStore.setState({ projects: [project("canvas-1", [], [timelineClip("asset-a", "resource:R2")])] });

        const result = rebindInconsistentCanvasAssets([videoAsset("asset-a", "resource:R1"), videoAsset("asset-c", "resource:R2")]);

        expect(result.reboundNodes).toBe(1);
        expect(useCanvasStore.getState().projects[0].timeline?.clips[0].directMedia?.assetId).toBe("asset-c");
    });

    test("素材以资源文件 URL 引用时与 resource: 前缀归一化匹配", () => {
        useCanvasStore.setState({ projects: [project("canvas-1", [videoNode("node-1", "asset-a", "resource:R2")])] });

        const result = rebindInconsistentCanvasAssets([videoAsset("asset-a", undefined, "/api/resources/R2/file")]);

        expect(result.reboundNodes).toBe(0);
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId).toBe("asset-a");
    });

    test("绑定的素材记录缺失（远端已删）时也按节点重建", () => {
        useCanvasStore.setState({ projects: [project("canvas-1", [videoNode("node-1", "deleted-asset", "resource:R2")])] });

        const result = rebindInconsistentCanvasAssets([]);

        expect(result.reboundNodes).toBe(1);
        expect(result.createdAssets).toBe(1);
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.assetId).not.toBe("deleted-asset");
    });
});

describe("collectCanvasMediaAssetIds", () => {
    test("只收集有资源身份的媒体节点与时间线片段声明", () => {
        const textNode: CanvasNodeData = { id: "node-text", type: CanvasNodeType.Text, title: "文本", position: { x: 0, y: 0 }, width: 200, height: 100, metadata: { content: "正文", assetId: "text-asset" } };
        const pendingNode = videoNode("node-pending", undefined, "resource:R3");
        const projects = [project("canvas-1", [videoNode("node-1", "asset-a", "resource:R1"), textNode, pendingNode], [timelineClip("asset-b", "resource:R2")])];

        expect(collectCanvasMediaAssetIds(projects)).toEqual(new Set(["asset-a", "asset-b"]));
    });
});

describe("repairMissingCanvasVideoPreviews", () => {
    test("only clears confirmed missing preview resources, not network failures", async () => {
        const node = { ...videoNode("node-1", "asset-1", "resource:video-1"), metadata: { ...videoNode("node-1", "asset-1", "resource:video-1").metadata, videoPreview: { storageKey: "resource:poster-1" } } };
        useCanvasStore.setState({ projects: [project("canvas-1", [node])] });

        await expect(repairMissingCanvasVideoPreviews(undefined, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.videoPreview).toBeDefined();

        const result = await repairMissingCanvasVideoPreviews(undefined, async () => { throw new ApiError("missing", { status: 404 }); });
        expect(result).toEqual({ clearedPreviews: 1, updatedProjects: 1 });
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.videoPreview).toBeUndefined();
    });

    test("preserves edits made while resource lookup is pending", async () => {
        const node = { ...videoNode("node-1", "asset-1", "resource:video-1"), metadata: { ...videoNode("node-1", "asset-1", "resource:video-1").metadata, videoPreview: { storageKey: "resource:poster-1" } } };
        useCanvasStore.setState({ projects: [project("canvas-1", [node])] });
        let rejectLookup!: (error: unknown) => void;
        const repair = repairMissingCanvasVideoPreviews(undefined, () => new Promise((_, reject) => { rejectLookup = reject; }));
        useCanvasStore.getState().updateProject("canvas-1", { title: "user edit" });
        rejectLookup(new ApiError("missing", { status: 404 }));
        await repair;
        expect(useCanvasStore.getState().projects[0].title).toBe("user edit");
        expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.videoPreview).toBeUndefined();
    });
});
