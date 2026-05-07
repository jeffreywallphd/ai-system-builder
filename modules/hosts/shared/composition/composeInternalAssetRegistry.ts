import { AssetRegistryReadFacade } from "../../../application/services/asset/asset-registry-read-facade.service";
import type { AssetResourceBackedViewProvider } from "../../../application/services/asset/asset-registry-read-facade.types";
import { BUILT_IN_ASSET_DEFINITION_CATALOG } from "../../../application/services/asset/built-ins";
import { composeLocalAssetKernel, type LocalAssetKernelComposition } from "./composeLocalAssetKernel";

export interface ComposeInternalAssetRegistryOptions {
  readonly rootDirectory: string;
  readonly now?: () => string;
  readonly resourceBackedViewProvider?: AssetResourceBackedViewProvider;
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
    readonly builtInCatalogDefinitionCount: number;
  };
}

export function composeInternalAssetRegistry(options: ComposeInternalAssetRegistryOptions): InternalAssetRegistryComposition {
  const assetKernel = composeLocalAssetKernel({ rootDirectory: options.rootDirectory, now: options.now });
  const readFacade = new AssetRegistryReadFacade({
    definitionRepository: assetKernel.repositories.definitionRepository,
    instanceRepository: assetKernel.repositories.instanceRepository,
    compositionRepository: assetKernel.repositories.compositionRepository,
    bindingRepository: assetKernel.repositories.bindingRepository,
    resourceBackedViewProvider: options.resourceBackedViewProvider,
  });

  return {
    assetKernel,
    readFacade,
    ...(options.resourceBackedViewProvider ? { resourceBackedViewProvider: options.resourceBackedViewProvider } : {}),
    diagnostics: {
      storeKind: assetKernel.diagnostics.storeKind,
      schemaVersion: assetKernel.diagnostics.schemaVersion,
      registryFacadeComposed: true,
      resourceBackedViewsEnabled: Boolean(options.resourceBackedViewProvider),
      builtInCatalogDefinitionCount: BUILT_IN_ASSET_DEFINITION_CATALOG.length,
    },
  };
}
