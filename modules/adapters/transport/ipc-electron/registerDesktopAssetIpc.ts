import { registerAssetRegistryIpc } from "./asset-registry/registerAssetRegistryIpc";
import { registerAssetMutationIpc } from "./asset-registry/registerAssetMutationIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export interface RegisterDesktopAssetIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getAssetFeature: AsyncFeatureProvider<any>;
}

export function registerDesktopAssetIpc(dependencies: RegisterDesktopAssetIpcDependencies): void {
  registerAssetRegistryIpc({ ipcMain: dependencies.ipcMain, assetRegistryRead: lazyProvidedObject(dependencies.getAssetFeature, (feature) => feature.assetRegistryRead) });
  registerAssetMutationIpc({
    ipcMain: dependencies.ipcMain,
    registerResourceBackedViewAsAsset: lazyProvidedObject(dependencies.getAssetFeature, (feature) => feature.assetMutationUseCases.registerResourceBackedViewAsAsset),
    finalizeGeneratedOutputAsAsset: lazyProvidedObject(dependencies.getAssetFeature, (feature) => feature.assetMutationUseCases.finalizeGeneratedOutputAsAsset),
    importExternalRepositoryObjectAsAsset: lazyProvidedObject(dependencies.getAssetFeature, (feature) => feature.assetMutationUseCases.importExternalRepositoryObjectAsAsset),
    localizeExternalRepositoryObjectAsAsset: lazyProvidedObject(dependencies.getAssetFeature, (feature) => feature.assetMutationUseCases.localizeExternalRepositoryObjectAsAsset),
  });
}
