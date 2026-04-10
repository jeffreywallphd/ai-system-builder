import started from "electron-squirrel-startup";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, safeStorage, session } from "electron";
import { InitializeProductionStorageUseCase } from "../../src/application/runtime/InitializeProductionStorageUseCase";
import { GetExecutionRunUseCase } from "../../src/application/execution/GetExecutionRunUseCase";
import { resolveDesktopStoragePaths } from "../../src/infrastructure/desktop/DesktopAppPaths";
import { DesktopStorageDatabase } from "../../src/infrastructure/desktop/DesktopStorageDatabase";
import { DesktopWorkflowPersistence } from "../../src/infrastructure/desktop/DesktopWorkflowPersistence";
import { SqliteExecutionRunRepository } from "../../src/infrastructure/filesystem/execution/SqliteExecutionRunRepository";
import {
  createExecutionHistoryInfrastructure,
  createExecutionRunRepository,
} from "../../src/infrastructure/execution/createExecutionInfrastructure";
import { resolveDesktopPythonRuntime } from "../../src/infrastructure/desktop/DesktopPythonRuntimeResolver";
import { AppRuntimeConfig } from "../../src/infrastructure/config/AppRuntimeConfig";
import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../src/infrastructure/config/HostSecureTransportConfig";
import { RendererDeliveryModes } from "../../src/domain/runtime/AppRuntimeProfile";
import { DesktopServiceSupervisor } from "./DesktopServiceSupervisor";
import type {
  DesktopBootstrapContext,
  DesktopIdentityTransportTrustBootstrap,
} from "../shared/DesktopContracts";
import { SqliteAssetSystemRepository } from "../../src/infrastructure/filesystem/SqliteAssetSystemRepository";
import { SqliteAgentRepository } from "../../src/infrastructure/filesystem/agents/SqliteAgentRepository";
import { SqliteAgentExecutionSessionRepository } from "../../src/infrastructure/filesystem/agents/SqliteAgentExecutionSessionRepository";
import { AgentStudioBackendApi } from "../../src/infrastructure/api/agents/AgentStudioBackendApi";
import { AgentRunnerService } from "../../src/application/agents/services/AgentRunnerService";
import { DeterministicAgentPlanningService } from "../../src/application/agents/services/AgentPlanningInterface";
import { ExecuteAgentToolsUseCase } from "../../src/application/agents/ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../../src/application/agents/services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../../src/application/agents/services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../../src/application/agents/services/AssetBackedAgentMemoryStore";
import { CompositeToolCapabilityCatalog } from "../../src/infrastructure/tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog } from "../../src/infrastructure/tools/StaticLocalToolCapabilityCatalog";
import { McpToolCapabilityCatalog } from "../../src/infrastructure/tools/McpToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../../src/infrastructure/tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "../../src/infrastructure/tools/StaticLocalToolCapabilityExecutor";
import { McpToolCapabilityExecutor } from "../../src/infrastructure/tools/McpToolCapabilityExecutor";
import { DeterministicToolCapabilityAgentOrchestrator } from "../../src/infrastructure/agents/DeterministicToolCapabilityAgentOrchestrator";
import { PythonRuntimeConfig } from "../../src/infrastructure/config/PythonRuntimeConfig";
import { createMcpRuntimeIntegration } from "../../src/infrastructure/python/mcp/createMcpRuntimeIntegration";
import { SqliteAssetSystemAgentMemoryCatalog } from "../../src/infrastructure/filesystem/agents/SqliteAssetSystemAgentMemoryCatalog";
import type { CreateAgentRequest } from "../../src/application/agents/CreateAgentUseCase";
import type { UpdateAgentRequest } from "../../src/application/agents/UpdateAgentUseCase";
import type { ConfigureAgentGoalsRequest } from "../../src/application/agents/ConfigureAgentGoalsUseCase";
import type { AgentPolicy, AgentToolAccessPolicy } from "../../src/domain/agents/AgentPolicy";
import type { AgentMemoryConfiguration } from "../../src/domain/agents/AgentMemory";
import type { AgentPlanningStrategy } from "../../src/domain/agents/Agent";
import type { AgentConfigurationValidationInput } from "../../src/application/agents/services/AgentConfigurationValidationService";
import type { AgentRunControlRequest, AgentRunRequest } from "../../src/application/agents/contracts/AgentRunContracts";
import type { TriggerAgentLaunchRequest } from "../../src/application/agents/TriggerAgentLaunchUseCase";
import { StudioShellBackendApi } from "../../src/infrastructure/api/studio-shell/StudioShellBackendApi";
import { ListPersistedWorkflowsUseCase } from "../../src/application/workflow-persistence/ListPersistedWorkflowsUseCase";
import { ListWorkflowRunSummariesUseCase } from "../../src/application/workflow-run-history/ListWorkflowRunSummariesUseCase";
import { SqliteStudioShellRepository } from "../../src/infrastructure/filesystem/studio-shell/SqliteStudioShellRepository";
import { SqliteWorkflowPersistenceRepository } from "../../src/infrastructure/filesystem/SqliteWorkflowPersistenceRepository";
import { SqliteWorkflowRunSummaryRepository } from "../../src/infrastructure/filesystem/SqliteWorkflowRunSummaryRepository";
import type { CreateAssetDraftCommand, PublishAssetDraftVersionCommand, TransitionAssetDraftLifecycleCommand, UpdateAssetDraftCommand, UpdateAssetDraftDependenciesCommand } from "../../src/application/studio-shell/contracts";
import { SystemStudioBackendApi } from "../../src/infrastructure/api/system-studio/SystemStudioBackendApi";
import { SystemRuntimeBackendApi } from "../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import { SqliteSystemRuntimeExecutionStore } from "../../src/infrastructure/filesystem/system-runtime/SqliteSystemRuntimeExecutionStore";
import { SqliteExecutionAuditRepository } from "../../src/infrastructure/filesystem/system-runtime/SqliteExecutionAuditRepository";
import { SqliteImageRunHistoryRepository } from "../../src/infrastructure/filesystem/system-runtime/SqliteImageRunHistoryRepository";
import { SqliteImageWorkflowSystemPersistenceAdapter } from "../../src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceAdapter";
import { LocalStorageInstanceProvisioner } from "../../src/infrastructure/filesystem/system-runtime/LocalStorageInstanceProvisioner";
import { LocalSystemOutputArtifactStorage } from "../../src/infrastructure/filesystem/system-runtime/LocalSystemOutputArtifactStorage";
import { LocalStorageInstanceLifecycleInfrastructure } from "../../src/infrastructure/filesystem/system-runtime/LocalStorageInstanceLifecycleInfrastructure";
import {
  parseSystemRuntimeWindowLaunchContract,
  SystemRuntimeWindowLaunchQueryParam,
  type LaunchSystemRuntimeWindowReadModel,
} from "../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";
import { createRendererContentSecurityPolicy } from "./RendererContentSecurityPolicy";
import { resolveModelFileAbsolutePath, toLogicalModelPath } from "./ModelFilePathPolicy";
import { startDesktopHostAssembly, type DesktopHostRuntimeHandle } from "../../src/hosts/desktop/DesktopHostEntrypoint";
import {
  DesktopConnectivityStateService,
  type DesktopConnectivityProbePort,
} from "../../src/hosts/desktop/DesktopConnectivityStateService";
import {
  startAuthoritativeServerHostAssembly,
  type AuthoritativeServerHostRuntimeHandle,
} from "../../src/hosts/server/AuthoritativeServerHostEntrypoint";

// Provide ESM-safe CommonJS path globals for runtime compatibility with CJS dependencies.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (started) {
  app.quit();
}
const repoRoot = path.resolve(__dirname, "../..");
const isPackaged = app.isPackaged;
const rendererDevUrl = process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:5174";
const preloadScriptPath = resolvePreloadScriptPath();

function resolvePreloadScriptPath(): string {
  const preloadCandidates = [
    path.join(__dirname, "preload.cjs"),
    path.join(__dirname, "../preload.cjs"),
    path.join(__dirname, "preload.mjs"),
    path.join(__dirname, "../preload.mjs"),
  ];
  const resolvedPath = preloadCandidates.find((candidate) => fs.existsSync(candidate));
  if (!resolvedPath) {
    return preloadCandidates[0];
  }
  return resolvedPath;
}

