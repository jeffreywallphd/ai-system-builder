import { createLocalModelRegistryAdapter } from "../../../adapters/persistence/model";
import { createHuggingFaceModelBrowseDetailsAdapter, createHuggingFaceModelPublisherAdapter } from "../../../adapters/model/huggingface";
import { createLocalGeneratedModelStorageAdapter } from "../../../adapters/model/local";
import {
  BrowseModelsUseCase,
  DeleteModelRecordUseCase,
  DownloadModelUseCase,
  GetModelDetailsUseCase,
  ListModelsUseCase,
  PublishModelUseCase,
  SaveModelReferenceUseCase,
  TrainModelUseCase,
  UpdateModelRecordUseCase,
  ValidateModelUseCase,
} from "../../../application/use-cases";
import { asyncLazyObject } from "./lazyProxy";

export interface ComposeDesktopModelFeatureOptions {
  storageRootDirectory: string;
  now: () => string;
  tokenProvider: () => string | undefined;
  getArtifacts: () => Promise<any>;
  getRuntimeTaskFeatures: () => Promise<any>;
  getPythonRuntimeFoundation: () => Promise<any>;
}

export function composeDesktopModelFeature(options: ComposeDesktopModelFeatureOptions): any {
  const modelRegistry = createLocalModelRegistryAdapter({ filePath: `${options.storageRootDirectory}/model-registry/models.json`, now: options.now });
  const huggingFaceModelBrowseDetails = createHuggingFaceModelBrowseDetailsAdapter({ accessTokenProvider: options.tokenProvider });
  const modelPublisher = createHuggingFaceModelPublisherAdapter({
    tokenProvider: options.tokenProvider,
    client: { async uploadFile(params) {
      const hub = await import("@huggingface/hub");
      await hub.uploadFile({ repo: { type: "model", name: params.repo }, file: { path: params.path, content: new Blob([new Uint8Array(params.content)]) }, branch: params.revision, accessToken: params.token });
    } },
  });
  return {
    browseModelsUseCase: new BrowseModelsUseCase({ providers: { huggingface: huggingFaceModelBrowseDetails } }),
    getModelDetailsUseCase: new GetModelDetailsUseCase({ providers: { huggingface: huggingFaceModelBrowseDetails } }),
    listModelsUseCase: new ListModelsUseCase({ modelRegistry }),
    saveModelReferenceUseCase: new SaveModelReferenceUseCase({ modelRegistry }),
    downloadModelUseCase: new DownloadModelUseCase({ modelRegistry, modelDownloader: { ensureModelDownloaded: async (request) => { const foundation = await options.getPythonRuntimeFoundation(); await foundation.supervisor.start(); return foundation.runtimePort.ensureModelDownloaded(request); } } }),
    updateModelRecordUseCase: new UpdateModelRecordUseCase({ modelRegistry }),
    deleteModelRecordUseCase: new DeleteModelRecordUseCase({ modelRegistry, artifactCatalogDeletePort: asyncLazyObject(async () => (await options.getArtifacts()).artifactCatalog) }),
    trainModelUseCase: new TrainModelUseCase({ runtimeTaskRegistry: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).runtimeTaskRegistry), modelRegistry, storageBindings: asyncLazyObject(async () => (await options.getArtifacts()).artifactBindings), storage: asyncLazyObject(async () => (await options.getArtifacts()).storage), generatedModelStorage: asyncLazyObject(async () => createLocalGeneratedModelStorageAdapter({ env: process.env })), modelPublisher, taskPowerLifecycle: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).taskPowerLifecycle), runtimeCapabilityGuard: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).runtimeCapabilityGuard) }),
    validateModelUseCase: new ValidateModelUseCase({ runtimeTaskRegistry: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).runtimeTaskRegistry), modelRegistry, runtimeCapabilityGuard: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).runtimeCapabilityGuard) }),
    publishModelUseCase: new PublishModelUseCase({ modelRegistry, runtimeTaskRegistry: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).runtimeTaskRegistry), runtimeCapabilityGuard: asyncLazyObject(async () => (await options.getRuntimeTaskFeatures()).runtimeCapabilityGuard) }),
  };
}
