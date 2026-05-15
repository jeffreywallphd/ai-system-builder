import { registerDatasetPreparationIpc } from "./dataset-preparation/registerDatasetPreparationIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export interface RegisterDesktopDatasetPreparationIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getDatasetPreparationFeature: AsyncFeatureProvider<any>;
}

export function registerDesktopDatasetPreparationIpc(dependencies: RegisterDesktopDatasetPreparationIpcDependencies): void {
  registerDatasetPreparationIpc({
    ipcMain: dependencies.ipcMain,
    prepareTrainingDatasetUseCase: lazyProvidedObject(dependencies.getDatasetPreparationFeature, (feature) => feature.prepareTrainingDatasetUseCase),
  });
}
