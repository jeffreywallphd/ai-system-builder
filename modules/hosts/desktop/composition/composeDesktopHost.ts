import { cpus, freemem, totalmem } from "node:os";
import type { LoggingPort } from "../../../application/ports/logging";
import type { ApplicationSecretsPort, ApplicationSettingsPort, ModelDefaultResolverPort } from "../../../application/ports/settings";
import type { PowerSuspensionBlockerPort } from "../../../application/ports/desktop";
import { DefaultModelDefaultResolver } from "../../../application/services/settings";
import { ClearSettingUseCase } from "../../../application/use-cases/settings/clear-setting.use-case";
import { ListSettingsDefinitionsUseCase } from "../../../application/use-cases/settings/list-settings-definitions.use-case";
import { ReadSettingsUseCase } from "../../../application/use-cases/settings/read-settings.use-case";
import { ResolveModelDefaultUseCase } from "../../../application/use-cases/settings/resolve-model-default.use-case";
import { UpdateSettingUseCase } from "../../../application/use-cases/settings/update-setting.use-case";
import { CreateWorkspaceUseCase } from "../../../application/use-cases/workspace";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import { createInMemorySecretsAdapter, createLocalApplicationSettingsAdapter } from "../../../adapters/persistence/settings";
import { createLocalWorkspaceRepository, createLocalWorkspaceSelectionRepository, createLocalWorkspaceSystemPackActivationRepository } from "../../../adapters/persistence/workspace";
import { registerElectronIpc } from "../../../adapters/transport/ipc-electron/registerElectronIpc";
import type { IpcMainHandlePort } from "../../../adapters/transport/ipc-electron/ipcMainHandlePort";
import { createLoggingConfig, type LoggingConfig } from "../../../contracts/config";
import type { LogLevel, LogVerbosity } from "../../../contracts/logging";
import type { DesktopPythonRuntimeLogEntry, DesktopPythonRuntimeStatusPayload } from "../../../contracts/ipc";
import type { HuggingFaceFetchImplementation } from "../../../adapters/storage/huggingface";
import { createHuggingFaceTokenConfigStore, type HuggingFaceTokenStatus } from "../../shared/huggingFaceTokenConfigStore";
import type { InternalAssetRegistryComposition } from "../../shared/composition/composeInternalAssetRegistry";
import { recordDesktopMemorySnapshot } from "../diagnostics";
import { createDesktopRuntimeReadinessService } from "./composeDesktopRuntimeReadiness";
import { createDesktopFeatureLifecycleRegistry, type DesktopFeatureDisposeReason, type DesktopFeatureDisposeResult, type DesktopFeatureLifecycleStateEntry } from "./featureLifecycle";
import { createUnavailablePythonRuntimeStatus, resolvePythonRuntimeBaseUrl, type DesktopPythonRuntimeFeature } from "./desktopPythonRuntimeHelpers";
export { createDesktopRuntimeReadinessService, type CreateDesktopRuntimeReadinessServiceOptions } from "./composeDesktopRuntimeReadiness";

const HUGGING_FACE_TOKEN_SETTING_KEY = "huggingface.token" as const;
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function readMemoryUsagePercent(): number {
  const totalMemory = totalmem();
  if (totalMemory <= 0) return 0;
  return clampPercent(((totalMemory - freemem()) / totalMemory) * 100);
}

function readCpuUsagePercent(): number {
  const cpuEntries = cpus();
  if (cpuEntries.length === 0) return 0;
  let idleTotal = 0;
  let activeTotal = 0;
  for (const entry of cpuEntries) {
    idleTotal += entry.times.idle;
    activeTotal += entry.times.user + entry.times.nice + entry.times.sys + entry.times.irq;
  }
  const total = idleTotal + activeTotal;
  if (total <= 0) return 0;
  const previous = (readCpuUsagePercent as typeof readCpuUsagePercent & { previousSample?: { idleTotal: number; activeTotal: number } }).previousSample;
  (readCpuUsagePercent as typeof readCpuUsagePercent & { previousSample?: { idleTotal: number; activeTotal: number } }).previousSample = { idleTotal, activeTotal };
  if (!previous) return clampPercent((activeTotal / total) * 100);
  const idleDelta = idleTotal - previous.idleTotal;
  const activeDelta = activeTotal - previous.activeTotal;
  const totalDelta = idleDelta + activeDelta;
  return totalDelta <= 0 ? 0 : clampPercent((activeDelta / totalDelta) * 100);
}

