import type { DesktopBootstrapContext, DesktopCanonicalAssetBridge, DesktopExecutionRunBridge, DesktopModelFileBridge, DesktopWorkflowBridge } from "../../electron/shared/DesktopContracts";

interface DesktopStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

declare global {
  interface Window {
    aiLoomDesktop?: {
      bootstrap: DesktopBootstrapContext;
      storage: DesktopStorageBridge;
      workflows: DesktopWorkflowBridge;
      executionRuns: DesktopExecutionRunBridge;
      modelFiles: DesktopModelFileBridge;
      canonicalAssets?: DesktopCanonicalAssetBridge;
    };
  }
}

export {};
