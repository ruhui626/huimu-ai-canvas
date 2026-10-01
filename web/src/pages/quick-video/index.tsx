import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { App, Button, Input, Switch } from "antd";
import { CircleCheck, CircleX, Clapperboard, Clock3, Download, FolderOpen, ImagePlus, LoaderCircle, MapPin, PackageCheck, RefreshCw, Trash2, TriangleAlert, UserRound, Video } from "lucide-react";
import { useNavigate } from "react-router";

import { ModelPicker } from "@/components/model-picker";
import { VideoSettingsPanel } from "@/components/video-settings-panel";
import { PageHeader, WorkspacePage } from "@/components/layout/workspace-page";
import type { AssetLibraryPickerItem } from "@/components/assets/asset-library-picker-modal";
import { AppModal } from "@/components/ui/product/app-modal";
import { CreditSymbol, requestCreditCost } from "@/constant/credits";
import { ASSET_CATEGORY_LABELS } from "@/lib/asset-category";
import { canvasThemes } from "@/lib/canvas-theme";
import { generationErrorMessage } from "@/lib/generation-error";
import { canCancelGenerationTask, generationTaskShowsProgress, generationTaskStageLabel } from "@/lib/generation-task-display";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import { modelRequestOptions, type ModelRequirements } from "@/lib/model-selection";
import { modelQuoteDescription, modelQuoteRequest } from "@/lib/model-pricing";
import { navigateToSettings } from "@/lib/settings-navigation";
import { buildVideoGenerationConfig } from "@/lib/video-generation-config";
import { quoteModel, type LogicalModelQuote } from "@/services/api/logical-models";
import { runBackendGenerationTask } from "@/services/api/generation-task";
import { resolveResourceUrl } from "@/services/api/resources";
import { cancelGenerationTask, type GenerationTask } from "@/services/api/task-center";
import { uploadImage } from "@/services/image-storage";
import { useAssetStore, type ImageAsset } from "@/stores/use-asset-store";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { modelOptionName, resolveModelChannel, selectableModelsByCapability, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import type { ReferenceImage } from "@/types/image";
import { buildQuickVideoPrompt, QUICK_VIDEO_CATEGORIES, QUICK_VIDEO_ROLE_LABELS, quickVideoRoles, type QuickVideoCategory, type QuickVideoImageRole, type QuickVideoLanguage } from "./quick-video-strategies";

type QuickVideoImage = {
    id: string;
    name: string;
    role: QuickVideoImageRole;
    previewUrl: string;
    file?: File;
    assetId?: string;
    status: "uploading" | "ready" | "error";
    progress: number;
    error?: string;
    reference?: ReferenceImage;
};

type ReadyQuickVideoImage = QuickVideoImage & { status: "ready"; reference: ReferenceImage };

const categoryIcons = {
    selling: PackageCheck,
    commercial: Clapperboard,
    store: MapPin,
} satisfies Record<QuickVideoCategory, typeof Video>;

const AssetLibraryPickerModal = lazy(() => import("@/components/assets/asset-library-picker-modal").then((module) => ({ default: module.AssetLibraryPickerModal })));

export default function QuickVideoPage() {
    const { message, modal } = App.useApp();
    const navigate = useNavigate();
    const baseConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const assets = useAssetStore((state) => state.assets);
    const assetsHydrated = useAssetStore((state) => state.hydrated);
    const addAsset = useAssetStore((state) => state.addAsset);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const theme = canvasThemes[useActiveTheme()];
    const videoModels = useMemo(() => selectableModelsByCapability(baseConfig, "video"), [baseConfig]);
    const [category, setCategory] = useState<QuickVideoCategory>("selling");
    const [description, setDescription] = useState("");
    const [language, setLanguage] = useState<QuickVideoLanguage>("zh");
    const [personOnScreen, setPersonOnScreen] = useState(true);
    const [images, setImages] = useState<QuickVideoImage[]>([]);
    const [libraryRole, setLibraryRole] = useState<QuickVideoImageRole | null>(null);
    const removedImageIdsRef = useRef(new Set<string>());
    const localPreviewUrlsRef = useRef(new Set<string>());
    const [model, setModel] = useState(baseConfig.videoModel);
    const [ratio, setRatio] = useState(baseConfig.size);
    const [seconds, setSeconds] = useState(baseConfig.videoSeconds);
    const [resolution, setResolution] = useState(baseConfig.vquality);
    const [generateAudio, setGenerateAudio] = useState(baseConfig.videoGenerateAudio);
    const [watermark, setWatermark] = useState(baseConfig.videoWatermark);
    const [arkPrivateAssetUpload, setArkPrivateAssetUpload] = useState(baseConfig.videoArkPrivateAssetUpload);
    const [running, setRunning] = useState(false);
    const [taskStatus, setTaskStatus] = useState("");
    const [resultUrl, setResultUrl] = useState("");
    const [currentTask, setCurrentTask] = useState<GenerationTask | null>(null);
    const [generationError, setGenerationError] = useState("");
    const [resultPreviewOpen, setResultPreviewOpen] = useState(false);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [cancelling, setCancelling] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (model && videoModels.includes(model)) return;
        setModel(videoModels.includes(baseConfig.videoModel) ? baseConfig.videoModel : videoModels[0] || "");
    }, [baseConfig.videoModel, model, videoModels]);

    useEffect(
        () => () => {
            localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            localPreviewUrlsRef.current.clear();
        },
        [],
    );

    useEffect(() => {
        if (!running || startedAt === null) return;
        const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
        updateElapsed();
        const timer = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    const uploading = images.filter((item) => item.status === "uploading").length;
    const activeImages = useMemo(() => images.filter((item): item is ReadyQuickVideoImage => item.status === "ready" && Boolean(item.reference)).filter((item) => item.role !== "person" || personOnScreen), [images, personOnScreen]);
    const selectedAssetIds = useMemo(() => new Set(images.flatMap((item) => (item.assetId ? [item.assetId] : []))), [images]);
    const libraryItems = useMemo<AssetLibraryPickerItem[]>(
        () =>
            assets
                .filter((asset): asset is ImageAsset => asset.kind === "image")
                .map((asset) => {
                    const available = Boolean(asset.data.storageKey || asset.data.dataUrl || asset.coverUrl);
                    return {
                        id: asset.id,
                        title: asset.title,
                        category: asset.category || "other",
                        archived: asset.status === "archived",
                        kindLabel: "图片",
                        mediaKind: "image",
                        asset,
                        searchText: (asset.tags || []).join(" "),
                        disabledReason: selectedAssetIds.has(asset.id) ? "该图片已添加到当前视频" : available ? undefined : "该图片暂时无法读取",
                    };
                }),
        [assets, selectedAssetIds],
    );
    const generationConfig = useMemo(() => {
        if (!model) return { ...baseConfig, model: "" };
        return {
            ...buildVideoGenerationConfig(baseConfig, model, { ratio, seconds, resolution, generateAudio, watermark }),
            videoArkPrivateAssetUpload: arkPrivateAssetUpload,
        };
    }, [arkPrivateAssetUpload, baseConfig, generateAudio, model, ratio, resolution, seconds, watermark]);
    const modelRequirements = useMemo<ModelRequirements>(
        () => ({
            capability: "video",
            input: { textCount: description.trim() ? 1 : 0, imageCount: activeImages.length, videoCount: 0, audioCount: 0, characterCount: 0 },
            videoSeconds: generationConfig.videoSeconds,
            options: modelRequestOptions(generationConfig, "video"),
        }),
        [activeImages.length, description, generationConfig],
    );
    const profile = model ? modelCapabilityConfigFor(generationConfig, model).video : undefined;
    const maxModelImages = profile?.references.maxImages ?? 0;
    const referenceLimitExceeded = activeImages.length > maxModelImages;
    const oversizedImage = profile ? activeImages.find((item) => (item.reference.bytes || 0) > profile.references.maxImageBytes) : undefined;
    const personImages = images.filter((item) => item.role === "person").length;
    const priceChannel = model ? resolveModelChannel(generationConfig, model) : undefined;
    const configuredCredits =
        model && priceChannel
            ? requestCreditCost({
                  channelMode: priceChannel.scope === "system" ? "remote" : "local",
                  modelCosts: priceChannel.modelCosts,
                  model: modelOptionName(model),
                  count: 1,
                  seconds: generationConfig.videoSeconds,
                  capability: "video",
                  config: generationConfig,
                  requirements: modelRequirements,
              })
            : null;
    const quoteRequest = useMemo(() => (model ? modelQuoteRequest(generationConfig, model, "video", modelRequirements) : undefined), [generationConfig, model, modelRequirements]);
    const [routeQuote, setRouteQuote] = useState<LogicalModelQuote | null>(null);
    const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

    useEffect(() => {
        if (!creditsEnabled || !quoteRequest) {
            setRouteQuote(null);
            setQuoteStatus("idle");
            return;
        }
        const controller = new AbortController();
        setRouteQuote(null);
        setQuoteStatus("loading");
        quoteModel(quoteRequest, controller.signal)
            .then(({ quote }) => {
                setRouteQuote(quote);
                setQuoteStatus("ready");
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setRouteQuote(null);
                    setQuoteStatus("error");
                }
            });
        return () => controller.abort();
    }, [creditsEnabled, quoteRequest]);

    const credits = routeQuote ? routeQuote.amountMicrocredits / 1_000_000 : configuredCredits;

    const changeModel = (nextModel: string) => {
        const next = buildVideoGenerationConfig(baseConfig, nextModel, { ratio, seconds, resolution, generateAudio, watermark });
        setModel(nextModel);
        setRatio(next.size);
        setSeconds(next.videoSeconds);
        setResolution(next.vquality);
        setGenerateAudio(next.videoGenerateAudio);
        setWatermark(next.videoWatermark);
    };

    const changeVideoSetting = (key: keyof AiConfig, value: string) => {
        if (key === "size") setRatio(value);
        else if (key === "videoSeconds") setSeconds(value);
        else if (key === "vquality") setResolution(value);
        else if (key === "videoGenerateAudio") setGenerateAudio(value);
        else if (key === "videoWatermark") setWatermark(value);
        else if (key === "videoArkPrivateAssetUpload") setArkPrivateAssetUpload(value);
    };

    const uploadQuickVideoImage = async (item: QuickVideoImage) => {
        if (!item.file) return false;
        removedImageIdsRef.current.delete(item.id);
        setImages((current) => current.map((image) => (image.id === item.id ? { ...image, status: "uploading", progress: 0, error: undefined } : image)));
        try {
            const uploaded = await uploadImage(item.file, (uploadedBytes, totalBytes) => {
                const progress = totalBytes > 0 ? Math.min(99, Math.max(1, Math.round((uploadedBytes / totalBytes) * 100))) : 0;
                setImages((current) => current.map((image) => (image.id === item.id ? { ...image, progress } : image)));
            });
            if (removedImageIdsRef.current.has(item.id)) return true;
            const reference: ReferenceImage = {
                id: `quick-video:${item.file.name}:${uploaded.storageKey}`,
                name: item.file.name,
                type: uploaded.mimeType || item.file.type || "image/png",
                dataUrl: uploaded.url,
                url: uploaded.url,
                storageKey: uploaded.storageKey,
                bytes: uploaded.bytes,
                width: uploaded.width,
                height: uploaded.height,
            };
            addAsset({
                kind: "image",
                title: item.file.name.trim() || "快速成片参考图",
                coverUrl: uploaded.url,
                tags: ["快速成片"],
                status: "confirmed",
                source: "快速成片",
                metadata: { source: "quick-video-upload", fileName: item.file.name, role: item.role },
                data: { dataUrl: uploaded.url, storageKey: uploaded.storageKey, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, mimeType: uploaded.mimeType || "image/png" },
            });
            setImages((current) => current.map((image) => (image.id === item.id ? { ...image, status: "ready", progress: 100, reference } : image)));
            return true;
        } catch (error) {
            if (removedImageIdsRef.current.has(item.id)) return false;
            const errorMessage = error instanceof Error && error.message ? error.message : "图片上传失败";
            setImages((current) => current.map((image) => (image.id === item.id ? { ...image, status: "error", progress: 0, error: errorMessage, reference: undefined } : image)));
            return false;
        }
    };

    const uploadImages = async (role: QuickVideoImageRole, files: File[]) => {
        const available = Math.max(0, 9 - images.length);
        const accepted = files.filter((file) => file.type.startsWith("image/")).slice(0, available);
        if (!accepted.length) {
            message.warning(available ? "请选择图片文件" : "最多上传 9 张图片");
            return;
        }
        if (accepted.length < files.length) message.info(`本次添加 ${accepted.length} 张，图片总数最多为 9 张`);
        const pendingImages = accepted.map((file, index) => {
            const previewUrl = URL.createObjectURL(file);
            localPreviewUrlsRef.current.add(previewUrl);
            return {
                id: `quick-video-upload:${Date.now()}:${index}:${Math.random().toString(36).slice(2)}`,
                name: file.name,
                role,
                previewUrl,
                file,
                status: "uploading" as const,
                progress: 0,
            } satisfies QuickVideoImage;
        });
        setImages((current) => [...current, ...pendingImages].slice(0, 9));
        const results = await Promise.all(pendingImages.map(uploadQuickVideoImage));
        const failed = results.filter((uploaded) => !uploaded).length;
        if (failed) message.error(`${failed} 张图片上传失败，请重试`);
    };

    const removeImage = (item: QuickVideoImage) => {
        removedImageIdsRef.current.add(item.id);
        setImages((current) => current.filter((image) => image.id !== item.id));
        if (localPreviewUrlsRef.current.delete(item.previewUrl)) URL.revokeObjectURL(item.previewUrl);
    };

    const selectLibraryImages = (assetIds: string[]) => {
        if (!libraryRole) return;
        const available = Math.max(0, 9 - images.length);
        const selectedAssets = assetIds.flatMap((id) => {
            const asset = assets.find((item): item is ImageAsset => item.id === id && item.kind === "image");
            return asset && !selectedAssetIds.has(asset.id) ? [asset] : [];
        });
        const accepted = selectedAssets.slice(0, available);
        const nextImages = accepted.map((asset) => {
            const previewUrl = resolveResourceUrl(asset.data.storageKey, asset.data.dataUrl || asset.coverUrl);
            const reference: ReferenceImage = {
                id: `asset:${asset.id}`,
                name: asset.title || "素材图片",
                type: asset.data.mimeType || "image/png",
                dataUrl: previewUrl,
                url: previewUrl,
                storageKey: asset.data.storageKey,
                bytes: asset.data.bytes,
                width: asset.data.width,
                height: asset.data.height,
            };
            return {
                id: `quick-video-asset:${asset.id}`,
                assetId: asset.id,
                name: reference.name,
                role: libraryRole,
                previewUrl,
                status: "ready" as const,
                progress: 100,
                reference,
            } satisfies QuickVideoImage;
        });
        if (nextImages.length) setImages((current) => [...current, ...nextImages].slice(0, 9));
        if (accepted.length < selectedAssets.length) message.info(`已添加 ${accepted.length} 张，图片总数最多为 9 张`);
        else if (nextImages.length) message.success(`已从资产库添加 ${nextImages.length} 张图片`);
        setLibraryRole(null);
    };

    const validateGeneration = () => {
        if (!description.trim()) {
            message.warning("请先描述你想生成的视频");
            return false;
        }
        if (!model || !isAiConfigReady(generationConfig, model)) {
            message.warning("请先配置可用的视频模型");
            navigateToSettings({ section: "models", continueCreation: true });
            return false;
        }
        if (referenceLimitExceeded) {
            message.warning(`当前模型最多支持 ${maxModelImages} 张参考图，请移除多余图片或更换模型`);
            return false;
        }
        if (oversizedImage && profile) {
            message.warning(`“${oversizedImage.name}”超过当前模型的单张图片大小限制`);
            return false;
        }
        return true;
    };

    const generate = async () => {
        if (!validateGeneration()) return;
        const prompt = buildQuickVideoPrompt({ category, description, language, personOnScreen, imageRoles: activeImages.map((item) => item.role) });
        const controller = new AbortController();
        const generationStartedAt = Date.now();
        abortRef.current = controller;
        setRunning(true);
        setResultUrl("");
        setResultPreviewOpen(false);
        setCurrentTask(null);
        setGenerationError("");
        setStartedAt(generationStartedAt);
        setElapsedSeconds(0);
        setTaskStatus("正在提交生成任务");
        try {
            const result = await runBackendGenerationTask({
                mode: "video",
                prompt,
                config: generationConfig,
                referenceImages: activeImages.map((item) => item.reference),
                signal: controller.signal,
                metadata: { source: "quick-video", category, personOnScreen, language, referenceRoles: activeImages.map((item) => item.role) },
                onTaskUpdate: (task: GenerationTask) => {
                    setCurrentTask(task);
                    setTaskStatus(generationTaskStageLabel(task));
                },
            });
            if (!result.video?.dataUrl) throw new Error("后端任务没有返回视频");
            setResultUrl(resolveResourceUrl(result.video.storageKey, result.video.dataUrl));
            setTaskStatus("视频已生成");
            message.success("视频生成完成");
        } catch (error) {
            if (controller.signal.aborted) {
                setTaskStatus("已取消生成");
            } else {
                const text = generationErrorMessage(error);
                setTaskStatus(text);
                setGenerationError(text);
                message.error(text);
            }
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
            setRunning(false);
        }
    };

    const confirmGeneration = () => {
        if (running || !validateGeneration()) return;
        const categoryTitle = QUICK_VIDEO_CATEGORIES.find((item) => item.value === category)?.title || "视频";
        const costText = !creditsEnabled
            ? "积分功能未启用"
            : quoteStatus === "loading"
              ? "费用正在计算，以任务实际报价为准"
              : quoteStatus === "error" || credits === null || credits === undefined
                ? "费用暂时无法估算，以任务实际报价为准"
                : credits === 0
                  ? "本次预计免费"
                  : `预计消耗 ${credits.toLocaleString("zh-CN", { maximumFractionDigits: 6 })} 积分`;
        modal.confirm({
            title: "确认开始生成视频？",
            content: (
                <div className="mt-3 space-y-3 text-sm text-foreground/70">
                    <p>即将使用当前文案、参考图片和生成设置提交一次真实的视频生成任务。</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-surface-active p-3 text-xs">
                        <span className="text-foreground/50">视频类型</span>
                        <strong className="text-right font-medium text-foreground">{categoryTitle}</strong>
                        <span className="text-foreground/50">生成模型</span>
                        <strong className="truncate text-right font-medium text-foreground" title={modelOptionName(model)}>
                            {modelOptionName(model)}
                        </strong>
                        <span className="text-foreground/50">视频规格</span>
                        <strong className="text-right font-medium text-foreground">
                            {ratio} · {resolution} · {seconds}s
                        </strong>
                        <span className="text-foreground/50">参考图片</span>
                        <strong className="text-right font-medium text-foreground">{activeImages.length} 张</strong>
                    </div>
                    <p className="font-medium text-foreground">{costText}</p>
                </div>
            ),
            okText: "开始生成",
            cancelText: "再检查一下",
            centered: true,
            onOk: () => {
                void generate();
            },
        });
    };

    const cancelGeneration = async () => {
        if (!currentTask || !canCancelGenerationTask(currentTask) || cancelling) return;
        setCancelling(true);
        try {
            const task = await cancelGenerationTask(currentTask.id);
            setCurrentTask(task);
            setTaskStatus("已取消生成");
            abortRef.current?.abort();
            message.success("生成任务已取消");
        } catch (error) {
            message.error(generationErrorMessage(error));
        } finally {
            setCancelling(false);
        }
    };

    const progressPercent = currentTask && generationTaskShowsProgress(currentTask) ? Math.min(100, Math.max(1, Math.round(currentTask.progress || 0))) : null;
    const taskCanCancel = Boolean(currentTask && canCancelGenerationTask(currentTask));

    return (
        <WorkspacePage className="quick-video-page">
            <PageHeader title="快速成片" description="选择视频类型，上传参考图片并描述需求，模型会结合内置策略生成完整视频。" />

            <div className="mx-auto mt-5 grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="min-w-0 space-y-4">
                    <Card title="1. 选择视频类型" description="类型只影响创作策略，不限制你使用的模型。">
                        <div className="grid gap-2 md:grid-cols-3">
                            {QUICK_VIDEO_CATEGORIES.map((item) => {
                                const Icon = categoryIcons[item.value];
                                const selected = category === item.value;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        aria-pressed={selected}
                                        className="rounded-xl border p-4 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                        style={{ borderColor: selected ? "var(--workspace-accent)" : "var(--border)", background: selected ? "var(--workspace-accent-soft)" : "var(--surface)" }}
                                        onClick={() => setCategory(item.value)}
                                    >
                                        <Icon className="size-5" />
                                        <strong className="mt-3 block text-sm">{item.title}</strong>
                                        <span className="mt-1 block text-xs leading-5 text-foreground/58">{item.description}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    <Card title="2. 上传参考图片" description={`最多 9 张，当前已选择 ${images.length}/9。图片会作为隐藏参考素材直接提交给视频模型。`}>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {quickVideoRoles(category).map((role) => (
                                <UploadGroup
                                    key={role}
                                    role={role}
                                    count={images.filter((item) => item.role === role).length}
                                    disabled={running || uploading > 0 || images.length >= 9}
                                    onFiles={(files) => void uploadImages(role, files)}
                                    onLibrary={() => setLibraryRole(role)}
                                />
                            ))}
                        </div>
                        {images.length ? (
                            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                                {images.map((item) => (
                                    <figure key={item.id} className="group relative overflow-hidden rounded-lg border border-border bg-surface">
                                        <img src={item.previewUrl} alt={item.name} className="aspect-square w-full object-cover" />
                                        <figcaption className="truncate px-2 py-1.5 text-[var(--fs-tiny)] text-foreground/65">{QUICK_VIDEO_ROLE_LABELS[item.role]}</figcaption>
                                        {item.status === "uploading" ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-xs font-medium text-white">
                                                <LoaderCircle className="size-5 animate-spin" />
                                                <span>{item.progress > 0 ? `上传中 ${item.progress}%` : "正在准备上传"}</span>
                                            </div>
                                        ) : null}
                                        {item.status === "error" ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-2 text-center text-xs font-medium text-white" title={item.error}>
                                                <span>上传失败</span>
                                                <button type="button" className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25" onClick={() => void uploadQuickVideoImage(item)}>
                                                    <RefreshCw className="size-3" />
                                                    重试
                                                </button>
                                            </div>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="absolute right-1 top-1 z-10 grid size-7 place-items-center rounded-md bg-black/60 text-white shadow-sm transition hover:bg-black/75"
                                            aria-label={`移除 ${item.name}`}
                                            onClick={() => removeImage(item)}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </figure>
                                ))}
                            </div>
                        ) : null}
                        {uploading ? (
                            <div className="mt-3 flex items-center gap-2 text-xs text-foreground/58">
                                <LoaderCircle className="size-3.5 animate-spin" />
                                正在上传 {uploading} 张图片
                            </div>
                        ) : null}
                        {personImages ? (
                            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-3 py-2.5">
                                <span className="flex min-w-0 items-center gap-2 text-sm">
                                    <UserRound className="size-4 shrink-0" />
                                    <span>
                                        <strong className="block font-medium">人物出镜</strong>
                                        <small className="text-foreground/55">关闭后人物图保留在页面，但不会提交给模型</small>
                                    </span>
                                </span>
                                <Switch checked={personOnScreen} onChange={setPersonOnScreen} />
                            </div>
                        ) : null}
                    </Card>

                    <Card title="3. 描述视频" description="写清商品、门店、卖点、氛围或希望发生的动作，系统会自动补充对应类型的拍摄策略。">
                        <Input.TextArea value={description} onChange={(event) => setDescription(event.target.value)} autoSize={{ minRows: 5, maxRows: 10 }} maxLength={4000} showCount placeholder={promptPlaceholder(category)} disabled={running} />
                        <div className="mt-4 flex items-center justify-between gap-4">
                            <span className="text-sm font-medium">语言</span>
                            <div className="inline-flex rounded-lg border border-border bg-surface p-1">
                                {(
                                    [
                                        { value: "zh", label: "中文" },
                                        { value: "en", label: "English" },
                                    ] as const
                                ).map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        aria-pressed={language === item.value}
                                        className="rounded-md px-3 py-1.5 text-xs font-medium transition"
                                        style={{ background: language === item.value ? "var(--surface-active)" : "transparent" }}
                                        onClick={() => setLanguage(item.value)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Card>
                </section>

                <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
                    <Card title="生成设置" description="选项来自当前模型配置，切换模型后会自动调整。">
                        <div className="space-y-4">
                            <ModelPicker
                                config={generationConfig}
                                value={model}
                                onChange={changeModel}
                                capability="video"
                                requirements={modelRequirements}
                                fullWidth
                                showSelectedPrice={false}
                                showOptionPrices={creditsEnabled}
                                placeholder="选择视频模型"
                                onMissingConfig={() => navigateToSettings({ section: "models", continueCreation: true })}
                                showConfiguredModelName
                            />
                            {model ? (
                                <VideoSettingsPanel config={generationConfig} onConfigChange={changeVideoSetting} theme={theme} showTitle={false} className="space-y-3" />
                            ) : (
                                <button type="button" className="w-full rounded-lg border border-dashed border-border px-3 py-6 text-sm text-foreground/58" onClick={() => navigateToSettings({ section: "models", continueCreation: true })}>
                                    尚未配置视频模型，点击前往设置
                                </button>
                            )}
                        </div>
                    </Card>

                    {referenceLimitExceeded ? (
                        <Notice tone="warning">
                            当前模型最多支持 {maxModelImages} 张参考图，当前会提交 {activeImages.length} 张。请移除多余图片或更换模型。
                        </Notice>
                    ) : null}
                    {personImages && !personOnScreen ? <Notice>人物出镜已关闭，{personImages} 张人物图不会提交给模型，也不会计入当前模型的参考图数量。</Notice> : null}

                    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                        {resultUrl ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-active" style={{ color: "var(--status-success)" }}>
                                        <CircleCheck className="size-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <strong className="block text-sm">视频已生成</strong>
                                        <span className="mt-1 block text-xs text-foreground/55">用时 {formatElapsed(elapsedSeconds)}，作品已保存到资产库</span>
                                    </div>
                                </div>
                                <Button block type="primary" icon={<Video className="size-4" />} onClick={() => setResultPreviewOpen(true)}>
                                    查看成片
                                </Button>
                                <div className="grid grid-cols-2 gap-2">
                                    <a href={resultUrl} download className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-hover">
                                        <Download className="size-3.5" />
                                        下载
                                    </a>
                                    <Button icon={<FolderOpen className="size-4" />} onClick={() => navigate("/assets")}>
                                        资产库
                                    </Button>
                                </div>
                                <Button block icon={<RefreshCw className="size-4" />} onClick={confirmGeneration}>
                                    再次生成
                                </Button>
                            </div>
                        ) : generationError ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <CircleX className="mt-0.5 size-5 shrink-0" style={{ color: "var(--status-error)" }} />
                                    <div className="min-w-0">
                                        <strong className="block text-sm">{currentTask?.canRecoverMedia ? "视频已生成，保存未完成" : "生成失败"}</strong>
                                        <p className="mt-1 break-words text-xs leading-5 text-foreground/60">{generationError}</p>
                                    </div>
                                </div>
                                {currentTask?.canRecoverMedia ? (
                                    <Button block icon={<RefreshCw className="size-4" />} onClick={() => navigate("/tasks")}>
                                        前往任务中心重试保存
                                    </Button>
                                ) : (
                                    <Button block type="primary" icon={<RefreshCw className="size-4" />} onClick={confirmGeneration}>
                                        重新生成
                                    </Button>
                                )}
                            </div>
                        ) : currentTask?.status === "cancelled" ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <CircleX className="mt-0.5 size-5 shrink-0 text-foreground/55" />
                                    <div>
                                        <strong className="block text-sm">生成任务已取消</strong>
                                        <p className="mt-1 text-xs leading-5 text-foreground/60">可以调整素材或设置后重新提交。</p>
                                    </div>
                                </div>
                                <Button block type="primary" icon={<RefreshCw className="size-4" />} onClick={confirmGeneration}>
                                    重新生成
                                </Button>
                            </div>
                        ) : running || taskStatus ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                        <LoaderCircle className="size-4 shrink-0 animate-spin" />
                                        视频生成中
                                    </span>
                                    <strong className="text-sm">{progressPercent !== null ? `${progressPercent}%` : "进行中"}</strong>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-surface-active" aria-label={progressPercent !== null ? `模型生成进度 ${progressPercent}%` : "模型正在生成"}>
                                    <div
                                        className={progressPercent === null ? "h-full w-1/3 rounded-full motion-safe:animate-pulse" : "h-full rounded-full transition-[width]"}
                                        style={{ width: progressPercent !== null ? `${progressPercent}%` : undefined, background: "var(--workspace-accent)" }}
                                    />
                                </div>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-surface-active px-3 py-2.5 text-xs">
                                    <span className="min-w-0 truncate text-foreground/65" title={taskStatus || "正在提交生成任务"}>
                                        {taskStatus || "正在提交生成任务"}
                                    </span>
                                    <span className="flex items-center gap-1 text-foreground/55">
                                        <Clock3 className="size-3.5" />
                                        {formatElapsed(elapsedSeconds)}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 9%, transparent)" }}>
                                    <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: "var(--status-warning)" }} />
                                    <div className="min-w-0 text-xs leading-5">
                                        <strong className="block font-medium">生成期间请勿刷新或切换页面</strong>
                                        <span className="text-foreground/58">离开后本页进度和已选图片不会保留，但生成任务仍会在后台继续。</span>
                                    </div>
                                </div>
                                {taskCanCancel ? (
                                    <Button block danger loading={cancelling} onClick={() => void cancelGeneration()}>
                                        取消生成
                                    </Button>
                                ) : currentTask?.status === "running" ? (
                                    <p className="text-xs leading-5 text-foreground/50">任务已提交到生成模型，当前阶段无法安全取消。</p>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-foreground/58">本次消耗</span>
                                    {!creditsEnabled ? (
                                        <strong>未启用积分</strong>
                                    ) : quoteStatus === "loading" ? (
                                        <strong className="flex items-center gap-1.5">
                                            <LoaderCircle className="size-3.5 animate-spin" />
                                            正在计算…
                                        </strong>
                                    ) : quoteStatus === "error" ? (
                                        <strong>暂时无法估算</strong>
                                    ) : credits === 0 ? (
                                        <strong>免费</strong>
                                    ) : credits !== null && credits !== undefined ? (
                                        <strong className="flex items-center gap-1" title={routeQuote ? modelQuoteDescription(routeQuote) : undefined}>
                                            <CreditSymbol />
                                            {routeQuote?.estimated ? "预计 " : ""}
                                            {credits.toLocaleString("zh-CN", { maximumFractionDigits: 6 })} 积分
                                        </strong>
                                    ) : (
                                        <strong>以任务报价为准</strong>
                                    )}
                                </div>
                                <Button block type="primary" className="mt-4" icon={<Video className="size-4" />} disabled={uploading > 0 || !description.trim() || !model || referenceLimitExceeded} onClick={confirmGeneration}>
                                    生成视频
                                </Button>
                            </>
                        )}
                    </div>
                </aside>
            </div>
            <AppModal flush open={resultPreviewOpen && Boolean(resultUrl)} title={null} footer={null} centered width="min(1160px, calc(100vw - 32px))" onCancel={() => setResultPreviewOpen(false)}>
                <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-4 pr-12">
                    <CircleCheck className="size-5" style={{ color: "var(--status-success)" }} />
                    <div>
                        <strong className="block text-sm">视频生成完成</strong>
                        <span className="text-xs text-foreground/55">用时 {formatElapsed(elapsedSeconds)}</span>
                    </div>
                </div>
                <div className="flex min-h-64 items-center justify-center bg-black">{resultUrl ? <video src={resultUrl} controls playsInline className="max-h-[78vh] w-full object-contain" /> : null}</div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface px-5 py-4">
                    <Button icon={<FolderOpen className="size-4" />} onClick={() => navigate("/assets")}>
                        查看资产
                    </Button>
                    <a href={resultUrl} download className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface-hover">
                        <Download className="size-4" />
                        下载视频
                    </a>
                </div>
            </AppModal>
            {libraryRole ? (
                <Suspense fallback={null}>
                    <AssetLibraryPickerModal
                        remoteLibrary
                        remoteKind="image"
                        mediaKinds={["image"]}
                        open
                        items={libraryItems}
                        categoryLabels={{ all: "全部图片", ...ASSET_CATEGORY_LABELS }}
                        multiple
                        title={`选择${QUICK_VIDEO_ROLE_LABELS[libraryRole]}`}
                        eyebrow="快速成片参考素材"
                        confirmLabel={(count) => `添加所选图片${count ? `（${count}）` : ""}`}
                        emptyTitle="资产库里还没有图片"
                        emptyDescription="可以先关闭资产库，通过上传图片添加素材。"
                        footerNote={`当前视频还可以添加 ${Math.max(0, 9 - images.length)} 张图片`}
                        loading={!assetsHydrated}
                        onClose={() => setLibraryRole(null)}
                        onConfirm={selectLibraryImages}
                    />
                </Suspense>
            ) : null}
        </WorkspacePage>
    );
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <header className="mb-4">
                <h2 className="text-sm font-semibold">{title}</h2>
                {description ? <p className="mt-1 text-xs leading-5 text-foreground/55">{description}</p> : null}
            </header>
            {children}
        </section>
    );
}

