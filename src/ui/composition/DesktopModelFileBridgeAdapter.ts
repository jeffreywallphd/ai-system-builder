import type { DesktopModelFileBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopModelFileBridge(): DesktopModelFileBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.aiLoomDesktop?.modelFiles;
}
