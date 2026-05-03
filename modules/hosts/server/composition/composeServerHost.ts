import type { ArtifactRepoStoragePort } from "../../../application/ports/storage";
import type { LoggingPort } from "../../../application/ports/logging";
import { SystemArtifactIdFactory } from "../../../domain/artifact";
import {
  BrowseArtifactsUseCase,
  BrowseHuggingFaceDatasetParquetFilesUseCase,
  BrowseHuggingFaceNamespaceDatasetsUseCase,
  HasArtifactInRepoUseCase,
  LocalizeArtifactFromRepoUseCase,
  PublishArtifactToRepoUseCase,
  ReadArtifactContentUseCase,
  ReadArtifactDetailUseCase,
  RegisterArtifactFromRepoUseCase,
  StoreArtifactInRepoUseCase,
  StoreArtifactUploadUseCase,
  VerifyImportedArtifactSourceBackingUseCase,
  VerifyPublishedArtifactBackingUseCase,
} from "../../../application/use-cases";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import {
  createArtifactRepoStorageAdapter,
} from "../../../adapters/storage/artifact-repo";
import {
  createFilesystemArtifactBrowserReadAdapter,
  createFilesystemArtifactContentRetrievalAdapter,
  createFilesystemArtifactObjectStorageAdapter,
  createLocalArtifactCatalogPersistenceAdapter,
  createLocalArtifactStorageBindingAdapter,
} from "../../../adapters/storage/filesystem";
import {
  createHuggingFaceArtifactRepoStorageAdapter,
  type CreateHuggingFaceArtifactRepoStorageAdapterOptions,
  type HuggingFaceFetchImplementation,
} from "../../../adapters/storage/huggingface";
import {
  createHuggingFaceTokenConfigStore,
  type HuggingFaceTokenStatus,
} from "../../shared/huggingFaceTokenConfigStore";
import {
  registerExpressApi,
  type RegisterExpressApiDependencies,
} from "../../../adapters/transport/api-express/registerExpressApi";
import { createLoggingConfig, type LoggingConfig } from "../../../contracts/config";
import type { LogLevel, LogVerbosity } from "../../../contracts/logging";
import { join, resolve } from "node:path";
import {
  buildComfyUiManagedPythonExecutablePath,
  type ComfyUiPythonEnvironmentMode,
} from "../../../adapters/runtime/comfyui/comfyUiPythonEnvironment";
import type { ComfyUiRuntimeDeviceMode } from "../../../adapters/runtime/comfyui/createComfyUiRuntimeSupervisor";

export interface ComposeServerHostLoggingOptions {
  verbosity?: string;
  fallbackVerbosity?: LogVerbosity;
  level?: LogLevel;
  includeDiagnostics?: boolean;
}

export interface ComposeServerHostArtifactRepoOptions {
  huggingFaceAccessToken?: string;
  huggingFaceTokenConfigFilePath?: string;
  huggingFaceFetchImplementation?: HuggingFaceFetchImplementation;
  huggingFaceHubClient?: CreateHuggingFaceArtifactRepoStorageAdapterOptions["hubClient"];
}

export interface ComposeServerHostOptions {
  logging?: ComposeServerHostLoggingOptions;
  logSink?: StructuredLogSink;
  now?: () => string;
  artifactRepo?: ComposeServerHostArtifactRepoOptions;
}

export interface RegisterServerApiOptions {
  app: RegisterExpressApiDependencies["app"];
  storageRootDirectory: string;
  runtimeRootDirectory?: string;
}

export type ServerComfyUiInstallRootSource = "COMFYUI_INSTALL_ROOT" | "SERVER_RUNTIME_ROOT" | "default-server-runtime-root";
export type ServerComfyUiLaunchPythonExecutableSource = "ambient" | "managed-venv" | "skip-python-setup";

function normalizeComfyUiRuntimeDeviceMode(value: string | undefined): ComfyUiRuntimeDeviceMode | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "auto" || normalized === "cpu" || normalized === "directml" || normalized === "cuda") return normalized;
  return undefined;
}

function parseBooleanEnvFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function resolveServerComfyUiPythonEnvironmentMode(env: NodeJS.ProcessEnv = process.env): {
  pythonEnvironmentMode: ComfyUiPythonEnvironmentMode;
  invalidValue?: string;
} {
  const raw = env.COMFYUI_PYTHON_ENVIRONMENT_MODE?.trim();
  const normalized = raw?.toLowerCase();
  if (!normalized) return { pythonEnvironmentMode: "managed-venv" };
  if (normalized === "managed-venv" || normalized === "ambient") return { pythonEnvironmentMode: normalized };
  return { pythonEnvironmentMode: "managed-venv", invalidValue: raw };
}

