import { http } from "./request";

export interface OSSRebindReport {
    fromBucket: string;
    toBucket: string;
    resources: number;
    checked: number;
    applied: boolean;
    checkToken: string;
}

export function checkOSSRebind(fromBucket: string) {
    return http.post<OSSRebindReport>("/admin/settings/oss/rebind/check", { fromBucket });
}

export function applyOSSRebind(input: { fromBucket: string; checkToken: string; backupConfirmed: boolean; maintenanceConfirmed: boolean }) {
    return http.post<OSSRebindReport>("/admin/settings/oss/rebind/apply", input);
}
