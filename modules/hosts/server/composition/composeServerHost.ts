import type { ArtifactRepoStoragePort } from "../../../application/ports/storage";
import { join } from "node:path";
import { GenerateImageUseCase } from "../../../application/use-cases/image-generation/generate-image.use-case";
import { createComfyUiHttpClient, createComfyUiImageGenerationRuntimeAdapter, createComfyUiRuntimeSupervisor } from "../../../adapters/runtime/comfyui";
import { createComfyUiRuntimeInstaller } from "../../../adapters/runtime/installer/comfyui/createComfyUiRuntimeInstaller";
import { createGitRuntimeInstallerAdapter } from "../../../adapters/runtime/installer/git/createGitRuntimeInstallerAdapter";
import { createLocalModelRegistryAdapter } from "../../../adapters/persistence/model";
import { createLocalModelCheckpointResolverAdapter } from "../../../adapters/model/local";
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

      const comfyUiInstallRoot = process.env.COMFYUI_INSTALL_ROOT?.trim() || join(registerOptions.storageRootDirectory, "runtime-installs", "comfyui");
      const comfyUiBaseUrl = process.env.COMFYUI_BASE_URL?.trim() || "http://127.0.0.1:8188";
      const gitRuntimeInstaller = createGitRuntimeInstallerAdapter({ logging: loggingPort });
      const comfyUiInstaller = createComfyUiRuntimeInstaller({
        gitInstaller: gitRuntimeInstaller,
        pythonCommand: process.env.COMFYUI_PYTHON_COMMAND ?? (process.platform === "win32" ? "python" : "python3"),
        runtimeDeviceMode: (process.env.COMFYUI_RUNTIME_DEVICE_MODE ?? process.env.COMFYUI_ACCELERATOR) as "auto" | "cpu" | "directml" | "cuda" | undefined,
        logging: loggingPort,
      });
      const comfyUiSupervisor = createComfyUiRuntimeSupervisor({
        workingDirectory: comfyUiInstallRoot,
        pythonExecutable: process.env.COMFYUI_PYTHON_COMMAND ?? (process.platform === "win32" ? "python" : "python3"),
        installer: comfyUiInstaller,
        installRoot: comfyUiInstallRoot,
        runtimeDeviceMode: (process.env.COMFYUI_RUNTIME_DEVICE_MODE ?? process.env.COMFYUI_ACCELERATOR) as "auto" | "cpu" | "directml" | "cuda" | undefined,
        autoInstall: true,
        installSourceRef: process.env.COMFYUI_INSTALL_REF,
        logging: loggingPort,
      });
      const runtimeTaskRegistry = createComfyUiImageGenerationRuntimeAdapter({
        client: createComfyUiHttpClient({ baseUrl: comfyUiBaseUrl }),
        supervisor: comfyUiSupervisor,
        mapperOptions: { defaultCheckpoint: process.env.COMFYUI_DEFAULT_CHECKPOINT },
      });
      const modelRegistry = createLocalModelRegistryAdapter({ filePath: `${registerOptions.storageRootDirectory}/model-registry/models.json`, now: options.now });
      const generateImageUseCase = new GenerateImageUseCase({
        runtimeTaskRegistry,
        modelCheckpointResolver: createLocalModelCheckpointResolverAdapter({
          modelRegistry,
          comfyUiCheckpointDirectory: join(comfyUiInstallRoot, "models", "checkpoints"),
        }),
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
        generateImageUseCase,
      });
    },
  };
}
