import { describe, expect, it } from "bun:test";
import { DatasetSchemaIntentIds, type DatasetSchemaIntentId } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodMediaDatasetValidator } from "../../dataset-studio/adapters/validation/MediaDatasetValidator";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import { DatasetInstancePreviewService } from "../DatasetInstancePreviewService";
import type { SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";
import { SystemDatasetInstanceService } from "../SystemDatasetInstanceService";

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

function createServices(): {
  readonly datasetService: SystemDatasetInstanceService;
  readonly previewService: DatasetInstancePreviewService;
} {
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
    new AllowListSystemValidator(["system:image-pipeline", "system:other"]),
  );

  return Object.freeze({
    datasetService,
    previewService: new DatasetInstancePreviewService(datasetService),
  });
}

describe("DatasetInstancePreviewService", () => {
  it("lists lightweight image previews for a system-owned dataset instance", async () => {
    const { previewService, datasetService } = createServices();

    const instance = await datasetService.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:preview-input",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await datasetService.ingestImageRecordsIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: Object.freeze([
        {
          recordId: "preview-record-1",
          record: {
            assetRef: {
              kind: "generated-output",
              stableId: "generated-output:prepared://preview-1",
              outputId: "prepared://preview-1",
            },
            width: 1920,
            height: 1080,
            format: "png",
            metadata: {
              source: "camera-a",
              cameraModel: "x100",
              exposure: "1/125",
            },
            tags: ["hero", "homepage"],
            annotations: {
              caption: "Homepage hero",
            },
            derived: {
              orientation: "landscape",
            },
          },
          storageReference: "prepared://preview-1",
        },
        {
          recordId: "preview-record-2",
          record: {
            assetRef: {
              kind: "generated-output",
              stableId: "generated-output:prepared://preview-2",
              outputId: "prepared://preview-2",
            },
            width: 512,
            height: 512,
            format: "jpeg",
            metadata: {
              source: "camera-b",
            },
            tags: ["thumbnail"],
          },
        },
      ]),
    });

    const preview = previewService.listImageRecordPreviews({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      limit: 1,
    });

    expect(preview.kind).toBe("image-records");
    expect(preview.summary.totalRecords).toBe(2);
    expect(preview.summary.returnedRecords).toBe(1);
    expect(preview.summary.truncated).toBeTrue();
    expect(preview.items[0]?.previewReference).toBe("prepared://preview-1");
    expect(preview.items[0]?.width).toBe(1920);
    expect(preview.items[0]?.height).toBe(1080);
    expect(preview.items[0]?.format).toBe("png");
    expect(preview.items[0]?.metadataSummary.source).toBe("camera-a");
    expect(preview.items[0]?.hasAnnotations).toBeTrue();
    expect(preview.items[0]?.hasDerived).toBeTrue();
  });

  it("applies query filters to preview listings while preserving ownership boundaries", async () => {
    const { previewService, datasetService } = createServices();

    const instance = await datasetService.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:preview-query",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await datasetService.ingestImageRecordsIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: Object.freeze([
        {
          recordId: "preview-query-1",
          record: {
            assetRef: { assetId: "asset:image:preview-query-1" },
            width: 1024,
            height: 768,
            format: "png",
            metadata: { source: "camera-a" },
            tags: ["hero"],
          },
        },
        {
          recordId: "preview-query-2",
          record: {
            assetRef: { assetId: "asset:image:preview-query-2" },
            width: 640,
            height: 640,
            format: "jpeg",
            metadata: { source: "camera-b" },
            tags: ["thumb"],
          },
        },
      ]),
    });

    const preview = previewService.listImageRecordPreviews({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      query: {
        format: "png",
        tag: "hero",
      },
    });

    expect(preview.summary.totalRecords).toBe(1);
    expect(preview.items[0]?.recordId).toBe("preview-query-1");
  });

  it("rejects cross-system preview access attempts", async () => {
    const { previewService, datasetService } = createServices();

    const instance = await datasetService.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:preview-owned",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await datasetService.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "preview-owned-record",
      record: {
        assetRef: { assetId: "asset:image:preview-owned-record" },
        width: 512,
        height: 512,
        format: "png",
      },
    });

    expect(() => previewService.listImageRecordPreviews({
      systemId: "system:other",
      instanceId: instance.instanceId,
    })).toThrow("is owned by system 'system:image-pipeline'");
  });
});
