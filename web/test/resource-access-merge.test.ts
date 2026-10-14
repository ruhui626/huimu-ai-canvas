import { afterEach, expect, spyOn, test } from "bun:test";
import localforage from "localforage";
import { http } from "@/services/api/request";
import { clearResourceAccessCache, getResourceAccess, refreshResourceAccess } from "@/services/api/resources";

afterEach(() => clearResourceAccessCache());

test("批量签发合并并发请求，强制刷新不会遗失排队中的读取者", async () => {
    clearResourceAccessCache();
    const post = spyOn(http, "post").mockImplementation(async (_path, input) => ({
        items: (input as Array<{ resourceId: string }>).map(({ resourceId }) => ({
            resourceId,
            access: { url: "https://cdn.example.com/" + resourceId, delivery: "origin", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        })),
    }) as never);
    try {
        const values = await Promise.all([
            getResourceAccess("resource:first"),
            refreshResourceAccess("resource:first"),
            getResourceAccess("resource:second"),
        ]);
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][1]).toHaveLength(2);
        expect(values[0]).toEqual(values[1]);
        await refreshResourceAccess("resource:first");
        expect(post).toHaveBeenCalledTimes(2);
    } finally {
        post.mockRestore();
    }
});

test("批量展示授权仍只缓存于内存，不把签名地址写入持久存储", async () => {
    clearResourceAccessCache();
    const write = spyOn(localforage, "setItem");
    const post = spyOn(http, "post").mockResolvedValue({
        items: [{ resourceId: "signed", access: { url: "https://cdn.example.com/image?signature=test", delivery: "origin", expiresAt: new Date(Date.now() + 60_000).toISOString() } }],
    });
    try {
        await getResourceAccess("resource:signed");
        await getResourceAccess("resource:signed");
        expect(post).toHaveBeenCalledTimes(1);
        expect(write).not.toHaveBeenCalled();
    } finally {
        post.mockRestore();
        write.mockRestore();
    }
});

test("账号切换清除尚未发出的批量授权并拒绝旧读取者", async () => {
    clearResourceAccessCache();
    const post = spyOn(http, "post");
    try {
        const pending = getResourceAccess("resource:old-account");
        clearResourceAccessCache();
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(post).not.toHaveBeenCalled();
    } finally {
        post.mockRestore();
    }
});
