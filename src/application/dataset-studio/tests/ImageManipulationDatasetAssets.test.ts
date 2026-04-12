import { describe, expect, it } from "bun:test";
import { getDataStudioAssetRegistry } from "../DataStudioAssetRegistryCatalog";
import {
  createImageManipulationFaceIdReferenceDatasetAsset,
  createImageManipulationInputImageDatasetAsset,
  createImageManipulationOutputImageDatasetAsset,
  ImageManipulationFaceIdReferenceDatasetAssetId,
  ImageManipulationInputDatasetAssetId,
  ImageManipulationOutputDatasetAssetId,
} from "../ImageManipulationDatasetAssets";

describe("ImageManipulationDatasetAssets", () => {
  it("defines a runtime-operational input image dataset asset with media schema intent", () => {
    const asset = createImageManipulationInputImageDatasetAsset();
    const inspection = asset.inspect();

    expect(inspection.metadata.identity.assetId).toBe(ImageManipulationInputDatasetAssetId);
    expect(inspection.outputShapeKind).toBe("image-metadata-records");
    expect(inspection.metadata.runtime.usability).toBe("runtime-operational");
    expect(inspection.metadata.runtime.instanceOwnership.owner).toBe("system");
    expect(inspection.metadata.runtime.mutability.writeBehavior).toBe("workflow-and-system");
    expect(inspection.metadata.runtime.accessPatterns).toContain("upsert-write");
  });

  it("registers the image manipulation input dataset into the shared data asset registry", () => {
    const entry = getDataStudioAssetRegistry().get({ assetId: ImageManipulationInputDatasetAssetId });

    expect(entry).toBeDefined();
    expect(entry?.descriptor.specialization).toBe("dataset");
    expect(entry?.descriptor.schemaIntent.id).toBe("media");
    expect(entry?.descriptor.discoverability.inspectable).toBeTrue();
    expect(entry?.descriptor.inspectability.previewModes).toContain("image-metadata-summary");
  });

  it("defines an output dataset asset for generated image results with runtime-managed write behavior", () => {
    const asset = createImageManipulationOutputImageDatasetAsset();
    const inspection = asset.inspect();

    expect(inspection.metadata.identity.assetId).toBe(ImageManipulationOutputDatasetAssetId);
    expect(inspection.metadata.runtime.mutability.writeBehavior).toBe("system-only");
    expect(inspection.metadata.runtime.accessPatterns).toContain("append-write");
    expect(inspection.metadata.runtime.accessPatterns).toContain("point-lookup");
    expect(inspection.metadata.runtime.usability).toBe("runtime-operational");
  });

  it("defines an optional FaceID reference dataset asset and registers it for discovery", () => {
    const asset = createImageManipulationFaceIdReferenceDatasetAsset();
    const inspection = asset.inspect();

    expect(inspection.metadata.identity.assetId).toBe(ImageManipulationFaceIdReferenceDatasetAssetId);
    expect(inspection.metadata.runtime.mutability.writeBehavior).toBe("workflow-and-system");
    expect(inspection.metadata.display.tags).toContain("faceid");
    expect(inspection.outputShapeKind).toBe("image-metadata-records");

    const entry = getDataStudioAssetRegistry().get({ assetId: ImageManipulationFaceIdReferenceDatasetAssetId });
    expect(entry).toBeDefined();
    expect(entry?.descriptor.schemaIntent.id).toBe("media");
    expect(entry?.descriptor.display.tags).toContain("optional");
  });
});
