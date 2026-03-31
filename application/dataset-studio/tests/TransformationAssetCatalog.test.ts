import { describe, expect, it } from "bun:test";
import { listTransformationAssets } from "../TransformationAssetCatalog";
import { SchemaInferenceAsset } from "../core/data/transformation";

describe("TransformationAssetCatalog", () => {
  it("exposes registered transformation assets through a cached registry seam", () => {
    const assets = listTransformationAssets();
    expect(assets.length).toBeGreaterThanOrEqual(1);
    expect(assets.some((entry) => entry.descriptor.id === SchemaInferenceAsset.assetId)).toBeTrue();
  });
});
