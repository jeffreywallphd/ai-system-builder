import {
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

export function listIngestionDataAssets(): ReadonlyArray<DataAssetRegistryEntry> {
  return getDataStudioAssetRegistry().list({
    specialization: DataAssetRegistrySpecializations.ingestion,
    category: "data-ingestion",
    executable: true,
  });
}
