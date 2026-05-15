import { registerModelManagementIpc } from "./model/registerModelManagementIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export interface RegisterDesktopModelIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getModelFeature: AsyncFeatureProvider<any>;
}

export function registerDesktopModelIpc(dependencies: RegisterDesktopModelIpcDependencies): void {
  registerModelManagementIpc({
    ipcMain: dependencies.ipcMain,
    browseModelsUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.browseModelsUseCase),
    getModelDetailsUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.getModelDetailsUseCase),
    listModelsUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.listModelsUseCase),
    saveModelReferenceUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.saveModelReferenceUseCase),
    downloadModelUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.downloadModelUseCase),
    updateModelRecordUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.updateModelRecordUseCase),
    deleteModelRecordUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.deleteModelRecordUseCase),
    trainModelUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.trainModelUseCase),
    validateModelUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.validateModelUseCase),
    publishModelUseCase: lazyProvidedObject(dependencies.getModelFeature, (feature) => feature.publishModelUseCase),
  });
}