function installRendererContentSecurityPolicy(): void {
  const policy = createRendererContentSecurityPolicy({
    rendererDevUrl,
    runtimeConfig: bootstrapContext?.runtimeConfig,
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
    responseHeaders["Content-Security-Policy"] = [policy];
    callback({ responseHeaders });
  });
}

let mainWindow: BrowserWindow | undefined;
let storageDatabase: DesktopStorageDatabase | undefined;
let workflowPersistence: DesktopWorkflowPersistence | undefined;
let executionRunRepository: SqliteExecutionRunRepository | undefined;
let getExecutionRunUseCase: GetExecutionRunUseCase | undefined;
let listExecutionRunsUseCase: ReturnType<typeof createExecutionHistoryInfrastructure>["listExecutionRunsUseCase"] | undefined;
let workflowRunSummaryRepository: SqliteWorkflowRunSummaryRepository | undefined;
let listWorkflowRunSummariesUseCase: ListWorkflowRunSummariesUseCase | undefined;
let agentRepository: SqliteAgentRepository | undefined;
let agentSessionRepository: SqliteAgentExecutionSessionRepository | undefined;
let agentRunnerAssetSystemRepository: SqliteAssetSystemRepository | undefined;
let agentStudioBackendApi: AgentStudioBackendApi | undefined;
let serviceSupervisor: DesktopServiceSupervisor | undefined;
let authoritativeServerRuntime: AuthoritativeServerHostRuntimeHandle | undefined;
let studioShellRepository: SqliteStudioShellRepository | undefined;
let workflowPersistenceRepository: SqliteWorkflowPersistenceRepository | undefined;
let bootstrapContext: DesktopBootstrapContext | undefined;
let desktopHostRuntime: DesktopHostRuntimeHandle | undefined;
let desktopConnectivityStateService: DesktopConnectivityStateService | undefined;
type CanonicalRegistryRuntime = {
  readonly repository: SqliteAssetSystemRepository;
  readonly listCanonicalAssetsUseCase: any;
  readonly loadCanonicalAssetDetailUseCase: any;
  readonly getVersionHistoryUseCase: any;
  readonly dependencyStateUseCase: any;
  readonly replayScopedProjectionUseCase: any;
  readonly verifyProjectionUseCase: any;
  readonly projectionTrustReadModelService: any;
  readonly rebuildProjectionOrchestrationUseCase: any;
  readonly loadManagementSnapshotUseCase: any;
  readonly reconcileIdentityUseCase: any;
  readonly registryBackendApi: any;
};
let canonicalRegistryRuntime: CanonicalRegistryRuntime | undefined;
const runtimeWindowByReuseKey = new Map<string, BrowserWindow>();
const IDENTITY_SESSION_STORAGE_KEY = "ai-loom.identity.session.v1";
const CONNECTIVITY_PROBE_TIMEOUT_MS = 1_750;

const DESKTOP_TRUST_STORAGE_KEYS = Object.freeze({
  trustedDeviceBindingId: "identity.desktop.transport.trusted-device-binding-id",
  trustMarker: "identity.desktop.transport.trust-marker",
  materialKind: "identity.desktop.transport.material-kind",
  pinReference: "identity.desktop.transport.pin-reference",
  publicKeyFingerprint: "identity.desktop.transport.public-key-fingerprint",
  issuedAt: "identity.desktop.transport.issued-at",
  expiresAt: "identity.desktop.transport.expires-at",
});

const DESKTOP_TRUST_ENV_KEYS = Object.freeze({
  enforcement: "AI_LOOM_DESKTOP_TRUST_BOOTSTRAP_ENFORCEMENT",
  trustedDeviceBindingId: "AI_LOOM_DESKTOP_TRUSTED_DEVICE_BINDING_ID",
  trustMarker: "AI_LOOM_DESKTOP_TRUST_MARKER",
  materialKind: "AI_LOOM_DESKTOP_TRUST_MATERIAL_KIND",
  pinReference: "AI_LOOM_DESKTOP_TRUST_PIN_REFERENCE",
  publicKeyFingerprint: "AI_LOOM_DESKTOP_TRUST_PUBLIC_KEY_FINGERPRINT",
  issuedAt: "AI_LOOM_DESKTOP_TRUST_ISSUED_AT",
  expiresAt: "AI_LOOM_DESKTOP_TRUST_EXPIRES_AT",
});

function createRendererSearch(params: Record<string, string | undefined>): string | undefined {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : undefined;
}

function toFileEntry(modelsRootPath: string, filePath: string) {
  const stats = fs.statSync(filePath);
  return {
    path: toLogicalModelPath(modelsRootPath, filePath),
    kind: stats.isDirectory() ? "directory" as const : "file" as const,
    size: stats.isFile() ? stats.size : undefined,
    modifiedAt: stats.mtime.toISOString(),
  };
}

function listEntries(modelsRootPath: string, rootPath: string, recursive = false): ReadonlyArray<ReturnType<typeof toFileEntry>> {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const results: ReturnType<typeof toFileEntry>[] = [];
  const walk = (currentPath: string) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      results.push(toFileEntry(modelsRootPath, entryPath));
      if (recursive && entry.isDirectory()) {
        walk(entryPath);
      }
    }
  };
  walk(rootPath);
  return results;
}

function resolveDesktopIdentityTransportTrustBootstrap(): DesktopIdentityTransportTrustBootstrap | undefined {
  const enforcement = normalizeTrustBootstrapEnforcement(process.env[DESKTOP_TRUST_ENV_KEYS.enforcement]);
  const trustedDeviceBindingId = readDesktopTrustValue({
    storageKey: DESKTOP_TRUST_STORAGE_KEYS.trustedDeviceBindingId,
    envKey: DESKTOP_TRUST_ENV_KEYS.trustedDeviceBindingId,
  });
  const pinReference = readDesktopTrustSecretValue({
    storageKey: DESKTOP_TRUST_STORAGE_KEYS.pinReference,
    envKey: DESKTOP_TRUST_ENV_KEYS.pinReference,
  });

  const trustConfigured = Boolean(trustedDeviceBindingId || pinReference);
  const effectiveEnforcement = enforcement ?? (trustConfigured ? "required" : "optional");
  if (!trustConfigured && effectiveEnforcement !== "required") {
    return undefined;
  }

  const materialKind = normalizeMaterialKind(
    readDesktopTrustValue({
      storageKey: DESKTOP_TRUST_STORAGE_KEYS.materialKind,
      envKey: DESKTOP_TRUST_ENV_KEYS.materialKind,
    }),
  ) ?? "opaque-marker";

  return Object.freeze({
    enforcement: effectiveEnforcement,
    registeredDevice: trustedDeviceBindingId
      ? Object.freeze({
          trustedDeviceBindingId,
          trustMarker: readDesktopTrustSecretValue({
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.trustMarker,
            envKey: DESKTOP_TRUST_ENV_KEYS.trustMarker,
          }),
        })
      : undefined,
    pinnedTrustMaterial: pinReference
      ? Object.freeze({
          pinReference,
          materialKind,
          publicKeyFingerprint: readDesktopTrustValue({
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.publicKeyFingerprint,
            envKey: DESKTOP_TRUST_ENV_KEYS.publicKeyFingerprint,
          }),
          issuedAt: readDesktopTrustValue({
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.issuedAt,
            envKey: DESKTOP_TRUST_ENV_KEYS.issuedAt,
          }),
          expiresAt: readDesktopTrustValue({
            storageKey: DESKTOP_TRUST_STORAGE_KEYS.expiresAt,
            envKey: DESKTOP_TRUST_ENV_KEYS.expiresAt,
          }),
        })
      : undefined,
  });
}

function readDesktopTrustValue(input: {
  readonly storageKey: string;
  readonly envKey: string;
}): string | undefined {
  const fromStorage = normalizeOptional(storageDatabase?.getItem(input.storageKey) ?? undefined);
  if (fromStorage) {
    return fromStorage;
  }
  return normalizeOptional(process.env[input.envKey]);
}

function readDesktopTrustSecretValue(input: {
  readonly storageKey: string;
  readonly envKey: string;
}): string | undefined {
  const encoded = storageDatabase?.getItem(`secure:${input.storageKey}`);
  if (encoded) {
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      const normalized = normalizeOptional(decrypted);
      if (normalized) {
        return normalized;
      }
    } catch {
      // fall through to non-secret and env fallback
    }
  }
  return readDesktopTrustValue(input);
}

