import type { DesktopWorkflowRunSummaryBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopWorkflowRunSummaryBridge(): DesktopWorkflowRunSummaryBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.aiLoomDesktop?.features?.workflowRunSummaries ?? window.aiLoomDesktop?.workflowRunSummaries;
}
