import { registerImageGenerationIpc, type RegisterImageGenerationIpcDependencies } from "./image-generation/registerImageGenerationIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export type DesktopImageGenerationIpcFeature = Omit<RegisterImageGenerationIpcDependencies, "ipcMain">;

export interface RegisterDesktopImageGenerationIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getImageGenerationFeature: AsyncFeatureProvider<DesktopImageGenerationIpcFeature>;
}

export function registerDesktopImageGenerationIpc(dependencies: RegisterDesktopImageGenerationIpcDependencies): void {
  registerImageGenerationIpc({
    ipcMain: dependencies.ipcMain,
    generateImageUseCase: lazyProvidedObject(dependencies.getImageGenerationFeature, (feature) => feature.generateImageUseCase),
    imageGenerationFinalizationOrchestrator: lazyProvidedObject(dependencies.getImageGenerationFeature, (feature) => feature.imageGenerationFinalizationOrchestrator ?? { finalizeIfCompleted: async () => ({ finalized: false, reason: "image generation finalization is unavailable" }) }),
  });
}
