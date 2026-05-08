import { AssetRegistryReadFacade } from "../../../application/services/asset/asset-registry-read-facade.service";
import { createAssetResourceBackedViewAggregateProvider } from "../../../application/services/asset/asset-resource-backed-view-aggregate-provider.service";
import type { AssetResourceBackedViewProvider } from "../../../application/ports/asset";
import { composeLocalAssetKernel, type LocalAssetKernelComposition } from "./composeLocalAssetKernel";

export interface ComposeInternalAssetRegistryOptions {
  readonly rootDirectory: string;
  readonly now?: () => string;
  readonly resourceBackedViewProvider?: AssetResourceBackedViewProvider;
  readonly resourceBackedViewProviders?: readonly AssetResourceBackedViewProvider[];
}

export interface InternalAssetRegistryComposition {
  readonly assetKernel: LocalAssetKernelComposition;
  readonly readFacade: AssetRegistryReadFacade;
  readonly resourceBackedViewProvider?: AssetResourceBackedViewProvider;
  readonly diagnostics: {
    readonly storeKind: LocalAssetKernelComposition["diagnostics"]["storeKind"];
    readonly schemaVersion: LocalAssetKernelComposition["diagnostics"]["schemaVersion"];
    readonly registryFacadeComposed: true;
    readonly resourceBackedViewsEnabled: boolean;
  };
}

export function composeInternalAssetRegistry(options: ComposeInternalAssetRegistryOptions): InternalAssetRegistryComposition {
  const assetKernel = composeLocalAssetKernel({ rootDirectory: options.rootDirectory, now: options.now });
  const resourceBackedViewProvider = composeResourceBackedViewProvider(options);
  const readFacade = new AssetRegistryReadFacade({
    definitionRepository: assetKernel.repositories.definitionRepository,
    instanceRepository: assetKernel.repositories.instanceRepository,
    compositionRepository: assetKernel.repositories.compositionRepository,
    bindingRepository: assetKernel.repositories.bindingRepository,
    resourceBackedViewProvider,
  });

  return {
    assetKernel,
    readFacade,
    ...(resourceBackedViewProvider ? { resourceBackedViewProvider } : {}),
    diagnostics: {
      storeKind: assetKernel.diagnostics.storeKind,
      schemaVersion: assetKernel.diagnostics.schemaVersion,
      registryFacadeComposed: true,
      resourceBackedViewsEnabled: Boolean(resourceBackedViewProvider),
    },
  };
}

function composeResourceBackedViewProvider(options: ComposeInternalAssetRegistryOptions): AssetResourceBackedViewProvider | undefined {
  if (options.resourceBackedViewProviders?.length) {
    return createAssetResourceBackedViewAggregateProvider(options.resourceBackedViewProviders);
  }
  return options.resourceBackedViewProvider;
}
