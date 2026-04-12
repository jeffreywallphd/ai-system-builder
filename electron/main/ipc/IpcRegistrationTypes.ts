import type { IpcMain } from "electron";
import type { AgentStudioBackendApi } from "../../../src/infrastructure/api/agents/AgentStudioBackendApi";
import type { DeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";
import type { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import type { CanonicalRegistryRuntime } from "../runtime/CanonicalRegistryRuntimeProvider";

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
