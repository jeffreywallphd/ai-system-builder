import type { AppRuntimeConfigValues } from "../../infrastructure/config/AppRuntimeConfig";
import type { CanonicalEntityType } from "../../application/ports/interfaces/ICanonicalAssetIdentityRepository";

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


export interface DesktopExecutionRunBridge {
  saveExecutionRun(runJson: string): Promise<void>;
  loadExecutionRun(runId: string): Promise<string | null>;
  listExecutionRuns(criteriaJson?: string): Promise<ReadonlyArray<string>>;
}

export interface DesktopModelFileBridge {
  exists(path: string): boolean;
  stat(path: string): { readonly path: string; readonly kind: "file" | "directory"; readonly size?: number; readonly modifiedAt?: string };
  read(path: string): Uint8Array;
  write(request: { readonly path: string; readonly content: Uint8Array; readonly overwrite?: boolean; readonly createDirectories?: boolean }): void;
  delete(path: string): void;
  list(path: string, options?: { readonly recursive?: boolean }): ReadonlyArray<{ readonly path: string; readonly kind: "file" | "directory"; readonly size?: number; readonly modifiedAt?: string }>;
  move(request: { readonly from: string; readonly to: string; readonly overwrite?: boolean }): void;
  copy(request: { readonly from: string; readonly to: string; readonly overwrite?: boolean }): void;
}

export interface DesktopCanonicalAssetBridge {
  listAssets(criteriaJson?: string): Promise<ReadonlyArray<string>>;
  loadAssetDetail(assetId: string): Promise<string | null>;
  listVersionChain(assetId: string): Promise<ReadonlyArray<string>>;
  evaluateDependencyState(versionId: string): Promise<string | null>;
  reconcileIdentity(entityType: CanonicalEntityType, entityId: string): Promise<string | null>;
  replayScopedProjection(entityType: CanonicalEntityType, entityId: string, versionId?: string): Promise<string>;
  verifyProjection(assetId: string, versionIdsInScope?: ReadonlyArray<string>): Promise<string | null>;
  rebuildProjectionScopes(requestJson: string): Promise<string>;
  loadManagementSnapshot(assetId: string, includeProjectionHealth?: boolean, versionIdsInProjectionScope?: ReadonlyArray<string>): Promise<string | null>;
}

export interface DesktopBridge {
  readonly bootstrap: DesktopBootstrapContext;
  readonly storage: DesktopKeyValueStorageBridge;
  readonly workflows: DesktopWorkflowBridge;
  readonly executionRuns: DesktopExecutionRunBridge;
  readonly modelFiles: DesktopModelFileBridge;
  readonly canonicalAssets: DesktopCanonicalAssetBridge;
}