function normalizeMaterialKind(
  value: string | undefined,
): "session-signing-key" | "attestation-key" | "opaque-marker" | undefined {
  if (value === "session-signing-key" || value === "attestation-key" || value === "opaque-marker") {
    return value;
  }
  return undefined;
}

function normalizeTrustBootstrapEnforcement(value: string | undefined): "required" | "optional" | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (normalized === "required" || normalized === "optional") {
    return normalized;
  }
  return undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeHttpOrigin(value: string): string | undefined {
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
}

function createDesktopConnectivityProbePort(identityApiBaseUrl: string): DesktopConnectivityProbePort {
  return Object.freeze({
    probe: async () => {
      const trustBootstrap = resolveDesktopIdentityTransportTrustBootstrap();
      const trustEnforcement = trustBootstrap?.enforcement ?? "optional";
      const trustPrerequisitesSatisfied = evaluateTrustPrerequisitesSatisfied(trustBootstrap);
      const trustedSession = resolveTrustedSessionAvailability(trustEnforcement);
      const transport = await probeTransportReachability(identityApiBaseUrl);
      return Object.freeze({
        transportReachable: transport.transportReachable,
        transportTransientFailure: transport.transportTransientFailure,
        transportDetail: transport.transportDetail,
        trustedSessionAvailable: trustedSession.available,
        trustedSessionDetail: trustedSession.detail,
        trustPrerequisitesSatisfied,
        trustPrerequisitesDetail: trustPrerequisitesSatisfied
          ? undefined
          : "Desktop trust bootstrap prerequisites are incomplete for trusted-session operation.",
        trustEnforcement,
      });
    },
  });
}

function evaluateTrustPrerequisitesSatisfied(
  bootstrap: DesktopIdentityTransportTrustBootstrap | undefined,
): boolean {
  if (!bootstrap || bootstrap.enforcement !== "required") {
    return true;
  }
  const trustedDeviceBindingId = normalizeOptional(bootstrap.registeredDevice?.trustedDeviceBindingId);
  const pinReference = normalizeOptional(bootstrap.pinnedTrustMaterial?.pinReference);
  const expiresAt = normalizeOptional(bootstrap.pinnedTrustMaterial?.expiresAt);
  if (!trustedDeviceBindingId || !pinReference) {
    return false;
  }
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    return false;
  }
  return true;
}

function resolveTrustedSessionAvailability(
  trustEnforcement: "required" | "optional",
): { readonly available: boolean; readonly detail?: string } {
  const payload = storageDatabase?.getItem(IDENTITY_SESSION_STORAGE_KEY);
  if (!payload) {
    return Object.freeze({
      available: false,
      detail: "No persisted authenticated session was found in desktop storage.",
    });
  }
  try {
    const parsed = JSON.parse(payload) as {
      readonly sessionToken?: string;
      readonly sessionExpiresAt?: string;
      readonly sessionTrustState?: string;
    };
    const sessionToken = normalizeOptional(parsed.sessionToken);
    if (!sessionToken) {
      return Object.freeze({
        available: false,
        detail: "Persisted desktop session is missing a session token.",
      });
    }
    const expiresAt = normalizeOptional(parsed.sessionExpiresAt);
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return Object.freeze({
        available: false,
        detail: "Persisted desktop session is expired.",
      });
    }
    const trustState = normalizeOptional(parsed.sessionTrustState);
    if (trustEnforcement === "required" && trustState !== "trusted") {
      return Object.freeze({
        available: false,
        detail: "Persisted desktop session is not trusted under required trust enforcement.",
      });
    }
    if (trustState === "revoked" || trustState === "expired") {
      return Object.freeze({
        available: false,
        detail: `Persisted desktop session trust state '${trustState}' is not eligible for trusted operation.`,
      });
    }
    return Object.freeze({ available: true });
  } catch {
    return Object.freeze({
      available: false,
      detail: "Persisted desktop session payload is invalid JSON.",
    });
  }
}

