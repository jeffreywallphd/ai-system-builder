import type { AppRuntimeConfigValues } from "../../infrastructure/config/AppRuntimeConfig";

export interface DesktopStoragePaths {
  readonly appDataDirectory: string;
  readonly storageDirectory: string;
  readonly databasePath: string;
  readonly runtimeDirectory: string;
  readonly logsDirectory: string;
  readonly modelsDirectory: string;
  readonly assetsDirectory: string;
}

export interface DesktopPythonRuntimeInfo {
  readonly mode: "development-local" | "packaged-private";
  readonly executablePath?: string;
  readonly runtimeRoot: string;
  readonly workspaceDirectory: string;
  readonly manifestPath?: string;
  readonly isAvailable: boolean;
}

export interface DesktopBootstrapContext {
  readonly runtimeConfig: AppRuntimeConfigValues;
  readonly storage: DesktopStoragePaths;
  readonly serviceSupervisor: {
    readonly baseUrl: string;
    readonly port: number;
  };
  readonly pythonRuntime: DesktopPythonRuntimeInfo;
}

export interface DesktopKeyValueStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DesktopWorkflowBridge {
  saveWorkflowRecord(recordJson: string): void;
  loadWorkflowRecord(id: string): string | null;
  listWorkflowSummaries(): ReadonlyArray<string>;
  deleteWorkflowRecord(id: string): void;
  workflowExists(id: string): boolean;
  getWorkflowPersistenceStatus(): {
    readonly provider: string;
    readonly workflowsDirectory: string;
    readonly indexDatabasePath: string;
    readonly degraded: boolean;
    readonly detail: string;
  };
}

export interface DesktopBridge {
  readonly bootstrap: DesktopBootstrapContext;
  readonly storage: DesktopKeyValueStorageBridge;
  readonly workflows: DesktopWorkflowBridge;
}
