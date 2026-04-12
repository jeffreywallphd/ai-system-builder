import type {
  DesktopAgentAuthoringBridge,
  DesktopAuthBootstrapBridge,
  DesktopBridge,
  DesktopCanonicalAssetBridge,
  DesktopExecutionRunBridge,
  DesktopModelFileBridge,
  DesktopRegistryBridge,
  DesktopStudioShellBridge,
  DesktopWorkflowBridge,
  DesktopWorkflowRunSummaryBridge,
} from "../shared/DesktopContracts";

export interface DeferredDesktopBridgeDependencies {
  readonly workflows: DesktopWorkflowBridge;
  readonly executionRuns: DesktopExecutionRunBridge;
  readonly workflowRunSummaries: DesktopWorkflowRunSummaryBridge;
  readonly modelFiles: DesktopModelFileBridge;
  readonly canonicalAssets: DesktopCanonicalAssetBridge;
  readonly studioShell: DesktopStudioShellBridge;
  readonly registry: DesktopRegistryBridge;
  readonly agents: DesktopAgentAuthoringBridge;
}

/**
 * Builds the deferred feature namespace exposed to renderer surfaces after preload startup.
 */
export function createDeferredFeatureSurface(
  dependencies: DeferredDesktopBridgeDependencies,
): DesktopBridge["features"] {
  return Object.freeze({
    workflows: dependencies.workflows,
    executionRuns: dependencies.executionRuns,
    workflowRunSummaries: dependencies.workflowRunSummaries,
    modelFiles: dependencies.modelFiles,
    canonicalAssets: dependencies.canonicalAssets,
    studioShell: dependencies.studioShell,
    registry: dependencies.registry,
    agents: dependencies.agents,
  });
}

/**
 * Composes the renderer desktop bridge while keeping auth/bootstrap surfaces distinct from deferred feature APIs.
 */
export function createDesktopBridge(params: {
  readonly authBootstrapSurface: DesktopAuthBootstrapBridge;
  readonly deferredFeatureSurface: DesktopBridge["features"];
}): DesktopBridge {
  return Object.freeze({
    auth: params.authBootstrapSurface,
    features: params.deferredFeatureSurface,
    ...params.authBootstrapSurface,
    // Legacy root aliases kept while renderer migrates to auth/features split.
    ...params.deferredFeatureSurface,
  });
}