export function resolveServerComfyUiLaunchPythonExecutable(input: {
  installRoot: string;
  basePythonCommand: string;
  pythonEnvironmentMode: ComfyUiPythonEnvironmentMode;
  skipPythonSetup: boolean;
  platform?: NodeJS.Platform;
}): { launchPythonExecutable: string; source: ServerComfyUiLaunchPythonExecutableSource } {
  if (input.pythonEnvironmentMode === "ambient") {
    return { launchPythonExecutable: input.basePythonCommand, source: "ambient" };
  }
  if (input.skipPythonSetup) {
    return { launchPythonExecutable: input.basePythonCommand, source: "skip-python-setup" };
  }
  return {
    launchPythonExecutable: buildComfyUiManagedPythonExecutablePath({ installRoot: input.installRoot, platform: input.platform }),
    source: "managed-venv",
  };
}

export function resolveServerComfyUiRuntimeDeviceMode(env: NodeJS.ProcessEnv = process.env): ComfyUiRuntimeDeviceMode {
  return normalizeComfyUiRuntimeDeviceMode(env.COMFYUI_RUNTIME_DEVICE_MODE ?? env.COMFYUI_ACCELERATOR) ?? "auto";
}

export function resolveServerRuntimeRootDirectory(input: {
  env?: NodeJS.ProcessEnv;
  storageRootDirectory: string;
}): { runtimeRootDirectory: string; source: "SERVER_RUNTIME_ROOT" | "default-server-runtime-root" } {
  const env = input.env ?? process.env;
  const configured = env.SERVER_RUNTIME_ROOT?.trim();
  if (configured) {
    return { runtimeRootDirectory: resolve(configured), source: "SERVER_RUNTIME_ROOT" };
  }
  return {
    runtimeRootDirectory: resolve(input.storageRootDirectory, "..", "server-runtime"),
    source: "default-server-runtime-root",
  };
}

export function resolveServerComfyUiInstallRoot(input: {
  env?: NodeJS.ProcessEnv;
  storageRootDirectory: string;
  runtimeRootDirectory?: string;
}): { installRoot: string; source: ServerComfyUiInstallRootSource; runtimeRootDirectory: string } {
  const env = input.env ?? process.env;
  const configured = env.COMFYUI_INSTALL_ROOT?.trim();
  if (configured) {
    const runtimeRoot = input.runtimeRootDirectory ?? resolveServerRuntimeRootDirectory({ env, storageRootDirectory: input.storageRootDirectory }).runtimeRootDirectory;
    return { installRoot: resolve(configured), source: "COMFYUI_INSTALL_ROOT", runtimeRootDirectory: runtimeRoot };
  }
  const runtime = input.runtimeRootDirectory
    ? { runtimeRootDirectory: input.runtimeRootDirectory, source: "SERVER_RUNTIME_ROOT" as const }
    : resolveServerRuntimeRootDirectory({ env, storageRootDirectory: input.storageRootDirectory });
  return {
    installRoot: join(runtime.runtimeRootDirectory, "runtime-installs", "comfyui"),
    source: runtime.source,
    runtimeRootDirectory: runtime.runtimeRootDirectory,
  };
}

export interface ServerHostComposition {
  loggingPort: LoggingPort;
  loggingConfig: LoggingConfig;
  artifactRepoStorage: ArtifactRepoStoragePort;
  getHuggingFaceTokenStatus: () => HuggingFaceTokenStatus;
  setHuggingFaceToken: (token: string) => HuggingFaceTokenStatus;
  clearHuggingFaceToken: () => HuggingFaceTokenStatus;
  registerApi: (options: RegisterServerApiOptions) => void;
}

