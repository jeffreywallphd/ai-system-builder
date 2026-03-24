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
      secrets?: {
        isAvailable(): boolean;
        getSecret(key: string): string | null;
        setSecret(key: string, value: string): void;
        removeSecret(key: string): void;
      };
      workflows: DesktopWorkflowBridge;
      executionRuns: DesktopExecutionRunBridge;
      modelFiles: DesktopModelFileBridge;
      canonicalAssets?: DesktopCanonicalAssetBridge;
    };
  }
}

export {};
