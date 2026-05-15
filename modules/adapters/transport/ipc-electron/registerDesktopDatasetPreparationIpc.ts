import { registerDatasetPreparationIpc, type RegisterDatasetPreparationIpcDependencies } from "./dataset-preparation/registerDatasetPreparationIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export type DesktopDatasetPreparationIpcFeature = Omit<RegisterDatasetPreparationIpcDependencies, "ipcMain">;

export interface RegisterDesktopDatasetPreparationIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getDatasetPreparationFeature: AsyncFeatureProvider<DesktopDatasetPreparationIpcFeature>;
}

export function registerDesktopDatasetPreparationIpc(dependencies: RegisterDesktopDatasetPreparationIpcDependencies): void {
  registerDatasetPreparationIpc({
    ipcMain: dependencies.ipcMain,
    prepareTrainingDatasetUseCase: lazyProvidedObject(dependencies.getDatasetPreparationFeature, (feature) => feature.prepareTrainingDatasetUseCase),
  });
}
