import { registerImageGenerationIpc } from "./image-generation/registerImageGenerationIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export interface RegisterDesktopImageGenerationIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getImageGenerationFeature: AsyncFeatureProvider<any>;
}

export function registerDesktopImageGenerationIpc(dependencies: RegisterDesktopImageGenerationIpcDependencies): void {
  registerImageGenerationIpc({
    ipcMain: dependencies.ipcMain,
    generateImageUseCase: lazyProvidedObject(dependencies.getImageGenerationFeature, (feature) => feature.generateImageUseCase),
    imageGenerationFinalizationOrchestrator: lazyProvidedObject(dependencies.getImageGenerationFeature, (feature) => feature.imageGenerationFinalizationOrchestrator),
  });
}
