import {
  registerImageUploadIpc,
  type RegisterImageUploadIpcDependencies,
} from "./image-upload/registerImageUploadIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import {
  registerArtifactBrowserIpc,
  type RegisterArtifactBrowserIpcDependencies,
} from "./artifact-browser/registerArtifactBrowserIpc";

export interface RegisterElectronIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getHuggingFaceTokenStatus: RegisterArtifactBrowserIpcDependencies["getHuggingFaceTokenStatus"];
  setHuggingFaceToken: RegisterArtifactBrowserIpcDependencies["setHuggingFaceToken"];
  clearHuggingFaceToken: RegisterArtifactBrowserIpcDependencies["clearHuggingFaceToken"];
  storeImageUploadUseCase: RegisterImageUploadIpcDependencies["storeImageUploadUseCase"];
  browseArtifactsUseCase: RegisterArtifactBrowserIpcDependencies["browseArtifactsUseCase"];
  readArtifactDetailUseCase: RegisterArtifactBrowserIpcDependencies["readArtifactDetailUseCase"];
  readArtifactContentUseCase: RegisterArtifactBrowserIpcDependencies["readArtifactContentUseCase"];
  artifactMediaViewRetrieval: RegisterArtifactBrowserIpcDependencies["artifactMediaViewRetrieval"];
  publishArtifactToRepoUseCase: RegisterArtifactBrowserIpcDependencies["publishArtifactToRepoUseCase"];
  browseHuggingFaceNamespaceDatasetsUseCase: RegisterArtifactBrowserIpcDependencies["browseHuggingFaceNamespaceDatasetsUseCase"];
  browseHuggingFaceDatasetParquetFilesUseCase: RegisterArtifactBrowserIpcDependencies["browseHuggingFaceDatasetParquetFilesUseCase"];
  verifyPublishedArtifactBackingUseCase: RegisterArtifactBrowserIpcDependencies["verifyPublishedArtifactBackingUseCase"];
  verifyImportedArtifactSourceBackingUseCase: RegisterArtifactBrowserIpcDependencies["verifyImportedArtifactSourceBackingUseCase"];
  registerArtifactFromRepoUseCase: RegisterArtifactBrowserIpcDependencies["registerArtifactFromRepoUseCase"];
  localizeArtifactFromRepoUseCase: RegisterArtifactBrowserIpcDependencies["localizeArtifactFromRepoUseCase"];
}

export function registerElectronIpc(
  dependencies: RegisterElectronIpcDependencies,
): void {
  registerImageUploadIpc({
    ipcMain: dependencies.ipcMain,
    storeImageUploadUseCase: dependencies.storeImageUploadUseCase,
  });

  registerArtifactBrowserIpc({
    ipcMain: dependencies.ipcMain,
    getHuggingFaceTokenStatus: dependencies.getHuggingFaceTokenStatus,
    setHuggingFaceToken: dependencies.setHuggingFaceToken,
    clearHuggingFaceToken: dependencies.clearHuggingFaceToken,
    browseArtifactsUseCase: dependencies.browseArtifactsUseCase,
    readArtifactDetailUseCase: dependencies.readArtifactDetailUseCase,
    readArtifactContentUseCase: dependencies.readArtifactContentUseCase,
    artifactMediaViewRetrieval: dependencies.artifactMediaViewRetrieval,
    publishArtifactToRepoUseCase: dependencies.publishArtifactToRepoUseCase,
    browseHuggingFaceNamespaceDatasetsUseCase: dependencies.browseHuggingFaceNamespaceDatasetsUseCase,
    browseHuggingFaceDatasetParquetFilesUseCase: dependencies.browseHuggingFaceDatasetParquetFilesUseCase,
    verifyPublishedArtifactBackingUseCase: dependencies.verifyPublishedArtifactBackingUseCase,
    verifyImportedArtifactSourceBackingUseCase: dependencies.verifyImportedArtifactSourceBackingUseCase,
    registerArtifactFromRepoUseCase: dependencies.registerArtifactFromRepoUseCase,
    localizeArtifactFromRepoUseCase: dependencies.localizeArtifactFromRepoUseCase,
  });
}
