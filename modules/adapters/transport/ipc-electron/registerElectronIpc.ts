import { registerArtifactUploadIpc } from "./artifact-upload/registerArtifactUploadIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { registerArtifactBrowserIpc } from "./artifact-browser/registerArtifactBrowserIpc";
import { registerWebsiteIngestionIpc } from "./website-ingestion/registerWebsiteIngestionIpc";
import { registerDatasetPreparationIpc } from "./dataset-preparation/registerDatasetPreparationIpc";
import { registerPythonRuntimeIpc, type PythonRuntimeControlPort } from "./python-runtime/registerPythonRuntimeIpc";
import { registerApplicationSettingsIpc } from "./settings/registerApplicationSettingsIpc";
import { registerModelManagementIpc } from "./model/registerModelManagementIpc";
import { registerImageGenerationIpc } from "./image-generation/registerImageGenerationIpc";
import { registerComfyUiRuntimeIpc } from "./comfyui-runtime/registerComfyUiRuntimeIpc";
import { registerRuntimeReadinessIpc } from "./runtime-readiness/registerRuntimeReadinessIpc";
import { registerAssetRegistryIpc } from "./asset-registry/registerAssetRegistryIpc";
import { registerAssetMutationIpc } from "./asset-registry/registerAssetMutationIpc";
import { registerWorkspaceIpc, type RegisterWorkspaceIpcDependencies } from "./workspace/registerWorkspaceIpc";

export type AsyncFeatureProvider<T extends object> = () => Promise<T>;

function lazyProvidedObject<T extends object>(provider: AsyncFeatureProvider<T>, select?: (feature: T) => object): any {
  return new Proxy({}, {
    get(_target, property) {
      if (property === "then") return undefined;
      return async (...args: unknown[]) => {
        const feature = await provider();
        const object = select ? select(feature) : feature;
        const value = (object as Record<PropertyKey, unknown>)[property];
        if (typeof value !== "function") return value;
        return value.apply(object, args);
      };
    },
  });
}

export interface RegisterElectronIpcDependencies {
  ipcMain: IpcMainHandlePort;
  pythonRuntime: PythonRuntimeControlPort;
  runtimeReadiness: any;
  workspaceServices?: Omit<RegisterWorkspaceIpcDependencies, "ipcMain">;
  settingsUseCases: any;
  tokens: {
    getHuggingFaceTokenStatus: () => any;
    setHuggingFaceToken: (token: string) => any;
    clearHuggingFaceToken: () => any;
  };
  features: {
    artifact: AsyncFeatureProvider<any>;
    artifactRemote: AsyncFeatureProvider<any>;
    asset: AsyncFeatureProvider<any>;
    model: AsyncFeatureProvider<any>;
    imageGeneration: AsyncFeatureProvider<any>;
    comfyUi: AsyncFeatureProvider<any>;
    ingestion: AsyncFeatureProvider<any>;
    datasetPreparation: AsyncFeatureProvider<any>;
  };
}

