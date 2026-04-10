import type {
  DesktopAgentAuthoringBridge,
  DesktopAuthBootstrapContext,
  DesktopCanonicalAssetBridge,
  DesktopConnectivityBridge,
  DesktopRuntimeBootstrapBridge,
  DesktopExecutionRunBridge,
  DesktopModelFileBridge,
  DesktopRegistryBridge,
  DesktopStudioShellBridge,
  DesktopWorkflowRunSummaryBridge,
  DesktopWorkflowBridge,
} from "../../electron/shared/DesktopContracts";

interface DesktopStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

declare global {
  interface Window {
    aiLoomDesktop?: {
      bootstrap: DesktopAuthBootstrapContext;
      storage: DesktopStorageBridge;
      secrets?: {
        isAvailable(): boolean;
        getSecret(key: string): string | null;
        setSecret(key: string, value: string): void;
        removeSecret(key: string): void;
      };
      runtime?: DesktopRuntimeBootstrapBridge;
      workflows: DesktopWorkflowBridge;
      executionRuns: DesktopExecutionRunBridge;
      workflowRunSummaries?: DesktopWorkflowRunSummaryBridge;
      modelFiles: DesktopModelFileBridge;
      canonicalAssets?: DesktopCanonicalAssetBridge;
      agents?: DesktopAgentAuthoringBridge;
      studioShell?: DesktopStudioShellBridge;
      registry?: DesktopRegistryBridge;
      connectivity?: DesktopConnectivityBridge;
    };
  }
}

export {};
