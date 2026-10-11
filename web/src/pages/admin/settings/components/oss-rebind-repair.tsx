import { useState } from "react";
import { Alert, Button, Checkbox, Input } from "antd";
import { AppModal } from "@/components/ui/product/app-modal";
import { applyOSSRebind, checkOSSRebind, type OSSRebindReport } from "@/services/api/oss-rebind";

// Temporary repair entrance; removing it later does not undo saved resource bindings.
export function OSSRebindRepair({ disabled }: { disabled: boolean }) {
    const [open, setOpen] = useState(false);
    const [fromBucket, setFromBucket] = useState("");
    const [report, setReport] = useState<OSSRebindReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [backup, setBackup] = useState(false);
    const [maintenance, setMaintenance] = useState(false);

    async function run(apply: boolean) {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            const result = apply
                ? await applyOSSRebind({ fromBucket: report!.fromBucket, checkToken: report!.checkToken, backupConfirmed: backup, maintenanceConfirmed: maintenance })
                : await checkOSSRebind(fromBucket.trim());
            setReport(result);
        } catch (e) {
            setReport(null);
            setError(`${e instanceof Error ? e.message : "请求失败"}${apply ? "；若请求中断，请先重新检查以确认执行结果，不要直接重复执行。" : ""}`);
        } finally {
            setBusy(false);
        }
    }

    return <>
        <Button disabled={disabled} onClick={() => { setReport(null); setError(""); setBackup(false); setMaintenance(false); setOpen(true); }}>修复历史资源桶绑定</Button>
        <AppModal title="修复历史资源桶绑定（临时工具）" open={open} closable={!busy} maskClosable={!busy} keyboard={!busy} onCancel={() => { if (!busy) setOpen(false); }} footer={null}>
            <div className="flex flex-col gap-4">
                <Alert type="warning" showIcon title="仅适用于文件已复制、完整路径不变、同 Endpoint 的平台阿里云 OSS 换桶。不会复制或删除文件。" />
                <label className="flex flex-col gap-2">旧桶名称
                    <Input value={fromBucket} disabled={busy} placeholder="填写原 Bucket 名称" onChange={(e) => { setFromBucket(e.target.value); setReport(null); setError(""); }} />
                </label>
                <p>新桶及凭据自动读取已保存的平台配置。检查会核对新桶文件存在性和大小，不验证内容哈希。请勿在执行中刷新页面。</p>
                {error && <Alert type="error" showIcon title={<span className="whitespace-pre-wrap">{error}</span>} />}
                {report && <Alert type={report.applied ? "success" : "info"} showIcon title={report.applied ? `已修复 ${report.checked} 个资源，请刷新资源页面。` : report.resources === 0 ? "当前没有需要修复的旧桶资源。" : `${report.fromBucket} → ${report.toBucket}：共 ${report.resources} 个资源，${report.checked} 个检查通过。`} />}
                {report && report.skipped > 0 && <Alert type="warning" showIcon title={`已跳过 ${report.skipped} 条失败或已删除记录，保留原状态和桶绑定，不删除文件，也不自动恢复为成功。${report.checked === 0 ? "没有可迁移资源，无需确认修复。" : ""}`} />}
                {report && report.checked > 0 && !report.applied && <>
                    <Checkbox checked={backup} disabled={busy} onChange={(e) => setBackup(e.target.checked)}>已备份数据库及 .settings-key，并确认可以恢复</Checkbox>
                    <Checkbox checked={maintenance} disabled={busy} onChange={(e) => setMaintenance(e.target.checked)}>已暂停生成、上传和删除，等待后台任务结束；已停止其他后端/worker 实例，仅保留当前后端</Checkbox>
                </>}
                <div className="flex justify-end gap-2">
                    <Button disabled={busy} onClick={() => setOpen(false)}>关闭</Button>
                    <Button loading={busy} disabled={busy || !fromBucket.trim()} onClick={() => void run(false)}>检查</Button>
                    <Button type="primary" disabled={busy || !report || report.applied || report.checked === 0 || !backup || !maintenance} onClick={() => void run(true)}>确认修复</Button>
                </div>
            </div>
        </AppModal>
    </>;
}
