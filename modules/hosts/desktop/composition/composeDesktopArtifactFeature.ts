import type { LoggingPort } from "../../../application/ports/logging";
import {
  BrowseArtifactsUseCase,
  BrowseUnregisteredArtifactsUseCase,
  DeleteRegisteredArtifactUseCase,
  DeleteUnregisteredArtifactUseCase,
  ReadArtifactContentUseCase,
  ReadArtifactDetailUseCase,
  RegisterUnregisteredArtifactUseCase,
  StoreArtifactUploadUseCase,
} from "../../../application/use-cases";
import {
  createFilesystemArtifactBrowserReadAdapter,
  createFilesystemArtifactContentRetrievalAdapter,
  createFilesystemArtifactObjectStorageAdapter,
  createLocalArtifactCatalogPersistenceAdapter,
  createLocalArtifactStorageBindingAdapter,
} from "../../../adapters/storage/filesystem";

export interface ComposeDesktopArtifactFeatureOptions {
  storageRootDirectory: string;
  loggingPort: LoggingPort;
  now?: () => string;
  workspaceShell: any;
}

export function composeDesktopArtifactFeature(options: ComposeDesktopArtifactFeatureOptions): any {
  const artifactCatalog = createLocalArtifactCatalogPersistenceAdapter({ rootDirectory: options.storageRootDirectory });
  const artifactBindings = createLocalArtifactStorageBindingAdapter({ rootDirectory: options.storageRootDirectory });
  const storage = createFilesystemArtifactObjectStorageAdapter({
    rootDirectory: options.storageRootDirectory,
    host: "desktop",
    logging: options.loggingPort,
    now: options.now,
    artifactCatalogAppend: artifactCatalog,
  });
  const artifactBrowserRead = createFilesystemArtifactBrowserReadAdapter({
    rootDirectory: options.storageRootDirectory,
    artifactCatalogRead: artifactCatalog,
    artifactCatalogAppend: artifactCatalog,
    storage,
    artifactBindingRead: artifactBindings,
  });
  const artifactMediaViewRetrieval = createFilesystemArtifactContentRetrievalAdapter({ storage, artifactCatalogRead: artifactCatalog });
  return {
    artifactCatalog,
    artifactBindings,
    storage,
    artifactBrowserRead,
    artifactMediaViewRetrieval,
    storeArtifactUploadUseCase: new StoreArtifactUploadUseCase({ storage, logging: options.loggingPort, now: options.now, workspaceRepository: options.workspaceShell.workspaceRepository }),
    browseArtifactsUseCase: new BrowseArtifactsUseCase({ artifactBrowserMetadataRead: artifactBrowserRead, workspaceRepository: options.workspaceShell.workspaceRepository }),
    browseUnregisteredArtifactsUseCase: new BrowseUnregisteredArtifactsUseCase({ artifactBrowserUnregistered: artifactBrowserRead }),
    registerUnregisteredArtifactUseCase: new RegisterUnregisteredArtifactUseCase({ artifactBrowserUnregistered: artifactBrowserRead }),
    deleteUnregisteredArtifactUseCase: new DeleteUnregisteredArtifactUseCase({ artifactBrowserUnregistered: artifactBrowserRead }),
    deleteRegisteredArtifactUseCase: new DeleteRegisteredArtifactUseCase({ artifactCatalogRead: artifactCatalog, artifactCatalogDelete: artifactCatalog, storage, artifactBindingStorage: artifactBindings, workspaceRepository: options.workspaceShell.workspaceRepository }),
    readArtifactDetailUseCase: new ReadArtifactDetailUseCase({ artifactBrowserMetadataRead: artifactBrowserRead, workspaceRepository: options.workspaceShell.workspaceRepository }),
    readArtifactContentUseCase: new ReadArtifactContentUseCase({ artifactBrowserContentRead: artifactBrowserRead, workspaceRepository: options.workspaceShell.workspaceRepository }),
  };
}
