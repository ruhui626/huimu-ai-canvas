import { describe, expect, test } from "bun:test";

import { formatTaskLog, projectBackendSafeTaskLog } from "../src/services/api/task-center";

describe("task log projection", () => {
    test("keeps the backend-redacted media persistence reason", () => {
        const log = projectBackendSafeTaskLog(
            "task-1",
            {
                level: "error",
                message: "任务结果保存失败",
                payload: "作品已生成，但保存未完成：登记作品失败；database is locked",
                createdAt: "2026-09-29T23:06:18+08:00",
            },
            0,
        );

        expect(log.stage).toBe("register");
        expect(log.detail).toBe("作品已生成，但保存未完成：登记作品失败；database is locked");
        expect(formatTaskLog(log)).toContain("detail=作品已生成，但保存未完成：登记作品失败；database is locked");
    });

    test("does not expose arbitrary backend payloads", () => {
        const log = projectBackendSafeTaskLog("task-1", { level: "error", message: "unknown", payload: "token=private" }, 0);
        expect(log.stage).toBe("backend_event");
        expect(log.detail).toBeUndefined();
        expect(formatTaskLog(log)).not.toContain("private");
    });
});