export interface ComposeDesktopHostLoggingOptions {
  verbosity?: string;
  fallbackVerbosity?: LogVerbosity;
  level?: LogLevel;
  includeDiagnostics?: boolean;
}

export interface ComposeDesktopHostOptions {
  logging?: ComposeDesktopHostLoggingOptions;
  logSink?: StructuredLogSink;
  now?: () => string;
  artifactRepo?: {
    huggingFaceAccessToken?: string;
    huggingFaceTokenConfigFilePath?: string;
    huggingFaceFetchImplementation?: HuggingFaceFetchImplementation;
  };
  settings?: { localSettingsFilePath?: string };
}

export interface RegisterDesktopArtifactUploadIpcOptions {
  ipcMain: IpcMainHandlePort;
  storageRootDirectory: string;
  runtimeRootDirectory?: string;
}

export interface DesktopHostComposition {
  loggingPort: LoggingPort;
  loggingConfig: LoggingConfig;
  applicationSettings: ApplicationSettingsPort;
  applicationSecrets: ApplicationSecretsPort;
  modelDefaultResolver: ModelDefaultResolverPort;
  getHuggingFaceTokenStatus: () => HuggingFaceTokenStatus;
  setHuggingFaceToken: (token: string) => HuggingFaceTokenStatus;
  clearHuggingFaceToken: () => HuggingFaceTokenStatus;
  startPythonRuntime: () => Promise<void>;
  stopPythonRuntime: () => Promise<void>;
  restartPythonRuntime: () => Promise<void>;
  unloadPythonRuntimeModel: () => Promise<void>;
  clearPythonRuntimeLogs: () => Promise<void>;
  readPythonRuntimeStatus: () => Promise<DesktopPythonRuntimeStatusPayload>;
  getPythonRuntimeDiagnostics: () => Promise<{ status: string; healthy: boolean; capabilities: string[] }>;
  powerSuspensionBlocker: PowerSuspensionBlockerPort;
  registerDesktopIpc: (options: RegisterDesktopArtifactUploadIpcOptions) => void;
  registerArtifactUploadIpc: (options: RegisterDesktopArtifactUploadIpcOptions) => void;
  getInternalAssetRegistry: () => InternalAssetRegistryComposition | undefined;
  getFeatureLifecycleState: () => DesktopFeatureLifecycleStateEntry[];
  disposeFeature: (featureKey: string, reason?: DesktopFeatureDisposeReason) => Promise<DesktopFeatureDisposeResult>;
  markFeatureIdle: (featureKey: string, reason?: DesktopFeatureDisposeReason) => boolean;
  disposeIdleFeatures: (reason?: DesktopFeatureDisposeReason) => Promise<DesktopFeatureDisposeResult[]>;
}


