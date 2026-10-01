import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

import { getResourceAccess, refreshResourceAccess, resolveResourceAccessURL, resourceIdFromStorageKey, type ResourceAccessVariant } from "@/services/api/resources";
import { getActiveUserScope } from "@/lib/user-scope";
import { resolveImageUrl } from "@/services/image-storage";
import { prepareCanvasImage } from "@/services/canvas-image-loader";

type CachedResourceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    storageKey?: string;
    src?: string;
    fallback?: ReactNode;
    loadingFallback?: ReactNode;
    wrapperClassName?: string;
    eager?: boolean;
    variant?: ResourceAccessVariant;
};

/**
 * 远程资源图片统一使用 OSS/CDN 授权地址。
 * Blob 缓存仍可用于导出、抽帧等字节处理，但不作为媒体展示 src，避免把
 * `blob:http(s)://...` 泄露到节点、素材库和浏览器媒体链路中。
 */
export function CachedResourceImage({ storageKey, src = "", fallback = null, loadingFallback = fallback, wrapperClassName = "", eager = false, variant = "original", onError, onLoad, ...props }: CachedResourceImageProps) {
    const resourceId = resourceIdFromStorageKey(storageKey);
    const remoteResource = Boolean(resourceId);
    const localImageResource = Boolean(storageKey && storageKey.startsWith("image:"));
    const scope = getActiveUserScope();
    const identity = `${scope}:${resourceId || storageKey || src}`;
    const targetRef = useRef<HTMLSpanElement>(null);
    const [nearViewport, setNearViewport] = useState(eager || !remoteResource);
    const [displayed, setDisplayed] = useState<{ identity: string; src: string } | null>(null);
    const displayedRef = useRef(displayed);
    displayedRef.current = displayed;
    const remoteRetryIdentityRef = useRef("");
    const [failedIdentity, setFailedIdentity] = useState("");
    const cachedSrc = displayed?.identity === identity ? displayed.src : "";

    useEffect(() => {
        if (!remoteResource || eager) {
            setNearViewport(true);
            return;
        }
        const image = targetRef.current;
        if (!image || typeof IntersectionObserver === "undefined") {
            setNearViewport(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "240px" },
        );
        observer.observe(image);
        return () => observer.disconnect();
    }, [eager, remoteResource]);

    useEffect(() => {
        if (remoteResource && !nearViewport) return;
        const controller = new AbortController();
        let cancelled = false;
        const isCurrent = () => !cancelled && !controller.signal.aborted && getActiveUserScope() === scope;
        const load = async () => {
            let candidate = src;
            if (remoteResource && resourceId) {
                const access = await getResourceAccess(storageKey, "display", variant);
                candidate = resolveResourceAccessURL(access.url);
            } else if (localImageResource && storageKey) {
                candidate = (await resolveImageUrl(storageKey, src)) || src;
            }
            if (!candidate) throw new Error("图片地址为空");
            try {
                await prepareCanvasImage(candidate, controller.signal);
            } catch (error) {
                if (!remoteResource || !storageKey) {
                    if (candidate !== src && src) {
                        await prepareCanvasImage(src, controller.signal);
                        candidate = src;
                    }
                    else throw error;
                } else {
                    const access = await refreshResourceAccess(storageKey, "display", variant);
                    const refreshedURL = resolveResourceAccessURL(access.url);
                    if (!refreshedURL || refreshedURL === candidate) throw error;
                    await prepareCanvasImage(refreshedURL, controller.signal);
                    candidate = refreshedURL;
                }
            }
            if (isCurrent()) {
                setDisplayed({ identity, src: candidate });
                setFailedIdentity("");
            }
        };
        void load().catch(() => {
            if (isCurrent() && displayedRef.current?.identity !== identity) setFailedIdentity(identity);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [identity, localImageResource, nearViewport, remoteResource, resourceId, scope, src, storageKey, variant]);

    const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        if (remoteResource && storageKey && remoteRetryIdentityRef.current !== identity) {
            remoteRetryIdentityRef.current = identity;
            void refreshResourceAccess(storageKey, "display", variant)
                .then((access) => {
                    const url = resolveResourceAccessURL(access.url);
                    if (!url || url === cachedSrc) throw new Error("资源访问地址未刷新");
                    setDisplayed({ identity, src: url });
                    setFailedIdentity("");
                })
                .catch(() => {
                    setFailedIdentity(identity);
                    onError?.(e);
                });
            return;
        }
        if (localImageResource && storageKey && cachedSrc.startsWith("blob:")) {
            void resolveImageUrl(storageKey)
                .then((url) => {
                    if (url && url !== cachedSrc) {
                        const controller = new AbortController();
                        void prepareCanvasImage(url, controller.signal).then(() => setDisplayed({ identity, src: url })).catch(() => {
                            setFailedIdentity(identity);
                            onError?.(e);
                        });
                        return;
                    }
                    setFailedIdentity(identity);
                    onError?.(e);
                })
                .catch(() => {
                    setFailedIdentity(identity);
                    onError?.(e);
                });
            return;
        }
        setFailedIdentity(identity);
        onError?.(e);
    };

    const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        remoteRetryIdentityRef.current = "";
        onLoad?.(e);
    };

    if (failedIdentity === identity && fallback) return <>{fallback}</>;
    if (!remoteResource) return <img {...props} src={cachedSrc || undefined} onError={handleImgError} onLoad={handleImgLoad} />;
    return (
        <span ref={targetRef} className={`cached-resource-image-shell ${wrapperClassName}`.trim()}>
            {cachedSrc ? <img {...props} src={cachedSrc} onError={handleImgError} onLoad={handleImgLoad} /> : failedIdentity === identity ? fallback : loadingFallback}
        </span>
    );
}