function UploadGroup({ role, count, disabled, onFiles, onLibrary }: { role: QuickVideoImageRole; count: number; disabled: boolean; onFiles: (files: File[]) => void; onLibrary: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
        onFiles(Array.from(event.target.files || []));
        event.target.value = "";
    };
    return (
        <div className="flex min-h-20 items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-active">
                <ImagePlus className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <strong className="block text-sm font-medium">{QUICK_VIDEO_ROLE_LABELS[role]}</strong>
                <small className="text-foreground/50">已上传 {count} 张</small>
            </span>
            <span className="flex shrink-0 items-center gap-1">
                <Button size="small" icon={<ImagePlus className="size-3.5" />} disabled={disabled} onClick={() => inputRef.current?.click()}>
                    上传
                </Button>
                <Button size="small" icon={<FolderOpen className="size-3.5" />} disabled={disabled} onClick={onLibrary}>
                    资产库
                </Button>
            </span>
            <input ref={inputRef} hidden type="file" accept="image/*" multiple onChange={selectFiles} />
        </div>
    );
}

function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" }) {
    return (
        <div
            className="rounded-lg border px-3 py-2.5 text-xs leading-5"
            style={{ borderColor: tone === "warning" ? "var(--status-warning)" : "var(--border)", background: tone === "warning" ? "color-mix(in srgb, var(--status-warning) 9%, transparent)" : "var(--surface-card)" }}
        >
            {children}
        </div>
    );
}

function promptPlaceholder(category: QuickVideoCategory) {
    if (category === "selling") return "例如：突出这款咖啡的浓郁口感和便携包装，节奏轻快，适合通勤场景……";
    if (category === "commercial") return "例如：为香水制作高级、神秘的电影感广告，强调玻璃瓶和液体光泽……";
    return "例如：展示门店环境、招牌菜和热闹氛围，吸引附近用户到店体验……";
}

function formatElapsed(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return minutes ? `${minutes}分${remainder.toString().padStart(2, "0")}秒` : `${remainder}秒`;
}
