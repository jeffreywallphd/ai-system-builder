import { describe, expect, it } from "bun:test";
import { DatasetSchemaIntentIds, type DatasetSchemaIntentId } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodMediaDatasetValidator } from "../../dataset-studio/adapters/validation/MediaDatasetValidator";
import { InMemoryDatasetOperationalLineageSink } from "../DatasetOperationalLineage";
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

  public resolveAsset(input: { readonly assetId: string; readonly versionId?: string }) {
    return this.entries.find((entry) =>
      entry.assetId === input.assetId.trim()
      && (input.versionId ? entry.versionId === input.versionId.trim() : true)
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

describe("Dataset operational lineage hooks", () => {
  it("records preview, query, read, and write lineage with operational context", async () => {
    const lineage = new InMemoryDatasetOperationalLineageSink();
    const service = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog([{
        assetId: "image-ingestor-v1",
        versionId: "1.0.0",
        schemaIntentId: DatasetSchemaIntentIds.media,
        outputShapeKind: "image-metadata-records",
      }]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
      {},
      lineage,
    );
    const previewService = new DatasetInstancePreviewService(service, lineage);

    const context = Object.freeze({
      workflowAssetId: "asset:workflow:image-pipeline",
      workflowExecutionId: "exec:image-run-1",
      studioId: "studio:image",
      actorId: "user:test",
      source: "dataset-preview-panel",
    });

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:lineage",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "lineage-record-1",
      record: {
        assetRef: { assetId: "asset:image:lineage-1" },
        width: 640,
        height: 480,
        format: "png",
        tags: ["lineage"],
      },
      lineageContext: context,
    });

    service.queryImageRecordsForInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      query: { format: "png" },
      lineageContext: context,
    });

    service.getImageRecordFromInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "lineage-record-1",
      lineageContext: context,
    });

    await service.updateImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "lineage-record-1",
      patch: {
        imagePatch: {
          tagsPatch: {
            add: ["updated"],
          },
        },
      },
      lineageContext: context,
    });

    previewService.listImageRecordPreviews({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      limit: 1,
      offset: 0,
      lineageContext: context,
    });

    await service.deleteImageRecordFromInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "lineage-record-1",
      lineageContext: context,
    });

    const events = lineage.listRecent(20);
    const kinds = events.map((entry) => entry.eventKind);

    expect(kinds).toContain("record-write");
    expect(kinds).toContain("record-query");
    expect(kinds).toContain("record-read");
    expect(kinds).toContain("preview-access");

    const previewEvent = events.find((entry) => entry.eventKind === "preview-access");
    expect(previewEvent?.metadata?.payloadSizeBytes).toBeDefined();
    expect(previewEvent?.metadata?.cacheHit).toBe("false");
    expect(previewEvent?.context?.workflowExecutionId).toBe("exec:image-run-1");

    const writeOps = events
      .filter((entry) => entry.eventKind === "record-write")
      .map((entry) => entry.operation);
    expect(writeOps).toEqual(expect.arrayContaining(["create", "update", "delete"]));
  });
});
