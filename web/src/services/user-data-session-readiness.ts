type Initialization = { promise: Promise<void>; reject: (error: unknown) => void };

let current: Initialization | undefined;

function cancelled() {
    return new DOMException("会话已切换，已停止旧会话操作", "AbortError");
}

// 与远端串行队列分离：等待本地恢复时不能占用初始化自身需要的队列。
export function resetUserDataSessionReadiness() {
    current?.reject(cancelled());
    current = undefined;
}

export function trackUserDataSessionInitialization(initialize: () => Promise<void>): Promise<void> {
    resetUserDataSessionReadiness();
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    const entry = { promise, reject };
    current = entry;
    void Promise.resolve().then(async () => {
        if (current !== entry) throw cancelled();
        await initialize();
        if (current !== entry) throw cancelled();
    }).then(resolve, reject);
    // 初始化失败可能早于第一个等待者；仍保留拒绝结果供后续保存操作读取。
    void promise.catch(() => undefined);
    return promise;
}

export async function waitForUserDataSessionInitialization(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw cancelled();
    const entry = current;
    if (!entry) return;
    let abort!: () => void;
    const aborted = new Promise<never>((_, reject) => {
        abort = () => reject(cancelled());
        signal?.addEventListener("abort", abort, { once: true });
    });
    try {
        await Promise.race([entry.promise, aborted]);
        if (signal?.aborted || current !== entry) throw cancelled();
    } finally {
        signal?.removeEventListener("abort", abort);
    }
}
