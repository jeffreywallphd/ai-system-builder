import { describe, expect, it } from "bun:test";
import { DatasetSchemaIntentIds, type DatasetSchemaIntentId } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import type { SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";
import { SystemDatasetInstanceService } from "../SystemDatasetInstanceService";
import { OutputGalleryDatasetIntegrationService } from "../OutputGalleryDatasetIntegrationService";

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public resolveAsset(input: { readonly assetId: string; readonly versionId?: string }) {
    if (input.assetId !== "asset:dataset:outputs") {
      return undefined;
    }
    return Object.freeze({
      assetId: input.assetId,
      versionId: input.versionId ?? "v1",
      schemaIntentId: DatasetSchemaIntentIds.media as DatasetSchemaIntentId,
      outputShapeKind: "image-metadata-records" as const,
    });
  }
}

class AllowAnySystem implements SystemDatasetOwnershipValidator {
  public assertSystemExists(): void {}
}

describe("OutputGalleryDatasetIntegrationService", () => {
  it("returns persisted output gallery items from the system-owned dataset instance", async () => {
    const datasetService = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog(),
      undefined,
      new AllowAnySystem(),
    );
    await datasetService.ensureOutputImageStoreInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
    });

    await datasetService.ingestImageRecordIntoInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
      recordId: "record:1",
      record: {
        assetRef: { kind: "generated-output", outputId: "storage://out-1", stableId: "generated:out-1" },
        width: 1024,
        height: 1024,
        format: "png",
        metadata: { prompt: "cinematic portrait", steps: 30 },
        tags: ["generated", "portrait"],
        derived: { orientation: "square", qualityTier: "high" },
      },
      metadata: { parameterSnapshot: { prompt: "cinematic portrait", guidance: 7.5 } },
    });

    await datasetService.updateImageRecordInInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
      recordId: "record:1",
      patch: {
        generationPatch: {
          workflowAssetId: "asset:workflow:image-to-image",
          workflowAssetVersionId: "v7",
          runId: "run:42",
          role: "primary",
          outputIndex: 0,
          outputGroupId: "group:42",
          outputAssetRef: { kind: "generated-output", outputId: "storage://out-1", stableId: "generated:out-1" },
          sourceImageRef: { kind: "generated-output", outputId: "storage://source-1", stableId: "source:1" },
          metadataPatch: { replace: { parameterSnapshot: { prompt: "cinematic portrait", guidance: 7.5 } } },
          tags: ["generated", "primary"],
        },
      },
    });

    const service = new OutputGalleryDatasetIntegrationService(datasetService);
    const listing = service.listOutputGalleryItems({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      limit: 10,
    });

    expect(listing.kind).toBe("output-gallery-items");
    expect(listing.summary.datasetInstanceId).toBe("instance:outputs");
    expect(listing.summary.datasetAssetId).toBe("asset:dataset:outputs");
    expect(listing.summary.totalItems).toBe(1);

    const item = listing.items[0];
    expect(item?.image.recordId).toBe("record:1");
    expect(item?.dataset.instanceId).toBe("instance:outputs");
    expect(item?.workflow?.workflowRunId).toBe("run:42");
    expect(item?.workflow?.workflowAssetId).toBe("asset:workflow:image-to-image");
    expect(item?.sourceImage?.stableId).toBe("source:1");
    expect(item?.generationParametersSummary.prompt).toBe("cinematic portrait");
    expect(item?.imageMetadataSummary.metadata.prompt).toBe("cinematic portrait");
    expect(item?.tags).toContain("portrait");
    expect(item?.derivedAttributes.orientation).toBe("square");
  });

  it("reads a single gallery item by record id through dataset service contracts", async () => {
    const datasetService = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog(),
      undefined,
      new AllowAnySystem(),
    );
    await datasetService.ensureOutputImageStoreInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
    });

    await datasetService.ingestImageRecordIntoInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
      recordId: "record:single",
      record: {
        assetRef: {
          kind: "generated-output",
          outputId: "storage-instance://storage-instance%3Atest/output/generated.png",
          stableId: "generated-output:storage-instance://storage-instance%3Atest/output/generated.png",
        },
        width: 800,
        height: 600,
        format: "png",
        metadata: { prompt: "single" },
        tags: ["generated"],
      },
      metadata: { parameterSnapshot: { prompt: "single" } },
    });

    const service = new OutputGalleryDatasetIntegrationService(datasetService);
    const item = service.getOutputGalleryItem({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      recordId: "record:single",
    });

    expect(item.image.recordId).toBe("record:single");
    expect(item.dataset.instanceId).toBe("instance:outputs");
    expect(item.image.imageReference?.startsWith("generated-output:storage-instance://")).toBeTrue();
  });
});
