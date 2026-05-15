import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  FinalizeGeneratedOutputAsAssetUseCase,
  ImportExternalRepositoryObjectAsAssetUseCase,
  LocalizeExternalRepositoryObjectAsAssetUseCase,
  RegisterResourceBackedViewAsAssetInstanceUseCase,
} from "../../../application/use-cases";
import { createLocalImageAssetRegistryAdapter } from "../../../adapters/persistence/image";
import { createLocalModelRegistryAdapter } from "../../../adapters/persistence/model";
import { composeInternalAssetRegistry, type InternalAssetRegistryComposition } from "../../shared/composition/composeInternalAssetRegistry";
import { composeResourceBackedViewProviders } from "../../shared/composition/composeResourceBackedViewProviders";

export interface ComposeDesktopAssetFeatureOptions {
  storageRootDirectory: string;
  now: () => string;
  artifacts: any;
  onInternalAssetRegistry?: (registry: InternalAssetRegistryComposition) => void;
}

export function composeDesktopAssetFeature(options: ComposeDesktopAssetFeatureOptions): any {
  const modelRegistry = createLocalModelRegistryAdapter({ filePath: `${options.storageRootDirectory}/model-registry/models.json`, now: options.now });
  const imageAssetRegistry = createLocalImageAssetRegistryAdapter({ filePath: join(options.storageRootDirectory, ".catalog", "image-assets.json"), now: options.now });
  const internalAssetRegistry = composeInternalAssetRegistry({
    rootDirectory: options.storageRootDirectory,
    now: options.now,
    resourceBackedViewProvider: composeResourceBackedViewProviders({
      artifactBrowserMetadataRead: options.artifacts.artifactBrowserRead,
      imageAssetDescriptorRead: imageAssetRegistry,
      modelRegistry,
      publishedModelRegistry: modelRegistry,
    }),
  });
  options.onInternalAssetRegistry?.(internalAssetRegistry);
  const generateInstanceId = () => `asset-instance.${randomUUID()}`;
  const repositories = internalAssetRegistry.assetKernel.repositories;
  return {
    assetRegistryRead: internalAssetRegistry.workspaceReadFacade,
    modelRegistry,
    imageAssetRegistry,
    assetMutationUseCases: {
      registerResourceBackedViewAsAsset: new RegisterResourceBackedViewAsAssetInstanceUseCase({ assetRegistryRead: internalAssetRegistry.readFacade, definitionRepository: repositories.definitionRepository, instanceRepository: repositories.instanceRepository, now: options.now, generateInstanceId }),
      finalizeGeneratedOutputAsAsset: new FinalizeGeneratedOutputAsAssetUseCase({ assetRegistryRead: internalAssetRegistry.readFacade, definitionRepository: repositories.definitionRepository, instanceRepository: repositories.instanceRepository, now: options.now, generateInstanceId }),
      importExternalRepositoryObjectAsAsset: new ImportExternalRepositoryObjectAsAssetUseCase({ assetRegistryRead: internalAssetRegistry.readFacade, definitionRepository: repositories.definitionRepository, instanceRepository: repositories.instanceRepository, now: options.now, generateInstanceId }),
      localizeExternalRepositoryObjectAsAsset: new LocalizeExternalRepositoryObjectAsAssetUseCase({ assetRegistryRead: internalAssetRegistry.readFacade, definitionRepository: repositories.definitionRepository, instanceRepository: repositories.instanceRepository, now: options.now, generateInstanceId }),
    },
  };
}
