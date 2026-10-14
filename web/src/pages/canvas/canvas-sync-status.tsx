import { App, Button, Dropdown } from "antd";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { readAllCanvasSyncDrafts, readCanvasSyncDrafts, type CanvasSyncDraft } from "@/services/canvas-sync-drafts";
import { getActiveUserScope } from "@/lib/user-scope";
import { CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import "./canvas-sync-status.css";

const ERROR_INDICATOR_DELAY_MS = 4_000;

export function CanvasSyncStatus({ projectId }: { projectId: string }) {
    const progress = useSyncProgressStore((state) => state.syncingProjects[projectId]);
    const phase = progress?.phase;
    const localPhase = progress?.localPhase;
    const localError = localPhase === "error";
    const cloudError = phase === "error";
    const errorKey = cloudError || localError ? `${projectId}:${cloudError}:${localError}` : "";
    const [visibleErrorKey, setVisibleErrorKey] = useState("");

    useEffect(() => {
        if (!errorKey) {
            setVisibleErrorKey("");
            return;
        }
        const timer = window.setTimeout(() => setVisibleErrorKey(errorKey), ERROR_INDICATOR_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [errorKey]);

    const showErrorIcon = Boolean(errorKey && visibleErrorKey === errorKey);
    const saving = phase === "pending" || phase === "saving" || phase === "uploading" || localPhase === "pending";
    const tone = showErrorIcon && localError ? "error" : cloudError || localError || saving ? "pending" : phase === "done" || localPhase === "saved" ? "done" : "idle";
    const statusIconClass = showErrorIcon ? undefined : "animate-spin motion-reduce:animate-none";
    const label = cloudError ? "云端暂未同步" : localError ? "本地暂未保存" : saving ? "正在同步画布" : phase === "done" ? "已同步" : localPhase === "saved" ? "已保存" : "尚未同步";

    return (
        <span className={`canvas-sync-status-trigger canvas-sync-status-trigger--${tone} inline-flex size-8 items-center justify-center rounded-full`} aria-label={label} role="status" data-canvas-no-zoom>
            {showErrorIcon ? <CloudOff className="size-4" /> : saving || cloudError || localError ? <LoaderCircle className={`size-4 ${statusIconClass || ""}`} /> : <CloudCheck className="size-4" />}
        </span>
    );
}

export function CanvasSyncDraftMenu({ projectId }: { projectId?: string }) {
    const { message } = App.useApp();
    const [drafts, setDrafts] = useState<CanvasSyncDraft[]>([]);
    const [draftScope, setDraftScope] = useState("");
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    return (
        <Dropdown
            trigger={["click"]}
            onOpenChange={(open) => {
                if (!open) return;
                const scope = getActiveUserScope();
                setDraftScope(scope);
                setDrafts([]);
                setLoading(true);
                void (projectId ? readCanvasSyncDrafts(projectId, scope) : readAllCanvasSyncDrafts(scope))
                    .then((items) => {
                        if (getActiveUserScope() === scope) setDrafts(items.reverse());
                    })
                    .catch(() => message.error("读取本地草稿失败"))
                    .finally(() => setLoading(false));
            }}
            menu={{
                items: drafts.length
                    ? drafts.map((draft) => ({
                          key: draft.id,
                          label: `${draft.project.title} · ${new Date(draft.savedAt).toLocaleString()}`,
                          onClick: () => {
                              if (getActiveUserScope() !== draftScope) {
                                  setDrafts([]);
                                  message.error("账号已切换，请重新打开本地草稿");
                                  return;
                              }
                              setExporting(true);
                              const hideLoading = message.loading({ content: "正在导出本地草稿，请稍候…", duration: 0 });
                              void exportCanvasProjects([draft.project], `${draft.project.title}-本地草稿`, { includeLocalDrawings: false })
                                  .then(() => message.success("文件已准备好，请查看浏览器下载"))
                                  .catch(() => message.error("草稿下载失败，请重试"))
                                  .finally(() => { hideLoading(); setExporting(false); });
                          },
                      }))
                    : [{ key: "empty", label: loading ? "正在读取草稿…" : "暂无本地草稿", disabled: true }],
            }}
        >
            <Button size={projectId ? "small" : "middle"} loading={exporting}>
                本地草稿
            </Button>
        </Dropdown>
    );
}
