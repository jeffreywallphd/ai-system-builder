import type { DesktopRegistryBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopRegistryBridge(): DesktopRegistryBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop?.registry;
}
