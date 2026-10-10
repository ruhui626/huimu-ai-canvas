import { afterEach, expect, test } from "bun:test";
import { resetUserDataSessionReadiness, trackUserDataSessionInitialization, waitForUserDataSessionInitialization } from "@/services/user-data-session-readiness";

afterEach(resetUserDataSessionReadiness);

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
}

test("reads and saves wait for the shared initialization", async () => {
    const ready = deferred();
    const init = trackUserDataSessionInitialization(() => ready.promise);
    let completed = 0;
    const readers = [1, 2].map(async () => {
        await waitForUserDataSessionInitialization();
        completed++;
    });
    await Promise.resolve();
    expect(completed).toBe(0);
    ready.resolve();
    await Promise.all([init, ...readers]);
    expect(completed).toBe(2);
});

test("real initialization failures reach present and subsequent callers", async () => {
    const error = new Error("storage failed");
    const init = trackUserDataSessionInitialization(async () => { throw error; });
    await expect(init).rejects.toThrow("storage failed");
    await expect(waitForUserDataSessionInitialization()).rejects.toThrow("storage failed");
});

test("leaving the canvas cancels only its waiter", async () => {
    const ready = deferred();
    const init = trackUserDataSessionInitialization(() => ready.promise);
    const controller = new AbortController();
    const waiter = waitForUserDataSessionInitialization(controller.signal);
    controller.abort();
    await expect(waiter).rejects.toMatchObject({ name: "AbortError" });
    ready.resolve();
    await init;
    await waitForUserDataSessionInitialization();
});

test("switching accounts releases old consumers without waiting for stale initialization", async () => {
    const old = deferred();
    const next = deferred();
    const init = trackUserDataSessionInitialization(() => old.promise);
    const waiter = waitForUserDataSessionInitialization();
    await Promise.resolve();
    const newInit = trackUserDataSessionInitialization(() => next.promise);
    await expect(waiter).rejects.toMatchObject({ name: "AbortError" });
    await expect(init).rejects.toMatchObject({ name: "AbortError" });
    old.resolve();
    let completed = false;
    const newWaiter = waitForUserDataSessionInitialization().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    next.resolve();
    await Promise.all([newInit, newWaiter]);
    expect(completed).toBe(true);
});
