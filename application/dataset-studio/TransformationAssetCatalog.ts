import {
  registerTransformationAssets,
  TransformationAssetRegistry,
  type TransformationAssetRegistryEntry,
} from "./core/data/transformation";

let cachedRegistry: TransformationAssetRegistry | undefined;

export function getTransformationAssetRegistry(): TransformationAssetRegistry {
  if (!cachedRegistry) {
    cachedRegistry = registerTransformationAssets().registry;
  }
  return cachedRegistry;
}

export function listTransformationAssets(): ReadonlyArray<TransformationAssetRegistryEntry> {
  return getTransformationAssetRegistry().list();
}
