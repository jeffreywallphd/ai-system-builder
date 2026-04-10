import type { DesktopStudioShellBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopStudioShellBridge(): DesktopStudioShellBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop?.features?.studioShell ?? window.aiLoomDesktop?.studioShell;
}
