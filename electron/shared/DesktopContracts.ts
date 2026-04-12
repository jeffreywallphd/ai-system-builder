/**
 * Shared desktop contract types and runtime validators used across main, preload, and renderer boundaries.
 */
import type { AppRuntimeConfigValues } from "../../src/infrastructure/config/AppRuntimeConfig";
import type { CanonicalEntityType } from "../../src/application/ports/interfaces/ICanonicalAssetIdentityRepository";

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

export interface DesktopTrustedDeviceRegistrationBootstrap {
  readonly trustedDeviceBindingId: string;
  readonly trustMarker?: string;
  readonly registeredAt?: string;
}

export interface DesktopPinnedTrustMaterialBootstrap {
  readonly pinReference: string;
  readonly materialKind: "session-signing-key" | "attestation-key" | "opaque-marker";
  readonly publicKeyFingerprint?: string;
  readonly issuedAt?: string;
  readonly expiresAt?: string;
}

export interface DesktopIdentityTransportTrustBootstrap {
  readonly enforcement: "required" | "optional";
  readonly registeredDevice?: DesktopTrustedDeviceRegistrationBootstrap;
  readonly pinnedTrustMaterial?: DesktopPinnedTrustMaterialBootstrap;
}

export type DesktopAuthBootstrapRuntimeConfig =
  Omit<
    AppRuntimeConfigValues,
    "serviceSupervisorBaseUrl"
    | "serviceSupervisorPort"
    | "pythonRuntimeBaseUrl"
    | "workflowStorageDirectory"
    | "workflowIndexDatabasePath"
    | "desktopStorage"
    | "desktopPythonRuntime"
  >;

export interface DesktopAuthBootstrapContext {
  readonly runtimeConfig: DesktopAuthBootstrapRuntimeConfig;
  readonly storage?: Pick<DesktopStoragePaths, "appDataDirectory">;
  readonly environment?: {
    readonly isPackaged: boolean;
  };
  readonly identityTransportTrust?: DesktopIdentityTransportTrustBootstrap;
}

export type DesktopBootstrapContext = DesktopAuthBootstrapContext;