async function probeTransportReachability(identityApiBaseUrl: string): Promise<{
  readonly transportReachable: boolean;
  readonly transportTransientFailure?: boolean;
  readonly transportDetail?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CONNECTIVITY_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(identityApiBaseUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return Object.freeze({
      transportReachable: true,
      transportTransientFailure: false,
      transportDetail: `Authoritative server probe responded with HTTP ${response.status}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connectivity probe error.";
    return Object.freeze({
      transportReachable: false,
      transportTransientFailure: true,
      transportDetail: message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function logInitializationStart(phase: string): number {
  const startedAt = Date.now();
  console.info(`\n[ai-loom][init] ${phase}:start startedAt=${new Date(startedAt).toISOString()}\n`);
  return startedAt;
}

function logInitializationEnd(phase: string, startedAt: number): void {
  const endedAt = Date.now();
  console.info(
    `\n[ai-loom][init] ${phase}:end durationMs=${endedAt - startedAt} startedAt=${new Date(startedAt).toISOString()} endedAt=${new Date(endedAt).toISOString()}\n`,
  );
}

function logInitializationCheckpoint(
  phase: string,
  checkpoint: string,
  startedAt: number,
): void {
  const now = Date.now();
  console.info(
    `\n[ai-loom][init] ${phase}:checkpoint name=${checkpoint} elapsedMs=${now - startedAt} at=${new Date(now).toISOString()}\n`,
  );
}

function logInitializationMemory(phase: string, checkpoint: string): void {
  const usage = process.memoryUsage();
  console.info(
    `\n[ai-loom][memory] ${phase}:checkpoint name=${checkpoint} rssMB=${toMegabytes(usage.rss)} heapUsedMB=${toMegabytes(usage.heapUsed)} heapTotalMB=${toMegabytes(usage.heapTotal)} externalMB=${toMegabytes(usage.external)} arrayBuffersMB=${toMegabytes(usage.arrayBuffers)} at=${new Date().toISOString()}\n`,
  );
}

function toMegabytes(value: number): string {
  return (value / (1024 * 1024)).toFixed(1);
}

function createDesktopAgentRunner(params: {
  readonly assetSystemRepository: SqliteAssetSystemRepository;
  readonly sessionRepository: SqliteAgentExecutionSessionRepository;
}): AgentRunnerService {
  const pythonConfig = PythonRuntimeConfig.fromEnv(process.env);
  const mcpIntegration = createMcpRuntimeIntegration(pythonConfig);
  const toolCatalog = new CompositeToolCapabilityCatalog([
    new StaticLocalToolCapabilityCatalog([]),
    new McpToolCapabilityCatalog(mcpIntegration.toolCatalog),
  ]);
  const toolExecutor = new CompositeToolCapabilityExecutor([
    {
      providerKind: "local",
      providerId: "local-runtime",
      executor: new StaticLocalToolCapabilityExecutor({}),
    },
    {
      providerKind: "mcp",
      providerId: "python-mcp-runtime",
      executor: new McpToolCapabilityExecutor(mcpIntegration.toolExecutor),
    },
  ]);
  const memoryStore = new AssetBackedAgentMemoryStore(
    new SqliteAssetSystemAgentMemoryCatalog(params.assetSystemRepository),
    params.assetSystemRepository,
  );
  return new AgentRunnerService(
    new DeterministicAgentPlanningService(toolCatalog, memoryStore),
    new ExecuteAgentToolsUseCase(toolCatalog, new DeterministicToolCapabilityAgentOrchestrator(toolExecutor)),
    new DefaultAgentMemoryRetrievalService(memoryStore),
    new AgentMemoryWriteService(memoryStore),
    undefined,
    undefined,
    params.sessionRepository,
  );
}

function ensureAgentStudioBackendApi(
  storagePaths: ReturnType<typeof resolveDesktopStoragePaths>,
): AgentStudioBackendApi {
  if (agentStudioBackendApi) {
    return agentStudioBackendApi;
  }
  agentRepository = new SqliteAgentRepository(path.join(storagePaths.storageDirectory, "agents", "agents.sqlite"));
  agentSessionRepository = new SqliteAgentExecutionSessionRepository(path.join(storagePaths.storageDirectory, "agents", "agent-sessions.sqlite"));
  agentRunnerAssetSystemRepository = new SqliteAssetSystemRepository(path.join(storagePaths.assetsDirectory, "asset-system.sqlite"));
  const agentRunner = createDesktopAgentRunner({
    assetSystemRepository: agentRunnerAssetSystemRepository,
    sessionRepository: agentSessionRepository,
  });
  agentStudioBackendApi = new AgentStudioBackendApi(agentRepository, agentSessionRepository, agentRunner);
  logInitializationMemory("desktop-runtime-bootstrap", "agent-runtime-ready");
  return agentStudioBackendApi;
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadScriptPath,
    },
  });

  mainWindow = window;
  window.once("ready-to-show", () => window.show());

  await loadRendererRoot(window);
}

async function loadRendererRoot(window: BrowserWindow, search?: string): Promise<void> {
  const runtimeConfig = bootstrapContext?.runtimeConfig;
  if (runtimeConfig?.rendererDeliveryMode === RendererDeliveryModes.packagedAssets) {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"), {
      search,
    });
  } else {
    const url = new URL(rendererDevUrl);
    url.pathname = "/";
    if (search) {
      url.search = search.startsWith("?") ? search.slice(1) : search;
    }
    await window.loadURL(url.toString());
    if (window === mainWindow) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  }
}

async function launchRuntimeWindowFromContract(
  launchContractJson: string,
): Promise<LaunchSystemRuntimeWindowReadModel> {
  const contract = parseSystemRuntimeWindowLaunchContract(launchContractJson);
  if (!contract) {
    throw new Error("invalid-request:Runtime window launch contract is missing or invalid.");
  }

  const reuseWindowKey = contract.windowIntent.reuseWindowKey?.trim();
  if (reuseWindowKey) {
    const existing = runtimeWindowByReuseKey.get(reuseWindowKey);
    if (existing && !existing.isDestroyed()) {
      const search = createRendererSearch({
        [SystemRuntimeWindowLaunchQueryParam]: launchContractJson,
      });
      await loadRendererRoot(existing, search);
      if (contract.windowIntent.focus === "foreground") {
        existing.focus();
      }
      return Object.freeze({
        launchId: contract.launchId,
        launchedAt: new Date().toISOString(),
        targetKind: contract.launchTarget.targetKind,
        systemAssetId: contract.launchTarget.systemAssetId,
        pageBindingId: contract.launchTarget.pageBindingId,
        routePath: "/",
      });
    }
  }

  const runtimeWindow = new BrowserWindow({
    width: contract.windowIntent.dimensions?.width ?? 1440,
    height: contract.windowIntent.dimensions?.height ?? 960,
    show: false,
    backgroundColor: "#111827",
    title: contract.windowIntent.titleHint ?? "AI Loom Runtime",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadScriptPath,
    },
  });

  runtimeWindow.once("ready-to-show", () => runtimeWindow.show());
  const search = createRendererSearch({
    [SystemRuntimeWindowLaunchQueryParam]: launchContractJson,
  });
  await loadRendererRoot(runtimeWindow, search);

  if (contract.windowIntent.focus === "foreground") {
    runtimeWindow.focus();
  }

  if (reuseWindowKey) {
    runtimeWindowByReuseKey.set(reuseWindowKey, runtimeWindow);
    runtimeWindow.on("closed", () => {
      runtimeWindowByReuseKey.delete(reuseWindowKey);
    });
  }

  return Object.freeze({
    launchId: contract.launchId,
    launchedAt: new Date().toISOString(),
    targetKind: contract.launchTarget.targetKind,
    systemAssetId: contract.launchTarget.systemAssetId,
    pageBindingId: contract.launchTarget.pageBindingId,
    routePath: "/",
  });
}

async function ensureCanonicalRegistryRuntime(
  storagePaths: ReturnType<typeof resolveDesktopStoragePaths>,
  systemRuntimeBackendApi: SystemRuntimeBackendApi,
): Promise<CanonicalRegistryRuntime> {
  if (canonicalRegistryRuntime) {
    return canonicalRegistryRuntime;
  }
  const [
    { InMemoryAssetLineageGraphProjectionSink },
    { ExplainCanonicalVersionExistenceUseCase, GetCanonicalProvenanceSummaryUseCase, ListCanonicalAssetsUseCase, LoadCanonicalAssetDetailUseCase },
    { GetAssetVersionHistoryUseCase },
    { GetCanonicalDependencyStateUseCase },
    { GetAssetDependencyHealthUseCase },
    { GetAssetImpactAnalysisUseCase },
    { ReconcileCanonicalIdentityMappingsUseCase, ReplayScopedAssetGraphProjectionUseCase },
    { ReplayAssetGraphProjectionUseCase },
    { VerifyAssetGraphProjectionUseCase },
    { ProjectionRebuildOrchestrationUseCase },
    { LoadCanonicalAssetManagementSnapshotUseCase },
    { ProjectionTrustReadModelService },
    { RegistryBackendApi },
    { RegistryQueryService },
    { CrossStudioRegistryQueryService },
    { RegistryDependencyGraphService },
    { RegistryCacheLayer },
    { CompositionAssetContractResolver },
  ] = await Promise.all([
    import("../../src/infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink"),
    import("../../src/application/assets-system/CanonicalAssetReadUseCases"),
    import("../../src/application/assets-system/GetAssetVersionHistoryUseCase"),
    import("../../src/application/assets-system/CanonicalDependencyStateUseCase"),
    import("../../src/application/assets-system/GetAssetDependencyHealthUseCase"),
    import("../../src/application/assets-system/GetAssetImpactAnalysisUseCase"),
    import("../../src/application/assets-system/ReconciliationUseCases"),
    import("../../src/application/assets-system/ReplayAssetGraphProjectionUseCase"),
    import("../../src/application/assets-system/VerifyAssetGraphProjectionUseCase"),
    import("../../src/application/assets-system/ProjectionRebuildOrchestrationUseCase"),
    import("../../src/application/assets-system/LoadCanonicalAssetManagementSnapshotUseCase"),
    import("../../src/application/assets-system/ProjectionTrustReadModelService"),
    import("../../src/infrastructure/api/registry/RegistryBackendApi"),
    import("../../src/application/asset-registry/RegistryQueryService"),
    import("../../src/application/asset-registry/CrossStudioRegistryQueryService"),
    import("../../src/application/asset-registry/RegistryDependencyGraphService"),
    import("../../src/application/asset-registry/RegistryCacheLayer"),
    import("../../src/application/contracts/CompositionAssetContractResolver"),
  ]);

  const repository = new SqliteAssetSystemRepository(path.join(storagePaths.assetsDirectory, "asset-system.sqlite"));
  const projectionSink = new InMemoryAssetLineageGraphProjectionSink();
  const listCanonicalAssetsUseCase = new ListCanonicalAssetsUseCase(repository, repository);
  const loadCanonicalAssetDetailUseCase = new LoadCanonicalAssetDetailUseCase(repository, repository, repository, repository, repository);
  const getVersionHistoryUseCase = new GetAssetVersionHistoryUseCase(repository);
  const explainVersionExistenceUseCase = new ExplainCanonicalVersionExistenceUseCase(
    new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
    repository,
  );
  const dependencyStateUseCase = new GetCanonicalDependencyStateUseCase(
    repository,
    repository,
    new GetAssetDependencyHealthUseCase(repository, repository, repository),
    new GetAssetImpactAnalysisUseCase(repository, repository, repository),
    new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
    repository,
  );
  const replayProjectionUseCase = new ReplayAssetGraphProjectionUseCase(repository, projectionSink);
  const replayScopedProjectionUseCase = new ReplayScopedAssetGraphProjectionUseCase(repository, replayProjectionUseCase);
  const verifyProjectionUseCase = new VerifyAssetGraphProjectionUseCase(repository, projectionSink);
  const projectionTrustReadModelService = new ProjectionTrustReadModelService();
  const rebuildProjectionOrchestrationUseCase = new ProjectionRebuildOrchestrationUseCase(
    replayScopedProjectionUseCase,
    replayProjectionUseCase,
    verifyProjectionUseCase,
  );
  const loadManagementSnapshotUseCase = new LoadCanonicalAssetManagementSnapshotUseCase(
    loadCanonicalAssetDetailUseCase,
    getVersionHistoryUseCase,
    dependencyStateUseCase,
    explainVersionExistenceUseCase,
    verifyProjectionUseCase,
  );
  const registryCacheLayer = new RegistryCacheLayer({ maxEntriesPerNamespace: 300 });
  const registryQueryService = new RegistryQueryService(
    repository,
    repository,
    repository,
    new CompositionAssetContractResolver(),
    repository,
    undefined,
    registryCacheLayer,
    repository,
    {
      async listRecentExecutionsForSystem(input) {
        const response = await systemRuntimeBackendApi.listRecentExecutionsForSystem(input);
        return response.ok && response.data ? response.data : [];
      },
    },
  );
  const registryBackendApi = new RegistryBackendApi(
    new CrossStudioRegistryQueryService(registryQueryService),
    new RegistryDependencyGraphService(registryQueryService, repository, repository, registryCacheLayer),
    workflowPersistenceRepository ? new ListPersistedWorkflowsUseCase(workflowPersistenceRepository) : undefined,
  );
  canonicalRegistryRuntime = {
    repository,
    listCanonicalAssetsUseCase,
    loadCanonicalAssetDetailUseCase,
    getVersionHistoryUseCase,
    dependencyStateUseCase,
    replayScopedProjectionUseCase,
    verifyProjectionUseCase,
    projectionTrustReadModelService,
    rebuildProjectionOrchestrationUseCase,
    loadManagementSnapshotUseCase,
    reconcileIdentityUseCase: new ReconcileCanonicalIdentityMappingsUseCase(repository, repository),
    registryBackendApi,
  };
  logInitializationMemory("desktop-runtime-bootstrap", "canonical-registry-runtime-ready");
  return canonicalRegistryRuntime;
}

async function bootstrapDesktopRuntime(): Promise<void> {
  const bootstrapStartedAt = logInitializationStart("desktop-runtime-bootstrap");
  try {
  const storageInitializationStartedAt = logInitializationStart("desktop-storage-initialize");
  const storagePaths = resolveDesktopStoragePaths({
    userDataPath: app.getPath("userData"),
    logsPath: app.getPath("logs"),
  });

  storageDatabase = new DesktopStorageDatabase({ paths: storagePaths });
  await new InitializeProductionStorageUseCase(storageDatabase).execute();
  logInitializationEnd("desktop-storage-initialize", storageInitializationStartedAt);
  logInitializationCheckpoint("desktop-runtime-bootstrap", "storage-ready", bootstrapStartedAt);
  logInitializationMemory("desktop-runtime-bootstrap", "storage-ready");

  const pythonRuntimeResolutionStartedAt = logInitializationStart("desktop-python-runtime-resolve");
  const pythonRuntime = resolveDesktopPythonRuntime({
    isPackaged,
    repoRoot,
    resourcesPath: process.resourcesPath,
    storagePaths,
  });
  logInitializationEnd("desktop-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
  logInitializationCheckpoint("desktop-runtime-bootstrap", "python-runtime-resolved", bootstrapStartedAt);
  logInitializationMemory("desktop-runtime-bootstrap", "python-runtime-resolved");

  serviceSupervisor = new DesktopServiceSupervisor({
    repoRoot,
    isPackaged,
    resourcesPath: process.resourcesPath,
    storagePaths,
      pythonRuntime,
      pythonRuntimeBaseUrl: process.env.PYTHON_RUNTIME_BASE_URL || "http://127.0.0.1:8100",
    });
  const supervisorStartAt = logInitializationStart("local-service-supervisor-start");
  await serviceSupervisor.start();
  logInitializationEnd("local-service-supervisor-start", supervisorStartAt);
  logInitializationCheckpoint("desktop-runtime-bootstrap", "local-service-supervisor-ready", bootstrapStartedAt);
  logInitializationMemory("desktop-runtime-bootstrap", "local-service-supervisor-ready");

  const baseRuntimeConfig = isPackaged
    ? AppRuntimeConfig.forDesktopProduction({
        storage: storagePaths,
        pythonRuntime,
        serviceSupervisorBaseUrl: serviceSupervisor.baseUrl,
        serviceSupervisorPort: 8790,
        pythonRuntimeBaseUrl: serviceSupervisor.runtimeBaseUrl,
      })
    : AppRuntimeConfig.forDesktopDevelopment({
        storage: storagePaths,
        pythonRuntime,
        serviceSupervisorBaseUrl: serviceSupervisor.baseUrl,
        serviceSupervisorPort: 8790,
        pythonRuntimeBaseUrl: serviceSupervisor.runtimeBaseUrl,
      });
  const rendererOrigin = normalizeHttpOrigin(rendererDevUrl);
  const authoritativeServerStartAt = logInitializationStart("authoritative-server-startup");
  authoritativeServerRuntime = await startAuthoritativeServerHostAssembly({
    hostOptions: {
      databasePath: path.join(storagePaths.storageDirectory, "identity", "identity.sqlite"),
      cors: {
        allowedOrigins: rendererOrigin ? [rendererOrigin] : [],
        allowLoopbackOrigins: true,
        allowNullOrigin: isPackaged,
      },
      env: process.env,
    },
    boot: {
      startupReason: "electron-main-authoritative-server-host-startup",
      environment: process.env,
    },
  });
  logInitializationEnd("authoritative-server-startup", authoritativeServerStartAt);
  logInitializationCheckpoint("desktop-runtime-bootstrap", "authoritative-server-ready", bootstrapStartedAt);
  logInitializationMemory("desktop-runtime-bootstrap", "authoritative-server-ready");
  const identityApiBaseUrl = assertSecureTransportEndpoint(
    `http://${authoritativeServerRuntime.address}`,
    resolveHostSecureTransportConfig({
      hostKind: HostSecureTransportKinds.desktop,
      hostAddress: "127.0.0.1",
    }),
  );
  const runtimeConfig = AppRuntimeConfig.fromValues({
    ...baseRuntimeConfig.toValues(),
    identityApiBaseUrl,
  });

  bootstrapContext = Object.freeze({
    runtimeConfig: runtimeConfig.toValues(),
    storage: storagePaths,
    serviceSupervisor: {
      baseUrl: serviceSupervisor.baseUrl,
      port: 8790,
    },
    pythonRuntime,
    identityTransportTrust: resolveDesktopIdentityTransportTrustBootstrap(),
  });
  desktopConnectivityStateService = new DesktopConnectivityStateService();
  desktopConnectivityStateService.startMonitoring(createDesktopConnectivityProbePort(identityApiBaseUrl), {
    intervalMs: 3_000,
  });

  ipcMain.on("ai-loom-desktop:get-bootstrap-sync", (event) => {
    event.returnValue = bootstrapContext;
  });
  ipcMain.on("ai-loom-desktop-storage:getItem", (event, key: string) => {
    event.returnValue = storageDatabase?.getItem(key) ?? null;
  });
  ipcMain.on("ai-loom-desktop-storage:setItem", (_event, key: string, value: string) => {
    storageDatabase?.setItem(key, value);
  });
  ipcMain.on("ai-loom-desktop-storage:removeItem", (_event, key: string) => {
    storageDatabase?.removeItem(key);
  });
  ipcMain.handle("ai-loom-desktop-connectivity:get-state", async () => {
    const state = desktopConnectivityStateService?.getState() ?? {
      state: "connecting",
      stale: false,
      localModeActive: false,
      lastChangedAt: new Date().toISOString(),
      canQueueOperations: true,
      canResynchronize: false,
    };
    return JSON.stringify(state);
  });
  ipcMain.handle("ai-loom-desktop-connectivity:set-offline-mode", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as { readonly active?: boolean; readonly detail?: string };
    if (!desktopConnectivityStateService) {
      return JSON.stringify({
        state: "connecting",
        stale: false,
        localModeActive: false,
        detail: "Desktop connectivity state service is unavailable.",
        lastChangedAt: new Date().toISOString(),
        canQueueOperations: true,
        canResynchronize: false,
      });
    }
    const state = desktopConnectivityStateService.setDeliberateOfflineMode(request.active === true, request.detail);
    return JSON.stringify(state);
  });
  ipcMain.on("ai-loom-desktop-secrets:is-available", (event) => {
    event.returnValue = safeStorage.isEncryptionAvailable();
  });
  ipcMain.on("ai-loom-desktop-secrets:get", (event, key: string) => {
    const encoded = storageDatabase?.getItem(`secure:${key}`) ?? null;
    if (!encoded) {
      event.returnValue = null;
      return;
    }
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      event.returnValue = decrypted;
    } catch {
      event.returnValue = null;
    }
  });
  ipcMain.on("ai-loom-desktop-secrets:set", (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return;
    }
    const encrypted = safeStorage.encryptString(value).toString("base64");
    storageDatabase?.setItem(`secure:${key}`, encrypted);
  });
  ipcMain.on("ai-loom-desktop-secrets:remove", (_event, key: string) => {
    storageDatabase?.removeItem(`secure:${key}`);
  });
  const workflowsDirectory = runtimeConfig.workflowStorageDirectory
    ? path.resolve(repoRoot, runtimeConfig.workflowStorageDirectory)
    : path.resolve(repoRoot, "dev/workflow-data/workflows");
  const workflowIndexDatabasePath = runtimeConfig.workflowIndexDatabasePath
    ? path.resolve(repoRoot, runtimeConfig.workflowIndexDatabasePath)
    : path.resolve(repoRoot, "dev/workflow-data/workflows/workflow-index.sqlite");
  workflowPersistence = new DesktopWorkflowPersistence({
    workflowsDirectory,
    indexDatabasePath: workflowIndexDatabasePath,
  });
  executionRunRepository = createExecutionRunRepository({
    sqliteDatabasePath: storagePaths.databasePath,
  }) as SqliteExecutionRunRepository;
  workflowRunSummaryRepository = new SqliteWorkflowRunSummaryRepository(storagePaths.databasePath);
  listWorkflowRunSummariesUseCase = new ListWorkflowRunSummariesUseCase(workflowRunSummaryRepository);
  studioShellRepository = new SqliteStudioShellRepository(path.join(storagePaths.storageDirectory, "studio-shell", "studio-shell.sqlite"));
  workflowPersistenceRepository = new SqliteWorkflowPersistenceRepository(
    path.join(storagePaths.storageDirectory, "workflow-studio", "workflow-persistence.sqlite"),
  );
  const imageWorkflowSystemPersistence = new SqliteImageWorkflowSystemPersistenceAdapter(
    path.join(storagePaths.assetsDirectory, "image-workflow-system.sqlite"),
  );
  const studioShellBackendApi = new StudioShellBackendApi(
    studioShellRepository,
    workflowPersistenceRepository,
    workflowRunSummaryRepository,
    undefined,
    new SqliteImageRunHistoryRepository(path.join(storagePaths.assetsDirectory, "system-image-run-history.sqlite")),
    {
      storageInstanceProvisioner: new LocalStorageInstanceProvisioner({
        storageRootDirectory: path.join(storagePaths.storageDirectory, "storage"),
      }),
      workflowOutputArtifactStorage: new LocalSystemOutputArtifactStorage(
        path.join(storagePaths.storageDirectory, "storage"),
      ),
      storageLifecycleInfrastructure: new LocalStorageInstanceLifecycleInfrastructure(
        path.join(storagePaths.storageDirectory, "storage"),
      ),
      imageSystemDefinitionRepository: imageWorkflowSystemPersistence,
    },
  );
  const systemStudioBackendApi = new SystemStudioBackendApi(studioShellRepository);
  const runtimeExecutionStore = new SqliteSystemRuntimeExecutionStore(path.join(storagePaths.assetsDirectory, "system-runtime.sqlite"));
  const runtimeExecutionAuditRepository = new SqliteExecutionAuditRepository(path.join(storagePaths.assetsDirectory, "system-runtime-audit.sqlite"));
  const systemRuntimeBackendApi = new SystemRuntimeBackendApi(studioShellRepository, runtimeExecutionStore, undefined, undefined, undefined, undefined, undefined, runtimeExecutionAuditRepository);
  const executionHistoryInfrastructure = createExecutionHistoryInfrastructure(executionRunRepository);
  getExecutionRunUseCase = new GetExecutionRunUseCase(executionRunRepository);
  listExecutionRunsUseCase = executionHistoryInfrastructure.listExecutionRunsUseCase;
  ipcMain.on("ai-loom-desktop-workflows:save-record", (_event, recordJson: string) => {
    workflowPersistence?.saveWorkflowRecord(recordJson);
  });
  ipcMain.on("ai-loom-desktop-workflows:load-record", (event, id: string) => {
    event.returnValue = workflowPersistence?.loadWorkflowRecord(id) ?? null;
  });
  ipcMain.on("ai-loom-desktop-workflows:list-summaries", (event) => {
    event.returnValue = workflowPersistence?.listWorkflowSummaries() ?? [];
  });
  ipcMain.on("ai-loom-desktop-workflows:delete-record", (_event, id: string) => {
    workflowPersistence?.deleteWorkflowRecord(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:exists", (event, id: string) => {
    event.returnValue = workflowPersistence?.workflowExists(id) ?? false;
  });
  ipcMain.on("ai-loom-desktop-workflows:status", (event) => {
    event.returnValue = workflowPersistence?.getWorkflowPersistenceStatus() ?? {
      provider: "desktop-filesystem-indexed",
      workflowsDirectory,
      indexDatabasePath: workflowIndexDatabasePath,
      degraded: true,
      detail: "Desktop workflow persistence service is unavailable.",
    };
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:save", async (_event, runJson: string) => {
    if (!executionRunRepository) {
      return;
    }
    await executionRunRepository.saveRun(JSON.parse(runJson));
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:load", async (_event, runId: string) => {
    const run = await getExecutionRunUseCase?.execute(runId);
    return run ? JSON.stringify(run) : null;
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:list", async (_event, criteriaJson?: string) => {
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const runs = await listExecutionRunsUseCase?.execute(criteria);
    return (runs ?? []).map((run) => JSON.stringify(run));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:save", async (_event, summaryJson: string) => {
    if (!workflowRunSummaryRepository) {
      return;
    }
    await workflowRunSummaryRepository.upsert(JSON.parse(summaryJson));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:load", async (_event, runId: string) => {
    const summary = await workflowRunSummaryRepository?.getByRunId(runId);
    return summary ? JSON.stringify(summary) : null;
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:save-detail", async (_event, detailJson: string) => {
    if (!workflowRunSummaryRepository) {
      return;
    }
    await workflowRunSummaryRepository.upsertDetail(JSON.parse(detailJson));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:load-detail", async (_event, runId: string) => {
    const detail = await workflowRunSummaryRepository?.getDetailByRunId(runId);
    return detail ? JSON.stringify(detail) : null;
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:list", async (_event, queryJson?: string) => {
    const query = queryJson ? JSON.parse(queryJson) : undefined;
    const summaries = await listWorkflowRunSummariesUseCase?.execute(query);
    return (summaries ?? []).map((summary) => JSON.stringify(summary));
  });
  ipcMain.handle("ai-loom-desktop-agents:create", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as CreateAgentRequest;
    return JSON.stringify(await agentApi.createAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:update", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as UpdateAgentRequest;
    return JSON.stringify(await agentApi.updateAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:get", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.getAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:list", async (_event, includeArchived = true) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.listAgents(includeArchived));
  });
  ipcMain.handle("ai-loom-desktop-agents:delete", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.deleteAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:archive", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.archiveAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-goals", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as ConfigureAgentGoalsRequest;
    return JSON.stringify(await agentApi.configureGoals(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-policy", async (_event, agentId: string, policyJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const policy = JSON.parse(policyJson) as AgentPolicy;
    return JSON.stringify(await agentApi.configurePolicy(agentId, policy));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-tools", async (_event, agentId: string, toolAccessJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const toolAccess = JSON.parse(toolAccessJson) as AgentToolAccessPolicy;
    return JSON.stringify(await agentApi.configureTools(agentId, toolAccess));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-memory", async (_event, agentId: string, memoryJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const memory = JSON.parse(memoryJson) as AgentMemoryConfiguration;
    return JSON.stringify(await agentApi.configureMemory(agentId, memory));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-strategy", async (_event, agentId: string, planningStrategyJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const planningStrategy = JSON.parse(planningStrategyJson) as AgentPlanningStrategy;
    return JSON.stringify(await agentApi.configureStrategy(agentId, planningStrategy));
  });
  ipcMain.handle("ai-loom-desktop-agents:validate", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as AgentConfigurationValidationInput;
    return JSON.stringify(await agentApi.validateConfiguration(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:launch", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as AgentRunRequest;
    return JSON.stringify(await agentApi.launchAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:trigger-launch", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as TriggerAgentLaunchRequest;
    return JSON.stringify(await agentApi.triggerLaunch(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:list-sessions", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.listSessions(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:get-session", async (_event, sessionId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.getSessionDetail(sessionId));
  });
  ipcMain.handle("ai-loom-desktop-agents:control-run", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as AgentRunControlRequest;
    return JSON.stringify(await agentApi.controlRun(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:studio-snapshot", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.getStudioSnapshot(agentId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:initialize", async (_event, studioId: string, name: string) => {
    return JSON.stringify(await studioShellBackendApi.initializeStudio(studioId, name));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:snapshot", async (_event, studioId: string) => {
    return JSON.stringify(await studioShellBackendApi.loadSnapshot(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:start-session", async (_event, studioId: string) => {
    return JSON.stringify(await studioShellBackendApi.startSession(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:create-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as CreateAssetDraftCommand;
    return JSON.stringify(await studioShellBackendApi.createDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftCommand;
    return JSON.stringify(await studioShellBackendApi.updateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-dependencies", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftDependenciesCommand;
    return JSON.stringify(await studioShellBackendApi.updateDependencies(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:transition-lifecycle", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as TransitionAssetDraftLifecycleCommand;
    return JSON.stringify(await studioShellBackendApi.transitionLifecycle(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:publish-version", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as PublishAssetDraftVersionCommand;
    return JSON.stringify(await studioShellBackendApi.publishVersion(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:validate-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as { studioId: string; draftId: string };
    return JSON.stringify(await studioShellBackendApi.validateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-workflows:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listImageWorkflowDefinitions"]>[0];
    return JSON.stringify(await studioShellBackendApi.listImageWorkflowDefinitions(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-workflows:get", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getImageWorkflowDefinition"]>[0];
    return JSON.stringify(await studioShellBackendApi.getImageWorkflowDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listImageSystemDefinitions"]>[0];
    return JSON.stringify(await studioShellBackendApi.listImageSystemDefinitions(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:get", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getImageSystemDefinition"]>[0];
    return JSON.stringify(await studioShellBackendApi.getImageSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:save", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["saveImageSystemDefinition"]>[0];
    return JSON.stringify(await studioShellBackendApi.saveImageSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:get-persisted-workflow", async (_event, workflowId: string) => {
    return JSON.stringify(await studioShellBackendApi.getPersistedWorkflow(workflowId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:duplicate-persisted-workflow", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["duplicatePersistedWorkflow"]>[0];
    return JSON.stringify(await studioShellBackendApi.duplicatePersistedWorkflow(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-execution-readiness", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["assessWorkflowExecutionReadiness"]>[0];
    return JSON.stringify(await studioShellBackendApi.assessWorkflowExecutionReadiness(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:run-workflow-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["runWorkflowDraft"]>[0];
    return JSON.stringify(await studioShellBackendApi.runWorkflowDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-execution-readiness", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["assessDataStudioExecutionReadiness"]>[0];
    return JSON.stringify(await studioShellBackendApi.assessDataStudioExecutionReadiness(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:run-data-pipeline", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["runDataStudioPipeline"]>[0];
    return JSON.stringify(await studioShellBackendApi.runDataStudioPipeline(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-pipelines:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listDataStudioPipelines"]>[0];
    return JSON.stringify(await studioShellBackendApi.listDataStudioPipelines(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-pipelines:load", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["loadDataStudioPipeline"]>[0];
    return JSON.stringify(await studioShellBackendApi.loadDataStudioPipeline(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listWorkflowRuns"]>[0];
    return JSON.stringify(await studioShellBackendApi.listWorkflowRuns(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:get-detail", async (_event, runId: string) => {
    return JSON.stringify(await studioShellBackendApi.getWorkflowRunDetail(runId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:start-rerun", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["startWorkflowRunRerun"]>[0];
    return JSON.stringify(await studioShellBackendApi.startWorkflowRunRerun(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["listChildComponents"]>[0];
    return JSON.stringify(await systemStudioBackendApi.listChildComponents(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:add", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["addChildComponent"]>[0];
    return JSON.stringify(await systemStudioBackendApi.addChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:remove", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["removeChildComponent"]>[0];
    return JSON.stringify(await systemStudioBackendApi.removeChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:reorder", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["reorderChildComponent"]>[0];
    return JSON.stringify(await systemStudioBackendApi.reorderChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-interfaces:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateInterfaces"]>[0];
    return JSON.stringify(await systemStudioBackendApi.updateInterfaces(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-parameters:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateParameters"]>[0];
    return JSON.stringify(await systemStudioBackendApi.updateParameters(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-execution-metadata:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateExecutionMetadata"]>[0];
    return JSON.stringify(await systemStudioBackendApi.updateExecutionMetadata(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:save", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["saveSystemDefinition"]>[0];
    return JSON.stringify(await systemStudioBackendApi.saveSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:load", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["loadSystemDefinition"]>[0];
    return JSON.stringify(await systemStudioBackendApi.loadSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:duplicate", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["duplicateSystemDefinition"]>[0];
    return JSON.stringify(await systemStudioBackendApi.duplicateSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:modify", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["modifySystemDefinition"]>[0];
    return JSON.stringify(await systemStudioBackendApi.modifySystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-compatibility:insights", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["getCompatibilityInsights"]>[0];
    return JSON.stringify(await systemStudioBackendApi.getCompatibilityInsights(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:start", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemRuntimeBackendApi["startExecution"]>[0];
    return JSON.stringify(await systemRuntimeBackendApi.startExecution(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:status", async (_event, executionId: string) => {
    return JSON.stringify(await systemRuntimeBackendApi.getExecutionStatus(executionId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:trace", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemRuntimeBackendApi["getExecutionTrace"]>[0];
    return JSON.stringify(await systemRuntimeBackendApi.getExecutionTrace(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:result", async (_event, executionId: string) => {
    return JSON.stringify(await systemRuntimeBackendApi.getExecutionResult(executionId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:upload", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["ingestReferenceImageUpload"]>[0];
    return JSON.stringify(await studioShellBackendApi.ingestReferenceImageUpload(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:persist-outputs", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["persistReferenceImageOutputs"]>[0];
    return JSON.stringify(await studioShellBackendApi.persistReferenceImageOutputs(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-outputs", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageOutputs"]>[0];
    return JSON.stringify(await studioShellBackendApi.listReferenceImageOutputs(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:get-output", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getReferenceImageOutput"]>[0];
    return JSON.stringify(await studioShellBackendApi.getReferenceImageOutput(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-dataset-items", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageDatasetItems"]>[0];
    return JSON.stringify(await studioShellBackendApi.listReferenceImageDatasetItems(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:get-dataset-item", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getReferenceImageDatasetItem"]>[0];
    return JSON.stringify(await studioShellBackendApi.getReferenceImageDatasetItem(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-run-history", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageRunHistory"]>[0];
    return JSON.stringify(await studioShellBackendApi.listReferenceImageRunHistory(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:chain-to-input", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["chainReferenceImageDatasetItemToInput"]>[0];
    return JSON.stringify(await studioShellBackendApi.chainReferenceImageDatasetItemToInput(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:runtime-window:launch", async (_event, requestJson: string) => {
    try {
      const request = JSON.parse(requestJson) as { readonly launchContract?: unknown };
      if (!request.launchContract) {
        throw new Error("invalid-request:launchContract is required.");
      }
      const launchContractJson = JSON.stringify(request.launchContract);
      const launched = await launchRuntimeWindowFromContract(launchContractJson);
      return JSON.stringify({
        ok: true,
        data: launched,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime window launch failed.";
      const isInvalid = message.startsWith("invalid-request:");
      return JSON.stringify({
        ok: false,
        error: {
          code: isInvalid ? "invalid-request" : "internal",
          message: isInvalid ? message.slice("invalid-request:".length) : message,
        },
      });
    }
  });
  ipcMain.on("ai-loom-desktop-model-files:exists", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = fs.existsSync(absolutePath);
  });
  ipcMain.on("ai-loom-desktop-model-files:stat", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = toFileEntry(storagePaths.modelsDirectory, absolutePath);
  });
  ipcMain.on("ai-loom-desktop-model-files:read", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = new Uint8Array(fs.readFileSync(absolutePath));
  });
  ipcMain.on("ai-loom-desktop-model-files:write", (_event, request: { path: string; content: Uint8Array; overwrite?: boolean; createDirectories?: boolean }) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.path);
    if (!request.overwrite && fs.existsSync(absolutePath)) {
      throw new Error(`File '${request.path}' already exists.`);
    }
    if (request.createDirectories) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    }
    fs.writeFileSync(absolutePath, Buffer.from(request.content));
  });
  ipcMain.on("ai-loom-desktop-model-files:delete", (_event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    }
  });
  ipcMain.on("ai-loom-desktop-model-files:list", (event, targetPath: string, options?: { recursive?: boolean }) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = listEntries(storagePaths.modelsDirectory, absolutePath, options?.recursive === true);
  });
  ipcMain.on("ai-loom-desktop-model-files:move", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    const absoluteSourcePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.from);
    const absoluteTargetPath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.to);
    if (!request.overwrite && fs.existsSync(absoluteTargetPath)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
    fs.renameSync(absoluteSourcePath, absoluteTargetPath);
  });
  ipcMain.on("ai-loom-desktop-model-files:copy", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    const absoluteSourcePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.from);
    const absoluteTargetPath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.to);
    if (!request.overwrite && fs.existsSync(absoluteTargetPath)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
    fs.copyFileSync(absoluteSourcePath, absoluteTargetPath);
  });

  logInitializationMemory("desktop-runtime-bootstrap", "ipc-and-api-bindings-ready");

  ipcMain.handle("ai-loom-desktop-canonical-assets:list", async (_event, criteriaJson?: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return [];
    }
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const assets = await canonicalRuntime.listCanonicalAssetsUseCase.execute(criteria);
    const details = await Promise.all(assets.map((asset: { id: string }) => canonicalRuntime.loadCanonicalAssetDetailUseCase.execute(asset.id)));
    return details
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .map((entry) => JSON.stringify({
        assetId: entry.assetId,
        name: entry.name,
        kind: entry.kind,
        status: entry.status,
        latestVersionId: entry.latestVersion?.versionId,
        versionCount: entry.versionCount,
        transformationCount: entry.transformationCount,
        lineageEdgeCount: entry.lineageEdgeCount,
      }));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets", async (_event, limit?: number) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    return JSON.stringify(await registryBackendApi.listAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets-filter", async (_event, filtersJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const filters = JSON.parse(filtersJson);
    return JSON.stringify(await registryBackendApi.filterAssets(filters));
  });
  ipcMain.handle("ai-loom-desktop-registry:search", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.searchAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:explore-assets", async (_event, limit?: number) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    return JSON.stringify(await registryBackendApi.listExploreAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:explore-search", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.searchExploreAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:asset-detail", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getAssetDetail(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependencies", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependents", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-upstream", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.traverseDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-downstream", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.traverseDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:detail", async (_event, assetId: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const detail = await canonicalRuntime.loadCanonicalAssetDetailUseCase.execute(assetId);
    if (!detail) return null;
    return JSON.stringify({
      assetId: detail.assetId,
      name: detail.name,
      kind: detail.kind,
      status: detail.status,
      latestVersionId: detail.latestVersion?.versionId,
      versionCount: detail.versionCount,
      transformationCount: detail.transformationCount,
      lineageEdgeCount: detail.lineageEdgeCount,
    });
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:version-chain", async (_event, assetId: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return [];
    }
    const chain = await canonicalRuntime.getVersionHistoryUseCase.execute(assetId);
    const withState = await Promise.all(chain.map(async (version) => {
      const dependencyState = await canonicalRuntime.dependencyStateUseCase.execute({
        versionId: version.versionId,
        preferPersistedIfFreshMs: 300_000,
      }).catch(() => undefined);
      return JSON.stringify({
        versionId: version.versionId,
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt.toISOString(),
        label: version.versionLabel,
        dependencyState: dependencyState
          ? {
            state: dependencyState.state,
            reasons: dependencyState.reasons,
            nextActions: dependencyState.nextActions,
          }
          : undefined,
      });
    }));
    return withState;
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:dependency-state", async (_event, versionId: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const summary = await canonicalRuntime.dependencyStateUseCase.execute({
      versionId,
      preferPersistedIfFreshMs: 300_000,
    });
    return JSON.stringify({
      versionId: summary.versionId,
      state: summary.state,
      lineageConfidence: summary.lineageConfidence,
      lifecycle: {
        source: summary.lifecycle.source,
        computedAt: summary.lifecycle.computedAt.toISOString(),
        reason: summary.lifecycle.reason,
      },
      reasons: summary.reasons,
      nextActions: summary.nextActions,
    });
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:reconcile-identity", async (_event, entityType: string, entityId: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const reconciled = await canonicalRuntime.reconcileIdentityUseCase.execute({
      entityType: entityType as any,
      entityId,
    });
    return JSON.stringify(reconciled);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:replay-scope", async (_event, entityType: string, entityId: string, versionId?: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return JSON.stringify({ replayed: false, reason: "Canonical asset system is unavailable." });
    }
    const replay = await canonicalRuntime.replayScopedProjectionUseCase.execute({ entityType: entityType as any, entityId, versionId });
    return JSON.stringify(replay);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:verify-projection", async (_event, assetId: string, versionIdsInScope?: ReadonlyArray<string>) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const verification = await canonicalRuntime.verifyProjectionUseCase.execute({ assetId, versionIdsInScope });
    return JSON.stringify(canonicalRuntime.projectionTrustReadModelService.summarize(verification));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:rebuild-scopes", async (_event, requestJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return JSON.stringify({ totalScopes: 0, replayedScopes: 0, verifiedScopes: 0, results: [] });
    }
    const request = JSON.parse(requestJson);
    const result = await canonicalRuntime.rebuildProjectionOrchestrationUseCase.execute(request);
    return JSON.stringify(result);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:management-snapshot", async (_event, assetId: string, includeProjectionHealth = true, versionIdsInProjectionScope?: ReadonlyArray<string>) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths, systemRuntimeBackendApi);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const snapshot = await canonicalRuntime.loadManagementSnapshotUseCase.execute({
      assetId,
      includeProjectionHealth,
      versionIdsInProjectionScope,
    });
    if (!snapshot) {
      return null;
    }
    return JSON.stringify({
      ...snapshot,
      versions: snapshot.versions.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  });

  if (runtimeConfig.isPackagedDesktopHost && !pythonRuntime.isAvailable) {
    console.warn(
      `[ai-loom] Packaged private Python runtime was not found at '${pythonRuntime.executablePath ?? pythonRuntime.runtimeRoot}'.`,
    );
  }
  } finally {
    logInitializationEnd("desktop-runtime-bootstrap", bootstrapStartedAt);
    logInitializationMemory("desktop-runtime-bootstrap", "bootstrap-complete");
  }
}

async function disposeDesktopRuntimeResources(): Promise<void> {
  desktopConnectivityStateService?.stopMonitoring();
  desktopConnectivityStateService = undefined;
  await authoritativeServerRuntime?.stop();
  await serviceSupervisor?.stop();
  storageDatabase?.dispose();
  executionRunRepository?.dispose();
  workflowRunSummaryRepository?.dispose();
  agentRepository?.dispose();
  agentSessionRepository?.dispose();
  agentRunnerAssetSystemRepository?.dispose();
  canonicalRegistryRuntime?.repository.dispose();
  studioShellRepository?.dispose();
  workflowPersistenceRepository?.dispose();
  agentStudioBackendApi = undefined;
  agentRepository = undefined;
  agentSessionRepository = undefined;
  agentRunnerAssetSystemRepository = undefined;
  canonicalRegistryRuntime = undefined;
}

app.whenReady().then(async () => {
  const desktopHostStartupAt = logInitializationStart("desktop-host-bootstrap");
  try {
    desktopHostRuntime = await startDesktopHostAssembly({
      startHost: async () => {
        await bootstrapDesktopRuntime();
        try {
          installRendererContentSecurityPolicy();
          await createMainWindow();
          logInitializationMemory("desktop-host-bootstrap", "main-window-ready");
        } catch (error) {
          await disposeDesktopRuntimeResources();
          throw error;
        }
        return Object.freeze({
          close: disposeDesktopRuntimeResources,
        });
      },
      boot: {
        startupReason: "electron-main-desktop-host-startup",
        environment: process.env,
      },
    });
  } finally {
    logInitializationEnd("desktop-host-bootstrap", desktopHostStartupAt);
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}).catch((error) => {
  console.error("Failed to bootstrap desktop host", error);
  app.exit(1);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await desktopHostRuntime?.stop();
});
