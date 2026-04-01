import { describe, expect, it } from "bun:test";
import { DatasetPreviewSelectionModes, DatasetPreviewSelectionState } from "../../data-studio/DatasetPreviewSelectionModel";
import type { ImageDatasetPreviewItem } from "../../data-studio/ImageDatasetPreviewBuilder";
import { DatasetSchemaIntentIds, type DatasetSchemaIntentId } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodMediaDatasetValidator } from "../../dataset-studio/adapters/validation/MediaDatasetValidator";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import { DatasetInstancePreviewService } from "../DatasetInstancePreviewService";
import type { SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";
import { SystemDatasetInstanceService } from "../SystemDatasetInstanceService";
import { StudioDatasetCompatibilityService } from "../StudioDatasetCompatibilityService";

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public constructor(
    private readonly entries: ReadonlyArray<{
      readonly assetId: string;
      readonly versionId?: string;
      readonly schemaIntentId: DatasetSchemaIntentId;
      readonly outputShapeKind: "records" | "image-metadata-records";
    }>,
  ) {}

  public resolveAsset(input: {
    readonly assetId: string;
    readonly versionId?: string;
  }) {
    const assetId = input.assetId.trim();
    const versionId = input.versionId?.trim();
    return this.entries.find((entry) =>
      entry.assetId === assetId
      && (versionId ? entry.versionId === versionId : true)
    );
  }
}

class AllowListSystemValidator implements SystemDatasetOwnershipValidator {
  public constructor(private readonly allowedSystemIds: ReadonlyArray<string>) {}

  public assertSystemExists(systemId: string): void {
    if (!this.allowedSystemIds.includes(systemId)) {
      throw new Error(`invalid-request:System '${systemId}' is not available.`);
    }
  }
}

function item(id: string): ImageDatasetPreviewItem {
  return Object.freeze({
    itemId: id,
    selectionId: id,
    metadataSummary: Object.freeze({}),
    tags: Object.freeze([]),
    annotations: Object.freeze({}),
    derived: Object.freeze({}),
    issues: Object.freeze([]),
  });
}

describe("StudioDatasetCompatibilityService", () => {
  it("keeps shared record references compatible across Data Studio and System runtime preview", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetService = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([{
        assetId: "image-ingestor-v1",
        versionId: "1.0.0",
        schemaIntentId: DatasetSchemaIntentIds.media,
        outputShapeKind: "image-metadata-records",
      }]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );
    const previewService = new DatasetInstancePreviewService(datasetService);
    const compatibility = new StudioDatasetCompatibilityService();

    const instance = await datasetService.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:compatibility",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await datasetService.ingestImageRecordsIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: [{
        recordId: "record-1",
        record: {
          assetRef: { assetId: "asset:image:record-1" },
          width: 1280,
          height: 720,
          format: "png",
        },
      }],
    });

    const runtimePreview = previewService.listImageRecordPreviews({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
    });
    const runtimeRefs = compatibility.toRecordReferencesFromPreview(runtimePreview);
    expect(runtimeRefs[0]?.dataset.assetId).toBe("image-ingestor-v1");
    expect(runtimeRefs[0]?.instance?.instanceId).toBe(instance.instanceId);

    const dataSelectionState = new DatasetPreviewSelectionState("image-ingestor-v1", DatasetPreviewSelectionModes.multi);
    const snapshot = dataSelectionState.toggle(item("record-1"));

    compatibility.assertSelectionCompatibility({
      selection: snapshot,
      datasetAssetId: instance.datasetAssetId,
    });

    const selectedRecords = await compatibility.resolveSelectionRecords({
      datasetService,
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      selection: snapshot,
    });
    expect(selectedRecords).toHaveLength(1);
    expect(selectedRecords[0]?.recordId).toBe("record-1");
  });

  it("rejects cross-dataset selection references during handoff", () => {
    const compatibility = new StudioDatasetCompatibilityService();
    const selection = new DatasetPreviewSelectionState("asset:data-a", DatasetPreviewSelectionModes.multi)
      .toggle(item("record-a"));

    expect(() => compatibility.assertSelectionCompatibility({
      selection,
      datasetAssetId: "asset:data-b",
    })).toThrow("does not match required dataset asset");
  });
});
