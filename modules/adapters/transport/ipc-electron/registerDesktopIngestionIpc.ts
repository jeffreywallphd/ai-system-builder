import { registerWebsiteIngestionIpc, type RegisterWebsiteIngestionIpcDependencies } from "./website-ingestion/registerWebsiteIngestionIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export type DesktopIngestionIpcFeature = Omit<RegisterWebsiteIngestionIpcDependencies, "ipcMain">;

export interface RegisterDesktopIngestionIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getIngestionFeature: AsyncFeatureProvider<DesktopIngestionIpcFeature>;
}

export function registerDesktopIngestionIpc(dependencies: RegisterDesktopIngestionIpcDependencies): void {
  registerWebsiteIngestionIpc({
    ipcMain: dependencies.ipcMain,
    ingestWebsitePageUseCase: lazyProvidedObject(dependencies.getIngestionFeature, (feature) => feature.ingestWebsitePageUseCase),
    ingestWebsitePagesBatchUseCase: lazyProvidedObject(dependencies.getIngestionFeature, (feature) => feature.ingestWebsitePagesBatchUseCase),
  });
}
