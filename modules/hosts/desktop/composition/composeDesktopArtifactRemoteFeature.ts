import type { LoggingPort } from "../../../application/ports/logging";
import { SystemArtifactIdFactory } from "../../../domain/artifact";
import {
  BrowseHuggingFaceDatasetParquetFilesUseCase,
  BrowseHuggingFaceNamespaceDatasetsUseCase,
  LocalizeArtifactFromRepoUseCase,
  PublishArtifactToRepoUseCase,
  RegisterArtifactFromRepoUseCase,
  VerifyImportedArtifactSourceBackingUseCase,
  VerifyPublishedArtifactBackingUseCase,
} from "../../../application/use-cases";
import { createArtifactRepoStorageAdapter } from "../../../adapters/storage/artifact-repo";
import { createHuggingFaceArtifactRepoStorageAdapter, type HuggingFaceFetchImplementation } from "../../../adapters/storage/huggingface";

export interface ComposeDesktopArtifactRemoteFeatureOptions {
  artifacts: any;
  loggingPort: LoggingPort;
  now?: () => string;
  tokenProvider: () => string | undefined;
  huggingFaceFetchImplementation?: HuggingFaceFetchImplementation;
}

export function composeDesktopArtifactRemoteFeature(options: ComposeDesktopArtifactRemoteFeatureOptions): any {
  const huggingFaceArtifactRepoStorage = createHuggingFaceArtifactRepoStorageAdapter({
    accessTokenProvider: options.tokenProvider,
    fetchImplementation: options.huggingFaceFetchImplementation,
  });
  const artifactRepoStorage = createArtifactRepoStorageAdapter({ providers: [{ provider: "huggingface", adapter: huggingFaceArtifactRepoStorage }] });
  const foundation = options.artifacts;
  return {
    huggingFaceArtifactRepoStorage,
    artifactRepoStorage,
    publishArtifactToRepoUseCase: new PublishArtifactToRepoUseCase({ artifactStorage: foundation.storage, artifactRepoStorage, artifactBindingStorage: foundation.artifactBindings, now: options.now }),
    browseHuggingFaceNamespaceDatasetsUseCase: new BrowseHuggingFaceNamespaceDatasetsUseCase({ repoBrowser: huggingFaceArtifactRepoStorage, logging: options.loggingPort, now: options.now }),
    browseHuggingFaceDatasetParquetFilesUseCase: new BrowseHuggingFaceDatasetParquetFilesUseCase({ repoBrowser: huggingFaceArtifactRepoStorage, logging: options.loggingPort, now: options.now }),
    verifyPublishedArtifactBackingUseCase: new VerifyPublishedArtifactBackingUseCase({ artifactRepoStorage, artifactBindingStorage: foundation.artifactBindings, now: options.now }),
    verifyImportedArtifactSourceBackingUseCase: new VerifyImportedArtifactSourceBackingUseCase({ artifactRepoStorage, artifactBindingStorage: foundation.artifactBindings, now: options.now }),
    registerArtifactFromRepoUseCase: new RegisterArtifactFromRepoUseCase({ artifactRepoStorage, artifactBindingStorage: foundation.artifactBindings, artifactCatalogAppend: foundation.artifactCatalog, logging: options.loggingPort, now: options.now, artifactIdFactory: new SystemArtifactIdFactory() }),
    localizeArtifactFromRepoUseCase: new LocalizeArtifactFromRepoUseCase({ artifactRepoStorage, artifactBindingStorage: foundation.artifactBindings, artifactStorage: foundation.storage, now: options.now }),
  };
}
