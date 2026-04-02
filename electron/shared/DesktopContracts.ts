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

export interface DesktopWorkflowRunSummaryBridge {
  saveWorkflowRunSummary(summaryJson: string): Promise<void>;
  loadWorkflowRunSummary(runId: string): Promise<string | null>;
  listWorkflowRunSummaries(queryJson?: string): Promise<ReadonlyArray<string>>;
  saveWorkflowRunDetail?(detailJson: string): Promise<void>;
  loadWorkflowRunDetail?(runId: string): Promise<string | null>;
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

export interface DesktopAgentAuthoringBridge {
  createAgent(requestJson: string): Promise<string>;
  updateAgent(requestJson: string): Promise<string>;
  getAgent(agentId: string): Promise<string>;
  listAgents(includeArchived?: boolean): Promise<string>;
  deleteAgent(agentId: string): Promise<string>;
  archiveAgent(agentId: string): Promise<string>;
  configureGoals(requestJson: string): Promise<string>;
  configurePolicy(agentId: string, policyJson: string): Promise<string>;
  configureTools(agentId: string, toolAccessJson: string): Promise<string>;
  configureMemory(agentId: string, memoryJson: string): Promise<string>;
  configureStrategy(agentId: string, planningStrategyJson: string): Promise<string>;
  validateConfiguration(requestJson: string): Promise<string>;
  launchAgent(requestJson: string): Promise<string>;
  triggerLaunch(requestJson: string): Promise<string>;
  listSessions(agentId: string): Promise<string>;
  getSessionDetail(sessionId: string): Promise<string>;
  controlRun(requestJson: string): Promise<string>;
  getStudioSnapshot(agentId: string): Promise<string>;
}


export interface DesktopStudioShellBridge {
  initializeStudio(studioId: string, name: string): Promise<string>;
  loadSnapshot(studioId: string): Promise<string>;
  startSession(studioId: string): Promise<string>;
  createDraft(requestJson: string): Promise<string>;
  updateDraft(requestJson: string): Promise<string>;
  updateDependencies(requestJson: string): Promise<string>;
  transitionLifecycle(requestJson: string): Promise<string>;
  publishVersion(requestJson: string): Promise<string>;
  validateDraft(requestJson: string): Promise<string>;
  getPersistedWorkflow(workflowId: string): Promise<string>;
  duplicatePersistedWorkflow(requestJson: string): Promise<string>;
  assessWorkflowExecutionReadiness(requestJson: string): Promise<string>;
  runWorkflowDraft(requestJson: string): Promise<string>;
  assessDataStudioExecutionReadiness(requestJson: string): Promise<string>;
  runDataStudioPipeline(requestJson: string): Promise<string>;
  listDataStudioPipelines(requestJson: string): Promise<string>;
  loadDataStudioPipeline(requestJson: string): Promise<string>;
  listWorkflowRuns(requestJson: string): Promise<string>;
  getWorkflowRunDetail(runId: string): Promise<string>;
  startWorkflowRunRerun(requestJson: string): Promise<string>;
  listSystemChildComponents(requestJson: string): Promise<string>;
  addSystemChildComponent(requestJson: string): Promise<string>;
  removeSystemChildComponent(requestJson: string): Promise<string>;
  reorderSystemChildComponent(requestJson: string): Promise<string>;
  updateSystemInterfaces(requestJson: string): Promise<string>;
  updateSystemParameters(requestJson: string): Promise<string>;
  updateSystemExecutionMetadata(requestJson: string): Promise<string>;
  getSystemCompatibilityInsights(requestJson: string): Promise<string>;
  startSystemExecution(requestJson: string): Promise<string>;
  getSystemExecutionStatus(executionId: string): Promise<string>;
  getSystemExecutionTrace(requestJson: string): Promise<string>;
  getSystemExecutionResult(executionId: string): Promise<string>;
  ingestReferenceImageUpload(requestJson: string): Promise<string>;
}

export interface DesktopRegistryBridge {
  listAssets(limit?: number): Promise<string>;
  filterAssets(filtersJson: string): Promise<string>;
  searchAssets(queryJson: string): Promise<string>;
  listExploreAssets(limit?: number): Promise<string>;
  searchExploreAssets(queryJson: string): Promise<string>;
  getAssetDetail(queryJson: string): Promise<string>;
  getDependencies(queryJson: string): Promise<string>;
  getDependents(queryJson: string): Promise<string>;
  traverseUpstream(queryJson: string): Promise<string>;
  traverseDownstream(queryJson: string): Promise<string>;
}

export interface DesktopMcpSecretBridge {
  isAvailable(): boolean;
  getSecret(key: string): string | null;
  setSecret(key: string, value: string): void;
  removeSecret(key: string): void;
}

export interface DesktopBridge {
  readonly bootstrap: DesktopBootstrapContext;
  readonly storage: DesktopKeyValueStorageBridge;
  readonly secrets?: DesktopMcpSecretBridge;
  readonly workflows: DesktopWorkflowBridge;
  readonly executionRuns: DesktopExecutionRunBridge;
  readonly workflowRunSummaries?: DesktopWorkflowRunSummaryBridge;
  readonly modelFiles: DesktopModelFileBridge;
  readonly canonicalAssets: DesktopCanonicalAssetBridge;
  readonly agents?: DesktopAgentAuthoringBridge;
  readonly studioShell?: DesktopStudioShellBridge;
  readonly registry?: DesktopRegistryBridge;
}
