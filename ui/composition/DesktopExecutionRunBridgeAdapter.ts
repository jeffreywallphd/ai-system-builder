import type { DesktopExecutionRunBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopExecutionRunBridge(): DesktopExecutionRunBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.aiLoomDesktop?.executionRuns;
}