export function registerElectronIpc(dependencies: RegisterElectronIpcDependencies): void {
  registerRuntimeReadinessIpc({ ipcMain: dependencies.ipcMain, runtimeReadiness: dependencies.runtimeReadiness });

  registerArtifactUploadIpc({
    ipcMain: dependencies.ipcMain,
    storeArtifactUploadUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.storeArtifactUploadUseCase),
  });

  if (dependencies.workspaceServices) registerWorkspaceIpc({ ipcMain: dependencies.ipcMain, ...dependencies.workspaceServices });

  registerAssetRegistryIpc({ ipcMain: dependencies.ipcMain, assetRegistryRead: lazyProvidedObject(dependencies.features.asset, (feature) => feature.assetRegistryRead) });
  registerAssetMutationIpc({
    ipcMain: dependencies.ipcMain,
    registerResourceBackedViewAsAsset: lazyProvidedObject(dependencies.features.asset, (feature) => feature.assetMutationUseCases.registerResourceBackedViewAsAsset),
    finalizeGeneratedOutputAsAsset: lazyProvidedObject(dependencies.features.asset, (feature) => feature.assetMutationUseCases.finalizeGeneratedOutputAsAsset),
    importExternalRepositoryObjectAsAsset: lazyProvidedObject(dependencies.features.asset, (feature) => feature.assetMutationUseCases.importExternalRepositoryObjectAsAsset),
    localizeExternalRepositoryObjectAsAsset: lazyProvidedObject(dependencies.features.asset, (feature) => feature.assetMutationUseCases.localizeExternalRepositoryObjectAsAsset),
  });

  registerArtifactBrowserIpc({
    ipcMain: dependencies.ipcMain,
    getHuggingFaceTokenStatus: dependencies.tokens.getHuggingFaceTokenStatus,
    setHuggingFaceToken: dependencies.tokens.setHuggingFaceToken,
    clearHuggingFaceToken: dependencies.tokens.clearHuggingFaceToken,
    browseArtifactsUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.browseArtifactsUseCase),
    browseUnregisteredArtifactsUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.browseUnregisteredArtifactsUseCase),
    registerUnregisteredArtifactUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.registerUnregisteredArtifactUseCase),
    deleteUnregisteredArtifactUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.deleteUnregisteredArtifactUseCase),
    deleteRegisteredArtifactUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.deleteRegisteredArtifactUseCase),
    readArtifactDetailUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.readArtifactDetailUseCase),
    readArtifactContentUseCase: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.readArtifactContentUseCase),
    artifactMediaViewRetrieval: lazyProvidedObject(dependencies.features.artifact, (feature) => feature.artifactMediaViewRetrieval),
    publishArtifactToRepoUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.publishArtifactToRepoUseCase),
    browseHuggingFaceNamespaceDatasetsUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.browseHuggingFaceNamespaceDatasetsUseCase),
    browseHuggingFaceDatasetParquetFilesUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.browseHuggingFaceDatasetParquetFilesUseCase),
    verifyPublishedArtifactBackingUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.verifyPublishedArtifactBackingUseCase),
    verifyImportedArtifactSourceBackingUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.verifyImportedArtifactSourceBackingUseCase),
    registerArtifactFromRepoUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.registerArtifactFromRepoUseCase),
    localizeArtifactFromRepoUseCase: lazyProvidedObject(dependencies.features.artifactRemote, (feature) => feature.localizeArtifactFromRepoUseCase),
  });

  registerWebsiteIngestionIpc({ ipcMain: dependencies.ipcMain, ingestWebsitePageUseCase: lazyProvidedObject(dependencies.features.ingestion, (feature) => feature.ingestWebsitePageUseCase), ingestWebsitePagesBatchUseCase: lazyProvidedObject(dependencies.features.ingestion, (feature) => feature.ingestWebsitePagesBatchUseCase) });
  registerDatasetPreparationIpc({ ipcMain: dependencies.ipcMain, prepareTrainingDatasetUseCase: lazyProvidedObject(dependencies.features.datasetPreparation, (feature) => feature.prepareTrainingDatasetUseCase) });

  registerApplicationSettingsIpc({ ipcMain: dependencies.ipcMain, ...dependencies.settingsUseCases });
  registerModelManagementIpc({
    ipcMain: dependencies.ipcMain,
    browseModelsUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.browseModelsUseCase),
    getModelDetailsUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.getModelDetailsUseCase),
    listModelsUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.listModelsUseCase),
    saveModelReferenceUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.saveModelReferenceUseCase),
    downloadModelUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.downloadModelUseCase),
    updateModelRecordUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.updateModelRecordUseCase),
    deleteModelRecordUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.deleteModelRecordUseCase),
    trainModelUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.trainModelUseCase),
    validateModelUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.validateModelUseCase),
    publishModelUseCase: lazyProvidedObject(dependencies.features.model, (feature) => feature.publishModelUseCase),
  });

  registerImageGenerationIpc({ ipcMain: dependencies.ipcMain, generateImageUseCase: lazyProvidedObject(dependencies.features.imageGeneration, (feature) => feature.generateImageUseCase), imageGenerationFinalizationOrchestrator: lazyProvidedObject(dependencies.features.imageGeneration, (feature) => feature.imageGenerationFinalizationOrchestrator) });

  registerComfyUiRuntimeIpc({
    ipcMain: dependencies.ipcMain,
    installer: lazyProvidedObject(dependencies.features.comfyUi, (feature) => feature.installer),
    getInstallRoot: async () => (await dependencies.features.comfyUi()).installRoot,
  });

  registerPythonRuntimeIpc({ ipcMain: dependencies.ipcMain, ...dependencies.pythonRuntime });
}
