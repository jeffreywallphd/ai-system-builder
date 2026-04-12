import type { DesktopWorkflowBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopWorkflowBridge(): DesktopWorkflowBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.aiLoomDesktop?.features?.workflows ?? window.aiLoomDesktop?.workflows;
}
