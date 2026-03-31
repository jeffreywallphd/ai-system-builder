import { DataProfilingAsset } from "./assets/DataProfilingAsset";
import { FieldMappingAsset } from "./assets/FieldMappingAsset";
import { MissingValueHandlingAsset } from "./assets/MissingValueHandlingAsset";
import { SchemaInferenceAsset } from "./assets/SchemaInferenceAsset";
import { TypeNormalizationAsset } from "./assets/TypeNormalizationAsset";
import {
  TransformationAssetRegistry,
  type TransformationAssetRegistryEntry,
} from "./TransformationAssetRegistry";

export interface TransformationAssetSet {
  readonly registry: TransformationAssetRegistry;
  readonly entries: ReadonlyArray<TransformationAssetRegistryEntry>;
}

export function registerTransformationAssets(
  registry: TransformationAssetRegistry = new TransformationAssetRegistry(),
): TransformationAssetSet {
  const schemaInferenceEntry = registry.register(new SchemaInferenceAsset());
  const dataProfilingEntry = registry.register(new DataProfilingAsset());
  const typeNormalizationEntry = registry.register(new TypeNormalizationAsset());
  const missingValueHandlingEntry = registry.register(new MissingValueHandlingAsset());
  const fieldMappingEntry = registry.register(new FieldMappingAsset());
  return Object.freeze({
    registry,
    entries: Object.freeze([
      schemaInferenceEntry,
      dataProfilingEntry,
      typeNormalizationEntry,
      missingValueHandlingEntry,
      fieldMappingEntry,
    ]),
  });
}
