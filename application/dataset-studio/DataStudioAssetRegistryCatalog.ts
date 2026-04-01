import {
  DataAssetDiscoverabilityScopes,
  DataAssetRegistrySpecializations,
  type DataAssetRegistry,
  type DataAssetRegistryEntry,
} from "./DataAssetRegistry";
import { registerDataStudioSampleAssets } from "./DataStudioSampleAssets";

let cachedRegistry: DataAssetRegistry | undefined;

export function getDataStudioAssetRegistry(): DataAssetRegistry {
  if (!cachedRegistry) {
    cachedRegistry = registerDataStudioSampleAssets().registry;
  }
  return cachedRegistry;
}

export const IngestionCatalogVisibilityModes = Object.freeze({
  default: "default",
  advanced: "advanced",
} as const);

export type IngestionCatalogVisibilityMode =
  typeof IngestionCatalogVisibilityModes[keyof typeof IngestionCatalogVisibilityModes];

export interface ListIngestionDataAssetsRequest {
  readonly visibility?: IngestionCatalogVisibilityMode;
}

export function listIngestionDataAssets(request: ListIngestionDataAssetsRequest = {}): ReadonlyArray<DataAssetRegistryEntry> {
  const allEntries = getDataStudioAssetRegistry().list({
    specialization: DataAssetRegistrySpecializations.ingestion,
    category: "data-ingestion",
    executable: true,
  });
  const visibility = request.visibility ?? IngestionCatalogVisibilityModes.default;
  if (visibility === IngestionCatalogVisibilityModes.advanced) {
    return Object.freeze(allEntries.filter((entry) => entry.descriptor.discoverability.inspectable));
  }
  const defaultEntries = allEntries.filter((entry) => entry.descriptor.discoverability.defaultEntryPoint);
  if (defaultEntries.length > 0) {
    return Object.freeze(defaultEntries);
  }
  return Object.freeze(allEntries.filter((entry) =>
    entry.descriptor.discoverability.scope === DataAssetDiscoverabilityScopes.default
      && entry.descriptor.discoverability.inspectable
  ));
}
