import type { DesktopAgentAuthoringBridge } from "../../electron/shared/DesktopContracts";

export function resolveDesktopAgentBridge(): DesktopAgentAuthoringBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop?.features?.agents ?? window.aiLoomDesktop?.agents;
}
