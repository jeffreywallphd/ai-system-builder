import { describe, expect, it } from "bun:test";
import { getDataStudioAssetRegistry } from "../DataStudioAssetRegistryCatalog";
import {
  createImageManipulationInputImageDatasetAsset,
  ImageManipulationInputDatasetAssetId,
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
});
