import type { ArtifactRepoStoragePort } from "../../../application/ports/storage";
import type { LoggingPort } from "../../../application/ports/logging";
import {
  BrowseArtifactsUseCase,
  HasArtifactInRepoUseCase,
  ReadArtifactContentUseCase,
  ReadArtifactDetailUseCase,
  StoreArtifactInRepoUseCase,
  StoreImageUploadUseCase,
} from "../../../application/use-cases";
import { createLogger, type StructuredLogSink } from "../../../adapters/observability/logging";
import {
  createArtifactRepoStorageAdapter,
} from "../../../adapters/storage/artifact-repo";
import {
  createFilesystemArtifactBrowserReadAdapter,
  createFilesystemArtifactContentRetrievalAdapter,
  createFilesystemArtifactObjectStorageAdapter,
  createLocalArtifactCatalogPersistenceAdapter,
} from "../../../adapters/storage/filesystem";
import {
  createHuggingFaceArtifactRepoStorageAdapter,
} from "../../../adapters/storage/huggingface";
import { registerExpressApi } from "../../../adapters/transport/api-express/registerExpressApi";
import type { ExpressPostRoutePort } from "../../../adapters/transport/api-express/image-upload/registerImageUploadApiRoute";
import type { ExpressRoutePort } from "../../../adapters/transport/api-express/artifact-browser/registerArtifactBrowserApiRoutes";
import { createLoggingConfig, type LoggingConfig } from "../../../contracts/config";
import type { LogLevel, LogVerbosity } from "../../../contracts/logging";

export interface ComposeServerHostLoggingOptions {
  verbosity?: string;
  fallbackVerbosity?: LogVerbosity;
  level?: LogLevel;
  includeDiagnostics?: boolean;
}

export interface ComposeServerHostArtifactRepoOptions {
  huggingFaceAccessToken?: string;
  huggingFaceFetchImplementation?: typeof fetch;
}

export interface ComposeServerHostOptions {
  logging?: ComposeServerHostLoggingOptions;
  logSink?: StructuredLogSink;
  now?: () => string;
  artifactRepo?: ComposeServerHostArtifactRepoOptions;
}

export interface RegisterServerApiOptions {
  app: ExpressPostRoutePort & ExpressRoutePort;
  storageRootDirectory: string;
}

export interface ServerHostComposition {
  loggingPort: LoggingPort;
  loggingConfig: LoggingConfig;
  artifactRepoStorage: ArtifactRepoStoragePort;
  registerApi: (options: RegisterServerApiOptions) => void;
}

export function composeServerHost(
  options: ComposeServerHostOptions = {},
): ServerHostComposition {
  const loggingConfig = createLoggingConfig({
    verbosity: options.logging?.verbosity,
    fallbackVerbosity: options.logging?.fallbackVerbosity,
    level: options.logging?.level,
    includeDiagnostics: options.logging?.includeDiagnostics,
  });

  const loggingPort = createLogger({
    config: loggingConfig,
    host: "server",
    component: "server-host",
    sink: options.logSink,
    now: options.now,
  });

  const artifactRepoStorage = createArtifactRepoStorageAdapter({
    providers: [
      {
        provider: "huggingface",
        adapter: createHuggingFaceArtifactRepoStorageAdapter({
          accessToken: options.artifactRepo?.huggingFaceAccessToken,
          fetchImplementation: options.artifactRepo?.huggingFaceFetchImplementation,
        }),
      },
    ],
  });

  return {
    loggingPort,
    loggingConfig,
    artifactRepoStorage,
    registerApi(registerOptions) {
      const artifactCatalog = createLocalArtifactCatalogPersistenceAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
      });
      const storage = createFilesystemArtifactObjectStorageAdapter({
        rootDirectory: registerOptions.storageRootDirectory,
        host: "server",
        logging: loggingPort,
        now: options.now,
        artifactCatalogAppend: artifactCatalog,
      });
      const artifactBrowserRead = createFilesystemArtifactBrowserReadAdapter({
        artifactCatalogRead: artifactCatalog,
        storage,
      });
      const artifactMediaViewRetrieval = createFilesystemArtifactContentRetrievalAdapter({
        storage,
        artifactCatalogRead: artifactCatalog,
      });

      const storeImageUploadUseCase = new StoreImageUploadUseCase({
        storage,
        logging: loggingPort,
        now: options.now,
      });

      const browseArtifacts = new BrowseArtifactsUseCase({
        artifactBrowserMetadataRead: artifactBrowserRead,
      });
      const readArtifactDetail = new ReadArtifactDetailUseCase({
        artifactBrowserMetadataRead: artifactBrowserRead,
      });
      const readArtifactContent = new ReadArtifactContentUseCase({
        artifactBrowserContentRead: artifactBrowserRead,
      });

      const hasArtifactInRepo = new HasArtifactInRepoUseCase({
        artifactRepoStorage,
      });
      const storeArtifactInRepo = new StoreArtifactInRepoUseCase({
        artifactRepoStorage,
      });

      registerExpressApi({
        app: registerOptions.app,
        storeImageUploadUseCase,
        browseArtifactsUseCase: browseArtifacts,
        readArtifactDetailUseCase: readArtifactDetail,
        readArtifactContentUseCase: readArtifactContent,
        artifactMediaViewRetrieval,
        hasArtifactInRepoUseCase: hasArtifactInRepo,
        storeArtifactInRepoUseCase: storeArtifactInRepo,
      });
    },
  };
}
