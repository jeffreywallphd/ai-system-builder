import type { DesktopCanonicalAssetBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopCanonicalAssetBridge(): DesktopCanonicalAssetBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.aiLoomDesktop?.features?.canonicalAssets ?? window.aiLoomDesktop?.canonicalAssets;
}
