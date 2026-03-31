import { describe, expect, it } from "bun:test";
import { listTransformationAssets } from "../TransformationAssetCatalog";
import {
  DataProfilingAsset,
  FieldMappingAsset,
  SchemaInferenceAsset,
} from "../core/data/transformation";

describe("TransformationAssetCatalog", () => {
  it("exposes registered transformation assets through a cached registry seam", () => {
    const assets = listTransformationAssets();
    expect(assets.length).toBeGreaterThanOrEqual(3);
    expect(assets.some((entry) => entry.descriptor.id === SchemaInferenceAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === DataProfilingAsset.assetId)).toBeTrue();
    expect(assets.some((entry) => entry.descriptor.id === FieldMappingAsset.assetId)).toBeTrue();
  });
});