export function composeDesktopHost(options: ComposeDesktopHostOptions = {}): DesktopHostComposition {
  const recordHostMemorySnapshot = (milestone: string, detail?: Record<string, unknown>) => recordDesktopMemorySnapshot({ milestone, component: "desktop-host-composition", detail });
  const memoizeSyncFeature = <T>(milestoneBase: string, compose: () => T): (() => T) => {
    let value: T | undefined;
    return () => {
      if (value !== undefined) return value;
      recordHostMemorySnapshot(`${milestoneBase}.before`);
      value = compose();
      recordHostMemorySnapshot(`${milestoneBase}.after`);
      return value;
    };
  };

  recordHostMemorySnapshot("desktop.host.compose.enter");
  const loggingConfig = createLoggingConfig({ verbosity: options.logging?.verbosity, fallbackVerbosity: options.logging?.fallbackVerbosity, level: options.logging?.level, includeDiagnostics: options.logging?.includeDiagnostics });
  const loggingPort = createLogger({ config: loggingConfig, host: "desktop", component: "desktop-host", sink: options.logSink, now: options.now });
  recordHostMemorySnapshot("desktop.host.logging.ready");
  const featureLifecycle = createDesktopFeatureLifecycleRegistry({ loggingPort, recordMilestone: recordHostMemorySnapshot });

  const now = options.now ?? (() => new Date().toISOString());
  const runtimeLogs: DesktopPythonRuntimeLogEntry[] = [];
  let lastObservedRuntimeHealthSnapshot: { supervisorStatus: string; runtimeStatus: string; healthy: boolean } | undefined;
  const pushRuntimeLog = (entry: DesktopPythonRuntimeLogEntry) => {
    runtimeLogs.push(entry);
    if (runtimeLogs.length > 200) runtimeLogs.splice(0, runtimeLogs.length - 200);
  };
  const recordRuntimeLog = (entry: Omit<DesktopPythonRuntimeLogEntry, "timestamp"> & { timestamp?: string }) => {
    const timestamp = entry.timestamp ?? now();
    const normalized: DesktopPythonRuntimeLogEntry = { timestamp, level: entry.level, message: entry.message };
    pushRuntimeLog(normalized);
    void loggingPort.log({ timestamp, level: entry.level, verbosity: "normal", event: "runtime.python.activity", message: normalized.message, component: "python-runtime-supervisor", data: { severity: entry.level } });
  };

  const tokenConfigStore = createHuggingFaceTokenConfigStore({ filePath: options.artifactRepo?.huggingFaceTokenConfigFilePath ?? "/tmp/ai-system-builder/desktop/hugging-face-token.json", fallbackToken: options.artifactRepo?.huggingFaceAccessToken });
  recordHostMemorySnapshot("desktop.host.token-config.ready", { tokenConfigured: Boolean(options.artifactRepo?.huggingFaceAccessToken?.trim()), tokenConfigPathConfigured: Boolean(options.artifactRepo?.huggingFaceTokenConfigFilePath?.trim()) });

  const applicationSettings = createLocalApplicationSettingsAdapter({ filePath: options.settings?.localSettingsFilePath ?? "/tmp/ai-system-builder/desktop/application-settings.json" });
  recordHostMemorySnapshot("desktop.host.settings.ready", { settingsPathConfigured: Boolean(options.settings?.localSettingsFilePath?.trim()) });
  const baseApplicationSecrets = createInMemorySecretsAdapter();
  const applicationSecrets: ApplicationSecretsPort = {
    async setSecret(key, value) { await baseApplicationSecrets.setSecret(key, value); if (key === HUGGING_FACE_TOKEN_SETTING_KEY) tokenConfigStore.setToken(value); },
    async getSecret(key) { const inMemorySecret = await baseApplicationSecrets.getSecret(key); if (inMemorySecret?.trim()) return inMemorySecret; if (key === HUGGING_FACE_TOKEN_SETTING_KEY) return tokenConfigStore.getToken(); return undefined; },
    async clearSecret(key) { await baseApplicationSecrets.clearSecret(key); if (key === HUGGING_FACE_TOKEN_SETTING_KEY) tokenConfigStore.clearToken(); },
    async hasSecret(key) { if (await baseApplicationSecrets.hasSecret(key)) return true; if (key === HUGGING_FACE_TOKEN_SETTING_KEY) return Boolean(tokenConfigStore.getToken()?.trim()); return false; },
  };
  const modelDefaultResolver = new DefaultModelDefaultResolver({ settings: applicationSettings });
  const readRuntimeSettingString = async (key: string): Promise<string | undefined> => {
    const value = (await applicationSettings.readValues({ keys: [key] }))[0]?.value;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };

  let pythonRuntimeFoundationPromise: Promise<DesktopPythonRuntimeFeature> | undefined;
  const getPythonRuntimeFoundation = async () => {
    if (!pythonRuntimeFoundationPromise) {
      pythonRuntimeFoundationPromise = (async () => {
        recordHostMemorySnapshot("desktop.host.python-runtime-foundation.import.before");
        const module = await import("./composeDesktopPythonRuntimeFeature");
        recordHostMemorySnapshot("desktop.host.python-runtime-foundation.import.after");
        recordHostMemorySnapshot("desktop.host.python-runtime-foundation.compose.before");
        const feature = await module.composeDesktopPythonRuntimeFeature({ loggingPort, now, runtimeLogs, recordRuntimeLog });
        recordHostMemorySnapshot("desktop.host.python-runtime-foundation.compose.after", { baseUrlConfigured: Boolean(resolvePythonRuntimeBaseUrl()) });
        return feature;
      })();
    }
    return pythonRuntimeFoundationPromise;
  };

  const readPythonRuntimeStatus = async (): Promise<DesktopPythonRuntimeStatusPayload> => {
    if (!pythonRuntimeFoundationPromise) {
      const status = createUnavailablePythonRuntimeStatus({ runtimeLogs, memoryUsagePercent: readMemoryUsagePercent(), cpuUsagePercent: readCpuUsagePercent() });
      if (!lastObservedRuntimeHealthSnapshot) {
        lastObservedRuntimeHealthSnapshot = { supervisorStatus: "stopped", runtimeStatus: "unavailable", healthy: false };
        recordRuntimeLog({ level: "warn", message: "Python runtime health changed: supervisor=stopped, status=unavailable, healthy=false." });
        return { ...status, logs: [...runtimeLogs] };
      }
      return status;
    }
    const pythonRuntimeFoundation = await pythonRuntimeFoundationPromise;
    const supervisorStatus = pythonRuntimeFoundation.supervisor.getStatus();
    let healthy = false;
    let runtimeStatus = supervisorStatus === "ready" ? "ready" : supervisorStatus;
    let capabilities: string[] = [];
    let loadedModels: DesktopPythonRuntimeStatusPayload["loadedModels"] = [];
    let activeTaskCount = 0;
    if (supervisorStatus === "starting" || supervisorStatus === "ready") {
      try {
        const [health, runtimeCapabilities, modelStatus] = await Promise.all([pythonRuntimeFoundation.runtimePort.getHealthStatus(), pythonRuntimeFoundation.runtimePort.getCapabilities(), pythonRuntimeFoundation.runtimePort.getModelStatus()]);
        healthy = health.healthy;
        runtimeStatus = health.status.status;
        capabilities = runtimeCapabilities.capabilities;
        loadedModels = modelStatus.loadedModels;
        activeTaskCount = modelStatus.activeTaskCount;
      } catch (error) {
        runtimeStatus = "unavailable";
        const diagnosticsMessage = error instanceof Error ? error.message : String(error);
        if (lastObservedRuntimeHealthSnapshot?.runtimeStatus !== "unavailable") recordRuntimeLog({ level: "warn", message: `Unable to read Python runtime diagnostics: ${diagnosticsMessage}` });
      }
    }
    const nextHealthSnapshot = { supervisorStatus, runtimeStatus, healthy };
    const healthChanged = lastObservedRuntimeHealthSnapshot === undefined || lastObservedRuntimeHealthSnapshot.supervisorStatus !== nextHealthSnapshot.supervisorStatus || lastObservedRuntimeHealthSnapshot.runtimeStatus !== nextHealthSnapshot.runtimeStatus || lastObservedRuntimeHealthSnapshot.healthy !== nextHealthSnapshot.healthy;
    if (healthChanged) {
      recordRuntimeLog({ level: healthy ? "info" : "warn", message: `Python runtime health changed: supervisor=${supervisorStatus}, status=${runtimeStatus}, healthy=${healthy}.` });
      lastObservedRuntimeHealthSnapshot = nextHealthSnapshot;
    }
    return { supervisorStatus: supervisorStatus as DesktopPythonRuntimeStatusPayload["supervisorStatus"], healthy, runtimeStatus, capabilities, loadedModels, activeTaskCount, systemResources: { memoryUsagePercent: readMemoryUsagePercent(), cpuUsagePercent: readCpuUsagePercent(), gpuUsagePercent: 0 }, logs: [...runtimeLogs] };
  };

  const lazyPowerSuspensionBlocker: PowerSuspensionBlockerPort = {
    async startBlocker() { return { blockerId: "deferred-power-blocker", active: false }; },
    async stopBlocker(blockerId: string) { return { blockerId, active: false }; },
    async listBlockers() { return []; },
  };
  let internalAssetRegistry: InternalAssetRegistryComposition | undefined;
  recordHostMemorySnapshot("desktop.host.compose.return");

  return {
    loggingPort,
    loggingConfig,
    applicationSettings,
    applicationSecrets,
    modelDefaultResolver,
    powerSuspensionBlocker: lazyPowerSuspensionBlocker,
    getHuggingFaceTokenStatus: () => tokenConfigStore.getStatus(),
    setHuggingFaceToken: (token) => tokenConfigStore.setToken(token),
    clearHuggingFaceToken: () => tokenConfigStore.clearToken(),
    async startPythonRuntime() { recordRuntimeLog({ level: "info", message: "Starting Python runtime." }); await (await getPythonRuntimeFoundation()).supervisor.start(); },
    async stopPythonRuntime() { if (!pythonRuntimeFoundationPromise) return; recordRuntimeLog({ level: "info", message: "Stopping Python runtime." }); await (await pythonRuntimeFoundationPromise).supervisor.stop(); },
    async restartPythonRuntime() { recordRuntimeLog({ level: "info", message: "Restarting Python runtime." }); await (await getPythonRuntimeFoundation()).supervisor.restart(); },
    async unloadPythonRuntimeModel() { recordRuntimeLog({ level: "info", message: "Unloading Python runtime generation model from memory." }); const result = await (await getPythonRuntimeFoundation()).runtimePort.unloadModels(); recordRuntimeLog({ level: "info", message: `Unloaded ${result.unloadedModels.length} Python runtime generation model(s) from memory.` }); },
    async clearPythonRuntimeLogs() { runtimeLogs.splice(0, runtimeLogs.length); recordRuntimeLog({ level: "info", message: "Cleared Python runtime activity log." }); },
    readPythonRuntimeStatus,
    async getPythonRuntimeDiagnostics() { const status = await readPythonRuntimeStatus(); return { status: status.runtimeStatus, healthy: status.healthy, capabilities: status.capabilities }; },
    getInternalAssetRegistry() { return internalAssetRegistry; },
    getFeatureLifecycleState: featureLifecycle.getFeatureLifecycleState,
    disposeFeature: featureLifecycle.disposeFeature,
    markFeatureIdle: featureLifecycle.markFeatureIdle,
    disposeIdleFeatures: featureLifecycle.disposeIdleFeatures,
    registerDesktopIpc(registerOptions) {
      recordHostMemorySnapshot("desktop.host.ipc-registration.enter", { hasRuntimeRootDirectory: Boolean(registerOptions.runtimeRootDirectory), hasStorageRootDirectory: Boolean(registerOptions.storageRootDirectory) });
      const getStartupWorkspaceShell = memoizeSyncFeature("desktop.host.startup-workspace-shell.compose", () => {
        const workspaceRepository = createLocalWorkspaceRepository({ rootDirectory: registerOptions.storageRootDirectory });
        const workspaceSelectionRepository = createLocalWorkspaceSelectionRepository({ rootDirectory: registerOptions.storageRootDirectory });
        const systemPackActivationRepository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory: registerOptions.storageRootDirectory });
        const createWorkspaceUseCase = new CreateWorkspaceUseCase({ workspaceRepository, workspaceSelectionRepository, systemPackActivationRepository });
        return { workspaceRepository, workspaceSelectionRepository, systemPackActivationRepository, createWorkspaceUseCase };
      });
      const startupWorkspaceShell = getStartupWorkspaceShell();
      const runtimeReadiness = createDesktopRuntimeReadinessService({
        readPythonSupervisorState: () => "stopped",
        readComfyUiLifecycleState: () => "uninitialized",
        async readComfyUiInstallStatus() { return "unknown"; },
        now,
      });
      const getArtifactFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "artifact-local", policy: "retained", milestoneBase: "desktop.host.artifact-features", importFeature: async () => {
        const module = await import("./composeDesktopArtifactFeature");
        return () => module.composeDesktopArtifactFeature({ storageRootDirectory: registerOptions.storageRootDirectory, loggingPort, now: options.now, workspaceShell: startupWorkspaceShell });
      }});
      const getArtifactRemoteFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "artifact-remote", policy: "disposable", milestoneBase: "desktop.host.artifact-remote-features", importFeature: async () => {
        const module = await import("./composeDesktopArtifactRemoteFeature");
        return async () => module.composeDesktopArtifactRemoteFeature({ artifacts: await getArtifactFeatures(), loggingPort, now: options.now, tokenProvider: () => tokenConfigStore.getToken(), huggingFaceFetchImplementation: options.artifactRepo?.huggingFaceFetchImplementation });
      }});
      const getAssetFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "asset-registry", policy: "retained", milestoneBase: "desktop.host.asset-features", importFeature: async () => {
        const module = await import("./composeDesktopAssetFeature");
        return async () => module.composeDesktopAssetFeature({ storageRootDirectory: registerOptions.storageRootDirectory, now, artifacts: await getArtifactFeatures(), onInternalAssetRegistry: (registry) => { internalAssetRegistry = registry; } });
      }});
      const getComfyUiInstallFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "comfyui-install", policy: "retained", milestoneBase: "desktop.host.comfyui-install-features", importFeature: async () => {
        const module = await import("./composeDesktopComfyUiInstallFeature");
        return () => module.composeDesktopComfyUiInstallFeature({ runtimeRootDirectory: registerOptions.runtimeRootDirectory, loggingPort });
      }});
      const getComfyUiImageRuntimeFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "comfyui-image-runtime", policy: "explicit-unload-only", milestoneBase: "desktop.host.comfyui-image-runtime-features", importFeature: async () => {
        const module = await import("./composeDesktopComfyUiImageRuntimeFeature");
        return () => module.composeDesktopComfyUiImageRuntimeFeature({ runtimeRootDirectory: registerOptions.runtimeRootDirectory, loggingPort, applicationSettings, readRuntimeSettingString, getArtifacts: getArtifactFeatures });
      }});
      const getRuntimeTaskFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "runtime-task-registry", policy: "explicit-unload-only", milestoneBase: "desktop.host.runtime-task-features", importFeature: async () => {
        const module = await import("./composeDesktopRuntimeTaskFeature");
        return async () => module.composeDesktopRuntimeTaskFeature({ pythonRuntimeFoundation: await getPythonRuntimeFoundation(), imageRuntimeTaskRegistry: (await getComfyUiImageRuntimeFeatures()).imageRuntimeTaskRegistry, runtimeReadiness, recordMilestone: recordHostMemorySnapshot });
      }});
      const getModelFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "model-registry", policy: "retained", milestoneBase: "desktop.host.model-features", importFeature: async () => {
        const module = await import("./composeDesktopModelFeature");
        return () => module.composeDesktopModelFeature({ storageRootDirectory: registerOptions.storageRootDirectory, now, tokenProvider: () => tokenConfigStore.getToken(), getArtifacts: getArtifactFeatures, getRuntimeTaskFeatures, getPythonRuntimeFoundation });
      }});
      const getImageGenerationFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "image-generation", policy: "disposable", milestoneBase: "desktop.host.image-generation-features", importFeature: async () => {
        const module = await import("./composeDesktopImageGenerationFeature");
        return async () => module.composeDesktopImageGenerationFeature({ storageRootDirectory: registerOptions.storageRootDirectory, loggingPort, now, recordRuntimeLog, artifacts: await getArtifactFeatures(), assets: await getAssetFeatures(), runtime: await getRuntimeTaskFeatures(), comfyUi: await getComfyUiImageRuntimeFeatures() });
      }});
      const getIngestionFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "website-ingestion", policy: "disposable", milestoneBase: "desktop.host.ingestion-features", importFeature: async () => {
        const module = await import("./composeDesktopIngestionFeature");
        return async () => module.composeDesktopIngestionFeature({ artifacts: await getArtifactFeatures(), now: options.now });
      }});
      const getDatasetPreparationFeatures = featureLifecycle.registerAsyncFeature({ featureKey: "dataset-preparation", policy: "disposable", milestoneBase: "desktop.host.dataset-preparation-features", importFeature: async () => {
        const module = await import("./composeDesktopDatasetPreparationFeature");
        return async () => module.composeDesktopDatasetPreparationFeature({ artifacts: await getArtifactFeatures(), runtime: await getRuntimeTaskFeatures(), getArtifactRemoteFeatures, now: options.now });
      }});
      const settingsUseCases = {
        listSettingsDefinitionsUseCase: new ListSettingsDefinitionsUseCase({ settings: applicationSettings }),
        readSettingsUseCase: new ReadSettingsUseCase({ settings: applicationSettings, secrets: applicationSecrets }),
        updateSettingUseCase: new UpdateSettingUseCase({ settings: applicationSettings, secrets: applicationSecrets }),
        clearSettingUseCase: new ClearSettingUseCase({ settings: applicationSettings, secrets: applicationSecrets }),
        resolveModelDefaultUseCase: new ResolveModelDefaultUseCase({ modelDefaultResolver }),
      };
      recordHostMemorySnapshot("desktop.host.ipc-registration.lazy-handlers.before");
      registerElectronIpc({
        recordMilestone: recordHostMemorySnapshot,
        startup: {
          ipcMain: registerOptions.ipcMain,
          pythonRuntime: {
            startPythonRuntime: async () => (await getPythonRuntimeFoundation()).supervisor.start(),
            stopPythonRuntime: async () => { if (pythonRuntimeFoundationPromise) await (await pythonRuntimeFoundationPromise).supervisor.stop(); },
            restartPythonRuntime: async () => (await getPythonRuntimeFoundation()).supervisor.restart(),
            unloadPythonRuntimeModel: async () => { const result = await (await getPythonRuntimeFoundation()).runtimePort.unloadModels(); recordRuntimeLog({ level: "info", message: `Unloaded ${result.unloadedModels.length} Python runtime generation model(s) from memory.` }); },
            clearPythonRuntimeLogs: async () => { runtimeLogs.splice(0, runtimeLogs.length); recordRuntimeLog({ level: "info", message: "Cleared Python runtime activity log." }); },
            readPythonRuntimeStatus,
          },
          runtimeReadiness,
          workspaceServices: startupWorkspaceShell,
          settingsUseCases,
        },
        artifact: {
          ipcMain: registerOptions.ipcMain,
          tokens: { getHuggingFaceTokenStatus: () => tokenConfigStore.getStatus(), setHuggingFaceToken: (token) => tokenConfigStore.setToken(token), clearHuggingFaceToken: () => tokenConfigStore.clearToken() },
          getArtifactFeature: getArtifactFeatures,
          getArtifactRemoteFeature: getArtifactRemoteFeatures,
        },
        asset: { ipcMain: registerOptions.ipcMain, getAssetFeature: getAssetFeatures },
        model: { ipcMain: registerOptions.ipcMain, getModelFeature: getModelFeatures },
        imageGeneration: { ipcMain: registerOptions.ipcMain, getImageGenerationFeature: getImageGenerationFeatures },
        runtime: { ipcMain: registerOptions.ipcMain, getComfyUiFeature: getComfyUiInstallFeatures },
        ingestion: { ipcMain: registerOptions.ipcMain, getIngestionFeature: getIngestionFeatures },
        datasetPreparation: { ipcMain: registerOptions.ipcMain, getDatasetPreparationFeature: getDatasetPreparationFeatures },
      });
      recordHostMemorySnapshot("desktop.host.ipc-registration.lazy-handlers.after");
      recordHostMemorySnapshot("desktop.host.ipc-registration.return");
    },
    registerArtifactUploadIpc(registerOptions) { this.registerDesktopIpc(registerOptions); },
  };
}