export interface DesktopPostLoginRuntimeContext {
  readonly runtimeConfig: AppRuntimeConfigValues;
  readonly storage: DesktopStoragePaths;
  readonly serviceSupervisor: {
    readonly baseUrl: string;
    readonly port: number;
  };
  readonly pythonRuntime: DesktopPythonRuntimeInfo;
  readonly identityTransportTrust?: DesktopIdentityTransportTrustBootstrap;
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
  // modelPath values are logical paths relative to the desktop managed-model root.
  exists(modelPath: string): boolean;
  stat(modelPath: string): { readonly path: string; readonly kind: "file" | "directory"; readonly size?: number; readonly modifiedAt?: string };
  read(modelPath: string): Uint8Array;
  write(request: { readonly path: string; readonly content: Uint8Array; readonly overwrite?: boolean; readonly createDirectories?: boolean }): void;
  delete(modelPath: string): void;
  list(modelPath: string, options?: { readonly recursive?: boolean }): ReadonlyArray<{ readonly path: string; readonly kind: "file" | "directory"; readonly size?: number; readonly modifiedAt?: string }>;
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
  listImageWorkflowDefinitions(requestJson: string): Promise<string>;
  getImageWorkflowDefinition(requestJson: string): Promise<string>;
  listImageSystemDefinitions(requestJson: string): Promise<string>;
  getImageSystemDefinition(requestJson: string): Promise<string>;
  saveImageSystemDefinition(requestJson: string): Promise<string>;
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
  saveSystemDefinition(requestJson: string): Promise<string>;
  loadSystemDefinition(requestJson: string): Promise<string>;
  duplicateSystemDefinition(requestJson: string): Promise<string>;
  modifySystemDefinition(requestJson: string): Promise<string>;
  getSystemCompatibilityInsights(requestJson: string): Promise<string>;
  startSystemExecution(requestJson: string): Promise<string>;
  getSystemExecutionStatus(executionId: string): Promise<string>;
  getSystemExecutionTrace(requestJson: string): Promise<string>;
  getSystemExecutionResult(executionId: string): Promise<string>;
  ingestReferenceImageUpload(requestJson: string): Promise<string>;
  persistReferenceImageOutputs(requestJson: string): Promise<string>;
  listReferenceImageOutputs(requestJson: string): Promise<string>;
  getReferenceImageOutput(requestJson: string): Promise<string>;
  listReferenceImageDatasetItems(requestJson: string): Promise<string>;
  getReferenceImageDatasetItem(requestJson: string): Promise<string>;
  listReferenceImageRunHistory(requestJson: string): Promise<string>;
  chainReferenceImageDatasetItemToInput(requestJson: string): Promise<string>;
  launchRuntimeWindow(requestJson: string): Promise<string>;
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

export interface DesktopConnectivityBridge {
  getConnectivityState(): Promise<string>;
  setOfflineMode(requestJson: string): Promise<string>;
}

export const DesktopPostLoginWarmupTriggerSources = Object.freeze({
  explicitLogin: "explicit-login",
  sessionRestore: "session-restore",
  sessionRefresh: "session-refresh",
  featureDemand: "feature-demand",
  unknown: "unknown",
});

export type DesktopPostLoginWarmupTriggerSource =
  typeof DesktopPostLoginWarmupTriggerSources[keyof typeof DesktopPostLoginWarmupTriggerSources];

export interface DesktopPostLoginWarmupRequest {
  readonly triggerSource: DesktopPostLoginWarmupTriggerSource;
  readonly requestedAt?: string;
}

export const DesktopPostLoginRuntimeActivationModes = Object.freeze({
  authSuccessWarmup: "auth-success-warmup",
  lazyFeatureDemand: "lazy-feature-demand",
});

export type DesktopPostLoginRuntimeActivationMode =
  typeof DesktopPostLoginRuntimeActivationModes[keyof typeof DesktopPostLoginRuntimeActivationModes];

export const DesktopPostLoginRuntimeStates = Object.freeze({
  unavailable: "unavailable",
  warming: "warming",
  ready: "ready",
  failed: "failed",
});

export type DesktopPostLoginRuntimeState =
  typeof DesktopPostLoginRuntimeStates[keyof typeof DesktopPostLoginRuntimeStates];

export const DesktopPostLoginRuntimeUnavailableReasons = Object.freeze({
  preLogin: "pre-login",
  loggedOut: "logged-out",
  shuttingDown: "shutting-down",
});

export type DesktopPostLoginRuntimeUnavailableReason =
  typeof DesktopPostLoginRuntimeUnavailableReasons[keyof typeof DesktopPostLoginRuntimeUnavailableReasons];

export interface DesktopPostLoginRuntimeStatus {
  readonly state: DesktopPostLoginRuntimeState;
  readonly updatedAt: string;
  readonly activationMode?: DesktopPostLoginRuntimeActivationMode;
  readonly triggerSource?: DesktopPostLoginWarmupTriggerSource;
  readonly requestedAt?: string;
  readonly unavailableReason?: DesktopPostLoginRuntimeUnavailableReason;
  readonly failure?: {
    readonly message: string;
    readonly failedAt: string;
    readonly retryable: boolean;
  };
}

export interface DesktopRuntimeBootstrapBridge {
  isDeferredFeatureApiReady(): boolean;
  getPostLoginRuntimeStatus(): DesktopPostLoginRuntimeStatus;
  startPostLoginWarmup(request?: DesktopPostLoginWarmupRequest): Promise<void>;
}

export interface DesktopAuthBootstrapBridge {
  readonly bootstrap: DesktopBootstrapContext;
  readonly storage: DesktopKeyValueStorageBridge;
  readonly secrets?: DesktopMcpSecretBridge;
  readonly runtime?: DesktopRuntimeBootstrapBridge;
  readonly connectivity?: DesktopConnectivityBridge;
}

export interface DesktopDeferredFeatureBridge {
  readonly workflows?: DesktopWorkflowBridge;
  readonly executionRuns?: DesktopExecutionRunBridge;
  readonly workflowRunSummaries?: DesktopWorkflowRunSummaryBridge;
  readonly modelFiles?: DesktopModelFileBridge;
  readonly canonicalAssets?: DesktopCanonicalAssetBridge;
  readonly agents?: DesktopAgentAuthoringBridge;
  readonly studioShell?: DesktopStudioShellBridge;
  readonly registry?: DesktopRegistryBridge;
}

export interface DesktopBridge {
  readonly auth: DesktopAuthBootstrapBridge;
  readonly features: DesktopDeferredFeatureBridge;

  // Legacy root aliases kept for compatibility while renderer code adopts auth/features split.
  readonly bootstrap: DesktopBootstrapContext;
  readonly storage: DesktopKeyValueStorageBridge;
  readonly secrets?: DesktopMcpSecretBridge;
  readonly runtime?: DesktopRuntimeBootstrapBridge;
  readonly workflows?: DesktopWorkflowBridge;
  readonly executionRuns?: DesktopExecutionRunBridge;
  readonly workflowRunSummaries?: DesktopWorkflowRunSummaryBridge;
  readonly modelFiles?: DesktopModelFileBridge;
  readonly canonicalAssets?: DesktopCanonicalAssetBridge;
  readonly agents?: DesktopAgentAuthoringBridge;
  readonly studioShell?: DesktopStudioShellBridge;
  readonly registry?: DesktopRegistryBridge;
  readonly connectivity?: DesktopConnectivityBridge;
}
