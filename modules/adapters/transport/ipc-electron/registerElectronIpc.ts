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
