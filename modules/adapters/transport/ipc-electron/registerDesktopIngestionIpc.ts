import { registerWebsiteIngestionIpc, type RegisterWebsiteIngestionIpcDependencies } from "./website-ingestion/registerWebsiteIngestionIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider, type LazyProvidedObjectOptions } from "./lazyFeatureProvider";

export type DesktopIngestionIpcFeature = Omit<RegisterWebsiteIngestionIpcDependencies, "ipcMain">;

export interface RegisterDesktopIngestionIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getIngestionFeature: AsyncFeatureProvider<DesktopIngestionIpcFeature>;
  lifecycle?: LazyProvidedObjectOptions;
}

export function registerDesktopIngestionIpc(dependencies: RegisterDesktopIngestionIpcDependencies): void {
  registerWebsiteIngestionIpc({
    ipcMain: dependencies.ipcMain,
    ingestWebsitePageUseCase: lazyProvidedObject(dependencies.getIngestionFeature, (feature) => feature.ingestWebsitePageUseCase, dependencies.lifecycle),
    ingestWebsitePagesBatchUseCase: lazyProvidedObject(dependencies.getIngestionFeature, (feature) => feature.ingestWebsitePagesBatchUseCase, dependencies.lifecycle),
  });
}
