/**
 * Renderer preload entrypoint that composes and exposes the typed desktop bridges on window.desktop while preserving least-privilege boundaries.
 */
import { contextBridge, ipcRenderer } from "electron";
import {
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginRuntimeStatus,
  type DesktopPostLoginWarmupRequest,
} from "./shared/DesktopContracts";
import { DesktopBootstrapIpcChannels } from "./shared/DesktopBootstrapIpcChannels";
import { createConnectivityBridge } from "./preload/bridge/createConnectivityBridge";
import { createSecretsBridge } from "./preload/bridge/createSecretsBridge";
import { createStorageBridge } from "./preload/bridge/createStorageBridge";
import { createWorkflowsBridge } from "./preload/bridge/createWorkflowsBridge";
import { createExecutionRunsBridge } from "./preload/bridge/createExecutionRunsBridge";
import { createWorkflowRunSummariesBridge } from "./preload/bridge/createWorkflowRunSummariesBridge";
import { createModelFilesBridge } from "./preload/bridge/createModelFilesBridge";
import { createCanonicalAssetsBridge } from "./preload/bridge/createCanonicalAssetsBridge";
import { createStudioShellBridge } from "./preload/bridge/createStudioShellBridge";
import { createRegistryBridge } from "./preload/bridge/createRegistryBridge";
import { createAgentsBridge } from "./preload/bridge/createAgentsBridge";
import {
  createDeferredBridgeGuards,
  createFallbackPostLoginRuntimeStatus,
} from "./preload/bridge/deferredFeatureGuards";
import { createDeferredFeatureSurface, createDesktopBridge } from "./preload/DesktopBridgeComposition";

const bootstrap = ipcRenderer.sendSync(DesktopBootstrapIpcChannels.bootstrap);
let deferredFeatureDemandWarmupRequest: Promise<void> | undefined;

/**
 * Reports whether post-login deferred feature IPC endpoints are currently registered in the main process.
 */
function isDeferredFeatureApiReady(): boolean {
  try {
    return ipcRenderer.sendSync(DesktopBootstrapIpcChannels.deferredFeatureApiReady) === true;
  } catch {
    return false;
  }
}

/**
 * Fetches the current post-login runtime status from the main process, with a safe fallback when sync IPC is unavailable.
 */
function getPostLoginRuntimeStatus(): DesktopPostLoginRuntimeStatus {
  try {
    return ipcRenderer.sendSync(DesktopBootstrapIpcChannels.postLoginRuntimeStatus) as DesktopPostLoginRuntimeStatus;
  } catch {
    return createFallbackPostLoginRuntimeStatus();
  }
}

/**
 * Starts a one-at-a-time on-demand warmup for deferred feature runtime services so feature requests can unblock safely.
 */
function startDeferredFeatureWarmupOnDemand(): void {
  if (deferredFeatureDemandWarmupRequest) {
    return;
  }
  deferredFeatureDemandWarmupRequest = ipcRenderer.invoke(
    DesktopBootstrapIpcChannels.startPostLoginWarmup,
    Object.freeze({
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: new Date().toISOString(),
    }),
  )
    // Convert warmup failures into diagnostics so renderer feature guards can continue presenting fallback states.
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ai-loom][desktop-runtime] deferred feature warmup request failed: ${message}`);
    })
    // Always clear the in-flight marker to allow retries after completion or failure.
    .finally(() => {
      deferredFeatureDemandWarmupRequest = undefined;
    });
}

const { guardDeferredSyncGroup, guardDeferredAsyncGroup } = createDeferredBridgeGuards({
  isDeferredFeatureApiReady,
  getPostLoginRuntimeStatus,
  startDeferredFeatureWarmupOnDemand,
});

const storageBridge = createStorageBridge({ ipcRenderer });
const secretsBridge = createSecretsBridge({ ipcRenderer });
const connectivityBridge = createConnectivityBridge({ ipcRenderer });
const workflowsBridge = createWorkflowsBridge({
  ipcRenderer,
  isDeferredFeatureApiReady,
  startDeferredFeatureWarmupOnDemand,
});
const executionRunsBridge = createExecutionRunsBridge({ ipcRenderer });
const workflowRunSummariesBridge = createWorkflowRunSummariesBridge({ ipcRenderer });
const modelFilesBridge = createModelFilesBridge({ ipcRenderer });
const canonicalAssetsBridge = createCanonicalAssetsBridge({ ipcRenderer });
const studioShellBridge = createStudioShellBridge({ ipcRenderer });
const registryBridge = createRegistryBridge({ ipcRenderer });
const agentsBridge = createAgentsBridge({ ipcRenderer });

const authBootstrapSurface = Object.freeze({
  bootstrap,
  storage: storageBridge,
  secrets: secretsBridge,
  connectivity: connectivityBridge,
  runtime: Object.freeze({
    isDeferredFeatureApiReady,
    getPostLoginRuntimeStatus,
    // Allows renderer-auth surfaces to explicitly trigger post-login warmup with optional caller metadata.
    startPostLoginWarmup(request?: DesktopPostLoginWarmupRequest) {
      return ipcRenderer.invoke(DesktopBootstrapIpcChannels.startPostLoginWarmup, request) as Promise<void>;
    },
  }),
});

const deferredFeatureSurface = createDeferredFeatureSurface({
  workflows: workflowsBridge,
  executionRuns: guardDeferredAsyncGroup("executionRuns", executionRunsBridge),
  workflowRunSummaries: guardDeferredAsyncGroup("workflowRunSummaries", workflowRunSummariesBridge),
  modelFiles: guardDeferredSyncGroup("modelFiles", modelFilesBridge),
  canonicalAssets: guardDeferredAsyncGroup("canonicalAssets", canonicalAssetsBridge),
  studioShell: guardDeferredAsyncGroup("studioShell", studioShellBridge),
  registry: guardDeferredAsyncGroup("registry", registryBridge),
  agents: guardDeferredAsyncGroup("agents", agentsBridge),
});

const desktopBridge = createDesktopBridge({
  authBootstrapSurface: authBootstrapSurface,
  deferredFeatureSurface,
});

contextBridge.exposeInMainWorld("aiLoomDesktop", desktopBridge);