export function composeServerHost(
  options: ComposeServerHostOptions = {},
): ServerHostComposition {
  const loggingConfig = createLoggingConfig({
    verbosity: options.logging?.verbosity,
    fallbackVerbosity: options.logging?.fallbackVerbosity,
    level: options.logging?.level,
    includeDiagnostics: options.logging?.includeDiagnostics,
  });

  const loggingPort = createLogger({
    config: loggingConfig,
    host: "server",
    component: "server-host",
    sink: options.logSink,
    now: options.now,
  });
  const tokenConfigStore = createHuggingFaceTokenConfigStore({
    filePath: options.artifactRepo?.huggingFaceTokenConfigFilePath ?? "/tmp/ai-system-builder/server/hugging-face-token.json",
    fallbackToken: options.artifactRepo?.huggingFaceAccessToken,
  });

  const huggingFaceArtifactRepoStorage = createHuggingFaceArtifactRepoStorageAdapter({
    accessTokenProvider: () => tokenConfigStore.getToken(),
    fetchImplementation: options.artifactRepo?.huggingFaceFetchImplementation,
    hubClient: options.artifactRepo?.huggingFaceHubClient,
  });

  const artifactRepoStorage = createArtifactRepoStorageAdapter({
    providers: [
      {
        provider: "huggingface",
        adapter: huggingFaceArtifactRepoStorage,
      },
    ],
  });

  return {
    loggingPort,
    loggingConfig,
    artifactRepoStorage,
    getHuggingFaceTokenStatus() {
      return tokenConfigStore.getStatus();
    },
    setHuggingFaceToken(token: string) {
      return tokenConfigStore.setToken(token);
    },
    clearHuggingFaceToken() {
      return tokenConfigStore.clearToken();
    },
    registerApi(registerOptions) {
      const runtimeResolution = resolveServerComfyUiInstallRoot({
        env: process.env,
        storageRootDirectory: registerOptions.storageRootDirectory,
        runtimeRootDirectory: registerOptions.runtimeRootDirectory,
      });
      const basePythonCommand = process.env.COMFYUI_PYTHON_COMMAND?.trim() || "python";
      const { pythonEnvironmentMode, invalidValue: invalidPythonEnvironmentMode } = resolveServerComfyUiPythonEnvironmentMode(process.env);
      const skipPythonSetup = parseBooleanEnvFlag(process.env.COMFYUI_SKIP_PYTHON_SETUP);
      const skipPythonValidation = parseBooleanEnvFlag(process.env.COMFYUI_SKIP_PYTHON_VALIDATION);
      const runtimeDeviceMode = resolveServerComfyUiRuntimeDeviceMode(process.env);
      const launchPythonResolution = resolveServerComfyUiLaunchPythonExecutable({
        installRoot: runtimeResolution.installRoot,
        basePythonCommand,
        pythonEnvironmentMode,
        skipPythonSetup,
      });
      if (invalidPythonEnvironmentMode) {
        void loggingPort.log({
          timestamp: new Date().toISOString(),
          level: "warn",
          verbosity: "normal",
          event: "runtime.comfyui.server.configuration",
          host: "server",
          component: "server-host",
          message: "Invalid COMFYUI_PYTHON_ENVIRONMENT_MODE value. Falling back to managed-venv.",
          data: { invalidComfyUiPythonEnvironmentMode: invalidPythonEnvironmentMode, fallbackPythonEnvironmentMode: "managed-venv" },
        });
      }
      void loggingPort.log({
        timestamp: new Date().toISOString(),
        level: "info",
        verbosity: "normal",
        event: "runtime.python.server.configuration",
        host: "server",
        component: "server-host",
        message: "Resolved server Python runtime ownership.",
        data: {
          host: "server",
          serverStorageRootDirectory: registerOptions.storageRootDirectory,
          serverRuntimeRootDirectory: runtimeResolution.runtimeRootDirectory,
          pythonRuntimeMode: "ambient-only",
          pythonRuntimeRootDirectory: null,
          pythonRuntimeRootSource: "not-configured",
          taskRegistryOwnership: "server",
        },
      });
      void loggingPort.log({
        timestamp: new Date().toISOString(),
        level: "info",
        verbosity: "normal",
        event: "runtime.comfyui.server.configuration",
        host: "server",
        component: "server-host",
        message: "Resolved server ComfyUI runtime roots.",
        data: {
          serverStorageRootDirectory: registerOptions.storageRootDirectory,
          serverRuntimeRootDirectory: runtimeResolution.runtimeRootDirectory,
          comfyUiInstallRoot: runtimeResolution.installRoot,
          comfyUiInstallRootSource: runtimeResolution.source,
          storageRuntimeRootsDistinct: resolve(registerOptions.storageRootDirectory) !== resolve(runtimeResolution.runtimeRootDirectory),
          autoInstall: true,
          runtimeDeviceMode,
          pythonEnvironmentMode,
          basePythonCommand,
          launchPythonExecutable: launchPythonResolution.launchPythonExecutable,
          launchPythonExecutableSource: launchPythonResolution.source,
          skipPythonSetup,
          skipPythonValidation,
          installRootSource: runtimeResolution.source,
        },
      });
      const artifactCatalog = createLocalArtifactCatalogPersistenceAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
      });
      const artifactBindings = createLocalArtifactStorageBindingAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
      });
      const storage = createFilesystemArtifactObjectStorageAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
        host: "server",
        logging: loggingPort,
        now: options.now,
        artifactCatalogAppend: artifactCatalog,
      });
      const artifactBrowserRead = createFilesystemArtifactBrowserReadAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
        artifactCatalogRead: artifactCatalog,
        artifactCatalogAppend: artifactCatalog,
        storage,
        artifactBindingRead: artifactBindings,
      });
      const artifactMediaViewRetrieval = createFilesystemArtifactContentRetrievalAdapter({
        storage,
        artifactCatalogRead: artifactCatalog,
      });

      const storeArtifactUploadUseCase = new StoreArtifactUploadUseCase({
        storage,
        logging: loggingPort,
        now: options.now,
      });

      const browseArtifacts = new BrowseArtifactsUseCase({
        artifactBrowserMetadataRead: artifactBrowserRead,
      });
      const readArtifactDetail = new ReadArtifactDetailUseCase({
        artifactBrowserMetadataRead: artifactBrowserRead,
      });
      const readArtifactContent = new ReadArtifactContentUseCase({
        artifactBrowserContentRead: artifactBrowserRead,
      });

      const hasArtifactInRepo = new HasArtifactInRepoUseCase({
        artifactRepoStorage,
      });
      const browseHuggingFaceNamespaceDatasets = new BrowseHuggingFaceNamespaceDatasetsUseCase({
        repoBrowser: huggingFaceArtifactRepoStorage,
        logging: loggingPort,
        now: options.now,
      });
      const browseHuggingFaceDatasetParquetFiles = new BrowseHuggingFaceDatasetParquetFilesUseCase({
        repoBrowser: huggingFaceArtifactRepoStorage,
        logging: loggingPort,
        now: options.now,
      });
      const storeArtifactInRepo = new StoreArtifactInRepoUseCase({
        artifactRepoStorage,
      });
      const publishArtifactToRepo = new PublishArtifactToRepoUseCase({
        artifactStorage: storage,
        artifactRepoStorage,
        artifactBindingStorage: artifactBindings,
        now: options.now,
      });
      const verifyPublishedArtifactBacking = new VerifyPublishedArtifactBackingUseCase({
        artifactRepoStorage,
        artifactBindingStorage: artifactBindings,
        now: options.now,
      });
      const verifyImportedArtifactSourceBacking = new VerifyImportedArtifactSourceBackingUseCase({
        artifactRepoStorage,
        artifactBindingStorage: artifactBindings,
        now: options.now,
      });
      const registerArtifactFromRepo = new RegisterArtifactFromRepoUseCase({
        artifactRepoStorage,
        artifactBindingStorage: artifactBindings,
        artifactCatalogAppend: artifactCatalog,
        logging: loggingPort,
        now: options.now,
        artifactIdFactory: new SystemArtifactIdFactory(),
      });
      const localizeArtifactFromRepo = new LocalizeArtifactFromRepoUseCase({
        artifactRepoStorage,
        artifactBindingStorage: artifactBindings,
        artifactStorage: storage,
        now: options.now,
      });

      registerExpressApi({
        app: registerOptions.app,
        getHuggingFaceTokenStatus: () => tokenConfigStore.getStatus(),
        setHuggingFaceToken: (token) => tokenConfigStore.setToken(token),
        clearHuggingFaceToken: () => tokenConfigStore.clearToken(),
        storeArtifactUploadUseCase,
        browseArtifactsUseCase: browseArtifacts,
        readArtifactDetailUseCase: readArtifactDetail,
        readArtifactContentUseCase: readArtifactContent,
        artifactMediaViewRetrieval,
        hasArtifactInRepoUseCase: hasArtifactInRepo,
        browseHuggingFaceNamespaceDatasetsUseCase: browseHuggingFaceNamespaceDatasets,
        browseHuggingFaceDatasetParquetFilesUseCase: browseHuggingFaceDatasetParquetFiles,
        storeArtifactInRepoUseCase: storeArtifactInRepo,
        publishArtifactToRepoUseCase: publishArtifactToRepo,
        verifyPublishedArtifactBackingUseCase: verifyPublishedArtifactBacking,
        verifyImportedArtifactSourceBackingUseCase: verifyImportedArtifactSourceBacking,
        registerArtifactFromRepoUseCase: registerArtifactFromRepo,
        localizeArtifactFromRepoUseCase: localizeArtifactFromRepo,
      });
    },
  };
}
