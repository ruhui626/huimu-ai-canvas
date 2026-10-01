import { resourceFileUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import type { Asset } from "@/stores/use-asset-store";

/**
 * Managed image records persist only a stable platform locator. OSS/CDN access
 * URLs are short-lived credentials and are resolved by the display layer.
 */
export function normalizeManagedImageAssetLocators(asset: Asset): Asset {
    if (asset.kind !== "image") return asset;
    const resourceId = resourceIdFromStorageKey(asset.data.storageKey);
    if (!resourceId) return asset;
    const url = resourceFileUrl(resourceId);
    if (asset.coverUrl === url && asset.data.dataUrl === url) return asset;
    return { ...asset, coverUrl: url, data: { ...asset.data, dataUrl: url } };
}

export function normalizeManagedImageAssetList(assets: Asset[]) {
    return assets.map(normalizeManagedImageAssetLocators);
}
