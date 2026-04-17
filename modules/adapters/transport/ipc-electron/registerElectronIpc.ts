import {
  registerImageUploadIpc,
  type RegisterImageUploadIpcDependencies,
} from "./image-upload/registerImageUploadIpc";
import {
  registerArtifactBrowserIpc,
  type RegisterArtifactBrowserIpcDependencies,
} from "./artifact-browser/registerArtifactBrowserIpc";

export type { IpcMainHandlePort } from "./image-upload/registerImageUploadIpc";

export interface RegisterElectronIpcDependencies {
  ipcMain: RegisterImageUploadIpcDependencies["ipcMain"];
  storeImageUploadUseCase: RegisterImageUploadIpcDependencies["storeImageUploadUseCase"];
  browseArtifactsUseCase: RegisterArtifactBrowserIpcDependencies["browseArtifactsUseCase"];
  readArtifactDetailUseCase: RegisterArtifactBrowserIpcDependencies["readArtifactDetailUseCase"];
  readArtifactContentUseCase: RegisterArtifactBrowserIpcDependencies["readArtifactContentUseCase"];
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
    browseArtifactsUseCase: dependencies.browseArtifactsUseCase,
    readArtifactDetailUseCase: dependencies.readArtifactDetailUseCase,
    readArtifactContentUseCase: dependencies.readArtifactContentUseCase,
  });
}
