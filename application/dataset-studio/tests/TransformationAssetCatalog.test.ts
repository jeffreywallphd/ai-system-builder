import { describe, expect, it } from "bun:test";
import { listTransformationAssets } from "../TransformationAssetCatalog";
import {
  DataClassificationAsset,
  DataProfilingAsset,
  DataValidationAsset,
  DeduplicationAsset,
  FieldMappingAsset,
  FilteringAsset,
  MissingValueHandlingAsset,
  SchemaInferenceAsset,
  TypeNormalizationAsset,
} from "../core/data/transformation";

describe("TransformationAssetCatalog", () => {
  it("exposes registered transformation assets through a cached registry seam", () => {
    const assets = listTransformationAssets();
    expect(assets.length).toBeGreaterThanOrEqual(5);
    expect(assets.some((entry) => entry.descriptor.id === SchemaInferenceAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === DataProfilingAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === DataClassificationAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === TypeNormalizationAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === MissingValueHandlingAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === DeduplicationAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === FilteringAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === DataValidationAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === FieldMappingAsset.assetId)).toBeTrue();
  });
});
