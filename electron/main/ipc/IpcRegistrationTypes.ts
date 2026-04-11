import type { IpcMain } from "electron";
import type { AgentStudioBackendApi } from "../../../src/infrastructure/api/agents/AgentStudioBackendApi";
import type { DeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";
import type { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";

export type CanonicalRegistryRuntime = {
  readonly repository: { readonly isAvailable: boolean };
  readonly listCanonicalAssetsUseCase: { execute(criteria?: unknown): Promise<Array<{ id: string }>> };
  readonly loadCanonicalAssetDetailUseCase: { execute(assetId: string): Promise<any> };
  readonly getVersionHistoryUseCase: { execute(assetId: string): Promise<Array<any>> };
  readonly dependencyStateUseCase: { execute(input: unknown): Promise<any> };
  readonly replayScopedProjectionUseCase: { execute(input: unknown): Promise<any> };
  readonly verifyProjectionUseCase: { execute(input: unknown): Promise<any> };
  readonly projectionTrustReadModelService: { summarize(input: unknown): unknown };
  readonly rebuildProjectionOrchestrationUseCase: { execute(input: unknown): Promise<any> };
  readonly loadManagementSnapshotUseCase: { execute(input: unknown): Promise<any> };
  readonly reconcileIdentityUseCase: { execute(input: unknown): Promise<any> };
  readonly registryBackendApi: {
    listAssets(limit?: number): Promise<unknown>;
    filterAssets(filters: unknown): Promise<unknown>;
    searchAssets(query: unknown): Promise<unknown>;
    listExploreAssets(limit?: number): Promise<unknown>;
    searchExploreAssets(query: unknown): Promise<unknown>;
    getAssetDetail(query: unknown): Promise<unknown>;
    getDependencies(query: unknown): Promise<unknown>;
    getDependents(query: unknown): Promise<unknown>;
    traverseDependencies(query: unknown): Promise<unknown>;
    traverseDependents(query: unknown): Promise<unknown>;
  };
};

export type OnDemandFeatureCompositionPaths = {
  readonly getWorkflowPersistence: () => ReturnType<DeferredDesktopFeatureRuntime["ensureWorkflowPersistence"]>;
  readonly getExecutionHistory: () => ReturnType<DeferredDesktopFeatureRuntime["ensureExecutionHistory"]>;
  readonly getWorkflowRunHistory: () => ReturnType<DeferredDesktopFeatureRuntime["ensureWorkflowRunHistory"]>;
  readonly getStudioShellBackendApi: () => ReturnType<DeferredDesktopFeatureRuntime["ensureStudioShellBackendApi"]>;
  readonly getSystemStudioBackendApi: () => ReturnType<DeferredDesktopFeatureRuntime["ensureSystemStudioBackendApi"]>;
  readonly getSystemRuntimeBackendApi: () => ReturnType<DeferredDesktopFeatureRuntime["ensureSystemRuntimeBackendApi"]>;
  readonly getCanonicalRegistryRuntime: () => Promise<CanonicalRegistryRuntime>;
  readonly getAgentStudioBackendApi: () => AgentStudioBackendApi;
};

export type BaseIpcRegistrationParams = {
  readonly ipcMain: IpcMain;
};

export type WorkflowPersistenceIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getWorkflowPersistence">;
};

export type ExecutionRunIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getExecutionHistory">;
};

export type WorkflowRunHistoryIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getWorkflowRunHistory">;
};

export type StudioShellIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getStudioShellBackendApi">;
};

export type SystemStudioIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getSystemStudioBackendApi">;
};

export type SystemRuntimeIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getSystemRuntimeBackendApi">;
  readonly launchRuntimeWindowFromContract: (launchContractJson: string) => Promise<unknown>;
};

export type AgentStudioIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getAgentStudioBackendApi">;
};

export type ModelFileIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
};

export type CanonicalRegistryIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: Pick<OnDemandFeatureCompositionPaths, "getCanonicalRegistryRuntime">;
};

export type DeferredFeatureIpcRegistrationParams = BaseIpcRegistrationParams & {
  readonly onDemand: OnDemandFeatureCompositionPaths;
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly launchRuntimeWindowFromContract: (launchContractJson: string) => Promise<unknown>;
};
