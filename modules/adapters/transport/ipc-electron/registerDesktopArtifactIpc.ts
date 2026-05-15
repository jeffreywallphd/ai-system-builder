import { registerArtifactUploadIpc, type StoreArtifactUploadUseCasePort } from "./artifact-upload/registerArtifactUploadIpc";
import { registerArtifactBrowserIpc, type RegisterArtifactBrowserIpcDependencies } from "./artifact-browser/registerArtifactBrowserIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

type HuggingFaceTokenStatus = { configured: boolean; maskedToken?: string };
export interface DesktopArtifactIpcFeature {
  storeArtifactUploadUseCase: StoreArtifactUploadUseCasePort;
  browseArtifactsUseCase: RegisterArtifactBrowserIpcDependencies["browseArtifactsUseCase"];
  browseUnregisteredArtifactsUseCase: RegisterArtifactBrowserIpcDependencies["browseUnregisteredArtifactsUseCase"];
  registerUnregisteredArtifactUseCase: RegisterArtifactBrowserIpcDependencies["registerUnregisteredArtifactUseCase"];
  deleteUnregisteredArtifactUseCase: RegisterArtifactBrowserIpcDependencies["deleteUnregisteredArtifactUseCase"];
  deleteRegisteredArtifactUseCase: RegisterArtifactBrowserIpcDependencies["deleteRegisteredArtifactUseCase"];
  readArtifactDetailUseCase: RegisterArtifactBrowserIpcDependencies["readArtifactDetailUseCase"];
  readArtifactContentUseCase: RegisterArtifactBrowserIpcDependencies["readArtifactContentUseCase"];
  artifactMediaViewRetrieval: RegisterArtifactBrowserIpcDependencies["artifactMediaViewRetrieval"];
}

export interface DesktopArtifactRemoteIpcFeature {
  publishArtifactToRepoUseCase: RegisterArtifactBrowserIpcDependencies["publishArtifactToRepoUseCase"];
  browseHuggingFaceNamespaceDatasetsUseCase: RegisterArtifactBrowserIpcDependencies["browseHuggingFaceNamespaceDatasetsUseCase"];
  browseHuggingFaceDatasetParquetFilesUseCase: RegisterArtifactBrowserIpcDependencies["browseHuggingFaceDatasetParquetFilesUseCase"];
  verifyPublishedArtifactBackingUseCase: RegisterArtifactBrowserIpcDependencies["verifyPublishedArtifactBackingUseCase"];
  verifyImportedArtifactSourceBackingUseCase: RegisterArtifactBrowserIpcDependencies["verifyImportedArtifactSourceBackingUseCase"];
  registerArtifactFromRepoUseCase: RegisterArtifactBrowserIpcDependencies["registerArtifactFromRepoUseCase"];
  localizeArtifactFromRepoUseCase: RegisterArtifactBrowserIpcDependencies["localizeArtifactFromRepoUseCase"];
}

export interface RegisterDesktopArtifactIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getArtifactFeature: AsyncFeatureProvider<DesktopArtifactIpcFeature>;
  getArtifactRemoteFeature: AsyncFeatureProvider<DesktopArtifactRemoteIpcFeature>;
  tokens: {
    getHuggingFaceTokenStatus: () => HuggingFaceTokenStatus;
    setHuggingFaceToken: (token: string) => HuggingFaceTokenStatus;
    clearHuggingFaceToken: () => HuggingFaceTokenStatus;
  };
}

export function registerDesktopArtifactIpc(dependencies: RegisterDesktopArtifactIpcDependencies): void {
  registerArtifactUploadIpc({ ipcMain: dependencies.ipcMain, storeArtifactUploadUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.storeArtifactUploadUseCase) });
  registerArtifactBrowserIpc({
    ipcMain: dependencies.ipcMain,
    getHuggingFaceTokenStatus: dependencies.tokens.getHuggingFaceTokenStatus,
    setHuggingFaceToken: dependencies.tokens.setHuggingFaceToken,
    clearHuggingFaceToken: dependencies.tokens.clearHuggingFaceToken,
    browseArtifactsUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.browseArtifactsUseCase),
    browseUnregisteredArtifactsUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.browseUnregisteredArtifactsUseCase),
    registerUnregisteredArtifactUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.registerUnregisteredArtifactUseCase),
    deleteUnregisteredArtifactUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.deleteUnregisteredArtifactUseCase),
    deleteRegisteredArtifactUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.deleteRegisteredArtifactUseCase),
    readArtifactDetailUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.readArtifactDetailUseCase),
    readArtifactContentUseCase: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.readArtifactContentUseCase),
    artifactMediaViewRetrieval: lazyProvidedObject(dependencies.getArtifactFeature, (feature) => feature.artifactMediaViewRetrieval),
    publishArtifactToRepoUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.publishArtifactToRepoUseCase),
    browseHuggingFaceNamespaceDatasetsUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.browseHuggingFaceNamespaceDatasetsUseCase),
    browseHuggingFaceDatasetParquetFilesUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.browseHuggingFaceDatasetParquetFilesUseCase),
    verifyPublishedArtifactBackingUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.verifyPublishedArtifactBackingUseCase),
    verifyImportedArtifactSourceBackingUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.verifyImportedArtifactSourceBackingUseCase),
    registerArtifactFromRepoUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.registerArtifactFromRepoUseCase),
    localizeArtifactFromRepoUseCase: lazyProvidedObject(dependencies.getArtifactRemoteFeature, (feature) => feature.localizeArtifactFromRepoUseCase),
  });
}
