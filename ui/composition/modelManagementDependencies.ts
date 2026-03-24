import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IManagedModelLibrary } from "../../application/ports/interfaces/IManagedModelLibrary";
import type { IModelDownloader } from "../../application/ports/interfaces/IModelDownloader";
import type { IModelInstaller } from "../../application/ports/interfaces/IModelInstaller";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import { DesktopBridgeFileStorage } from "../../infrastructure/browser/filesystem/DesktopBridgeFileStorage";
import { BrowserDownloadModelLibrary } from "../../infrastructure/browser/models/BrowserDownloadModelLibrary";
import { BrowserHuggingFaceModelDownloader } from "../../infrastructure/browser/models/BrowserHuggingFaceModelDownloader";
import { LocalStorageInstalledModelCatalog } from "../../infrastructure/browser/models/LocalStorageInstalledModelCatalog";
import { FilesystemModelInstaller } from "../../infrastructure/filesystem/FilesystemModelInstaller";
import { LocalModelRepository } from "../../infrastructure/filesystem/LocalModelRepository";
import { ManagedLocalModelLibrary } from "../../infrastructure/filesystem/ManagedLocalModelLibrary";
import { HuggingFaceApiClient } from "../../infrastructure/huggingface/HuggingFaceApiClient";
import { HuggingFaceModelDownloader } from "../../infrastructure/huggingface/HuggingFaceModelDownloader";
import type { DesktopModelFileBridge } from "../../electron/shared/DesktopContracts";

export interface ModelManagementDependencies {
  readonly fileStorage?: IFileStorage;
  readonly installedModelCatalog: IInstalledModelCatalog;
  readonly managedModelLibrary: IManagedModelLibrary;
  readonly installers: ReadonlyArray<IModelInstaller>;
  readonly downloader: IModelDownloader;
}

export function createModelManagementDependencies(options: {
  readonly apiClient: HuggingFaceApiClient;
  readonly desktopModelFileBridge?: DesktopModelFileBridge;
  readonly modelInstallDirectory: string;
  readonly durableStorage?: Storage;
}): ModelManagementDependencies {
  const fileStorage = options.desktopModelFileBridge
    ? new DesktopBridgeFileStorage(options.desktopModelFileBridge)
    : undefined;

  if (!fileStorage) {
    const installedModelCatalog = new LocalStorageInstalledModelCatalog(
      undefined,
      options.durableStorage as never,
    );

    return Object.freeze({
      fileStorage: undefined,
      installedModelCatalog,
      managedModelLibrary: new BrowserDownloadModelLibrary(
        installedModelCatalog,
        options.modelInstallDirectory,
      ),
      installers: Object.freeze([]),
      downloader: new BrowserHuggingFaceModelDownloader({
        apiClient: options.apiClient,
      }),
    });
  }

  const installedModelCatalog = new LocalModelRepository({
    fileStorage,
    rootDirectory: options.modelInstallDirectory,
  });

  return Object.freeze({
    fileStorage,
    installedModelCatalog,
    managedModelLibrary: new ManagedLocalModelLibrary(
      fileStorage,
      installedModelCatalog,
      options.modelInstallDirectory,
    ),
    installers: Object.freeze([new FilesystemModelInstaller(fileStorage)]),
    downloader: new HuggingFaceModelDownloader({
      apiClient: options.apiClient,
      fileStorage,
    }),
  });
}
