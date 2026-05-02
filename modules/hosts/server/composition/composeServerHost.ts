import type { ArtifactRepoStoragePort } from "../../../application/ports/storage";
import { join } from "node:path";
import { GenerateImageUseCase } from "../../../application/use-cases/image-generation/generate-image.use-case";
import { FinalizeImageGenerationService } from "../../../application/services/image/finalize-image-generation.service";
import { ImageGenerationFinalizationOrchestratorService } from "../../../application/services/image/image-generation-finalization-orchestrator.service";
import { createComfyUiHttpClient, createComfyUiImageGenerationRuntimeAdapter, createComfyUiRuntimeSupervisor } from "../../../adapters/runtime/comfyui";
import { createComfyUiRuntimeInstaller } from "../../../adapters/runtime/installer/comfyui/createComfyUiRuntimeInstaller";
import { createPythonRuntimeAdapterFoundation, ensurePythonRuntimeWorkerDependencies } from "../../../adapters/runtime/python";
import { createGitRuntimeInstallerAdapter } from "../../../adapters/runtime/installer/git/createGitRuntimeInstallerAdapter";
import { createLocalModelRegistryAdapter } from "../../../adapters/persistence/model";
import { createHuggingFaceModelBrowseDetailsAdapter } from "../../../adapters/model/huggingface";
import { createLocalImageAssetRegistryAdapter } from "../../../adapters/persistence/image";
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
  BrowseModelsUseCase,
  GetModelDetailsUseCase,
  ListModelsUseCase,
  SaveModelReferenceUseCase,
  DownloadModelUseCase,
  UpdateModelRecordUseCase,
  DeleteModelRecordUseCase,
} from "../../../application/use-cases";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import {
  createArtifactRepoStorageAdapter,
} from "../../../adapters/storage/artifact-repo";
import {
  createFilesystemArtifactBrowserReadAdapter,
  createFilesystemArtifactContentRetrievalAdapter,
  createFilesystemArtifactObjectStorageAdapter,
  createFilesystemGeneratedImagePersistenceAdapter,
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



type ComfyUiRuntimeDeviceMode = "auto" | "cpu" | "directml" | "cuda";

function resolveComfyUiRuntimeDeviceMode(env: NodeJS.ProcessEnv = process.env): ComfyUiRuntimeDeviceMode {
  const raw = env.COMFYUI_RUNTIME_DEVICE_MODE ?? env.COMFYUI_ACCELERATOR;
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return "auto";
  if (normalized === "auto" || normalized === "cpu" || normalized === "directml" || normalized === "cuda") return normalized;
  throw new Error(`Unsupported COMFYUI runtime mode "${raw}". Use auto, cpu, directml, or cuda via COMFYUI_RUNTIME_DEVICE_MODE/COMFYUI_ACCELERATOR.`);
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new Error(`Invalid boolean environment value "${value}".`);
}

function parseNumberEnv(value: string | undefined, name: string): number | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number.`);
  return parsed;
}
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

      const resolvedRuntimeDeviceMode = resolveComfyUiRuntimeDeviceMode(process.env);
      void loggingPort.log({ level: "info", message: "Resolved ComfyUI runtime device mode.", timestamp: new Date().toISOString(), verbosity: "normal", event: "runtime.comfyui.configuration", component: "server-host", subsystem: "runtime", data: { runtimeDeviceMode: resolvedRuntimeDeviceMode } });

      const comfyUiInstallRoot = process.env.COMFYUI_INSTALL_ROOT?.trim() || join(registerOptions.storageRootDirectory, "runtime-installs", "comfyui");
      const comfyUiBaseUrl = process.env.COMFYUI_BASE_URL?.trim() || "http://127.0.0.1:8188";
      const installCommandTimeoutMs = parseNumberEnv(process.env.COMFYUI_INSTALL_COMMAND_TIMEOUT_MS, "COMFYUI_INSTALL_COMMAND_TIMEOUT_MS");
      const execFileWithTimeout = installCommandTimeoutMs
        ? async (file: string, args: readonly string[] = []) => {
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            return promisify(execFile)(file, [...args], { timeout: installCommandTimeoutMs }) as Promise<{ stdout: string; stderr: string }>;
          }
        : undefined;
      const gitRuntimeInstaller = createGitRuntimeInstallerAdapter({ logging: loggingPort, execFile: execFileWithTimeout });
      const comfyUiInstaller = createComfyUiRuntimeInstaller({
        gitInstaller: gitRuntimeInstaller,
        pythonCommand: process.env.COMFYUI_PYTHON_COMMAND ?? (process.platform === "win32" ? "python" : "python3"),
        runtimeDeviceMode: resolvedRuntimeDeviceMode,
        skipPythonSetup: parseBooleanEnv(process.env.COMFYUI_SKIP_PYTHON_SETUP),
        skipPythonValidation: parseBooleanEnv(process.env.COMFYUI_SKIP_PYTHON_VALIDATION),
        pythonEnvironmentMode: process.env.COMFYUI_PYTHON_ENVIRONMENT_MODE as "managed-venv" | "ambient" | undefined,
        directMlTorchVersion: process.env.COMFYUI_DIRECTML_TORCH_VERSION,
        directMlTorchAudioVersion: process.env.COMFYUI_DIRECTML_TORCHAUDIO_VERSION,
        directMlTorchVisionVersion: process.env.COMFYUI_DIRECTML_TORCHVISION_VERSION,
        directMlPackageName: process.env.COMFYUI_DIRECTML_PACKAGE,
        logging: loggingPort,
      });
      const comfyUiSupervisor = createComfyUiRuntimeSupervisor({
        workingDirectory: comfyUiInstallRoot,
        pythonExecutable: process.env.COMFYUI_PYTHON_COMMAND ?? (process.platform === "win32" ? "python" : "python3"),
        installer: comfyUiInstaller,
        installRoot: comfyUiInstallRoot,
        runtimeDeviceMode: resolvedRuntimeDeviceMode,
        autoInstall: true,
        installSourceRef: process.env.COMFYUI_INSTALL_REF,
        
        logging: loggingPort,
      });
      const runtimeTaskRegistry = createComfyUiImageGenerationRuntimeAdapter({
        client: createComfyUiHttpClient({ baseUrl: comfyUiBaseUrl }),
        supervisor: comfyUiSupervisor,
        mapperOptions: { defaultCheckpoint: process.env.COMFYUI_DEFAULT_CHECKPOINT },
      });
      
      const modelManagementLogger = {
        info: (event: string, data: Record<string, unknown>) => { void loggingPort.log({ level:"info", message:event, event, component:"model-management", subsystem:"api", timestamp:new Date().toISOString(), verbosity:"normal", data }); },
        warn: (event: string, data: Record<string, unknown>) => { void loggingPort.log({ level:"warn", message:event, event, component:"model-management", subsystem:"api", timestamp:new Date().toISOString(), verbosity:"normal", data }); },
      };

      const modelRegistry = createLocalModelRegistryAdapter({ filePath: `${registerOptions.storageRootDirectory}/model-registry/models.json`, now: options.now });
      const huggingFaceModelBrowseDetails = createHuggingFaceModelBrowseDetailsAdapter({
        accessTokenProvider: () => tokenConfigStore.getToken(),
        logger: modelManagementLogger,
      });
      const browseModelsUseCase = new BrowseModelsUseCase({ providers: { huggingface: huggingFaceModelBrowseDetails } });
      const getModelDetailsUseCase = new GetModelDetailsUseCase({ providers: { huggingface: huggingFaceModelBrowseDetails } });
      const listModelsUseCase = new ListModelsUseCase({ modelRegistry });
      const saveModelReferenceUseCase = new SaveModelReferenceUseCase({ modelRegistry });
      const pythonRuntimeBaseUrl = process.env.PYTHON_RUNTIME_BASE_URL?.trim() || "http://127.0.0.1:43111";
      const pythonRuntimeEndpoint = new URL(pythonRuntimeBaseUrl);
      const pythonRuntimeEnvironment = {
        ...process.env,
        PYTHON_RUNTIME_HOST: pythonRuntimeEndpoint.hostname,
        PYTHON_RUNTIME_PORT: pythonRuntimeEndpoint.port || "43111",
        HF_HOME: join(registerOptions.storageRootDirectory, "models", "huggingface"),
        TRANSFORMERS_CACHE: join(registerOptions.storageRootDirectory, "models", "huggingface", "hub"),
        HF_HUB_DISABLE_XET: process.env.HF_HUB_DISABLE_XET ?? "1",
        HF_HUB_DISABLE_SYMLINKS_WARNING: process.env.HF_HUB_DISABLE_SYMLINKS_WARNING ?? "1",
      };
      const pythonRuntimeFoundation = createPythonRuntimeAdapterFoundation({
        client: { baseUrl: pythonRuntimeBaseUrl },
        supervisor: {
          command: process.env.PYTHON_RUNTIME_COMMAND ?? (process.platform === "win32" ? "python" : "python3"),
          args: process.env.PYTHON_RUNTIME_ARGS?.split(" ").filter(Boolean) ?? ["main.py"],
          cwd: process.env.PYTHON_RUNTIME_WORKER_DIR ?? "modules/adapters/runtime/python/worker",
          env: pythonRuntimeEnvironment,
          prepareRuntimeEnvironment(context) {
            ensurePythonRuntimeWorkerDependencies({ command: context.command, cwd: context.cwd, env: context.env });
          },
        },
      });
      const downloadModelUseCase = new DownloadModelUseCase({
        modelRegistry,
        modelDownloader: {
          ensureModelDownloaded: async (request) => {
            await pythonRuntimeFoundation.supervisor.start();
            return pythonRuntimeFoundation.runtimePort.ensureModelDownloaded(request);
          },
        },
      });
      const updateModelRecordUseCase = new UpdateModelRecordUseCase({ modelRegistry });
      const deleteModelRecordUseCase = new DeleteModelRecordUseCase({ modelRegistry });
      const generateImageUseCase = new GenerateImageUseCase({
        runtimeTaskRegistry,
        modelCheckpointResolver: createLocalModelCheckpointResolverAdapter({
          modelRegistry,
          comfyUiCheckpointDirectory: join(comfyUiInstallRoot, "models", "checkpoints"),
        }),
      });

      const imageGenerationFinalizationOrchestrator = new ImageGenerationFinalizationOrchestratorService({
        runtimeTaskRegistry,
        finalizeImageGenerationService: new FinalizeImageGenerationService({
          imageAssetRegistry: createLocalImageAssetRegistryAdapter({
            filePath: join(registerOptions.storageRootDirectory, ".catalog", "image-assets.json"),
            now: options.now,
          }),
          generatedImagePersistence: createFilesystemGeneratedImagePersistenceAdapter({
            comfyUiOutputRoot: join(comfyUiInstallRoot, "output"),
            artifactStorageRoot: registerOptions.storageRootDirectory,
            artifactCatalogAppend: artifactCatalog,
            artifactStorageBinding: artifactBindings,
            logging: loggingPort,
            now: options.now,
          }),
          now: options.now,
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
        browseModelsUseCase,
        getModelDetailsUseCase,
        listModelsUseCase,
        saveModelReferenceUseCase,
        downloadModelUseCase,
        updateModelRecordUseCase,
        deleteModelRecordUseCase,
        generateImageUseCase,
        imageGenerationFinalizationOrchestrator,
        modelManagementLogger,
      });
    },
  };
}
