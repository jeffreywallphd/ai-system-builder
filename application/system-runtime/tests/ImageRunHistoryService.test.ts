import { describe, expect, it } from "bun:test";
import { DatasetSchemaIntentIds, type DatasetSchemaIntentId } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import { OutputGalleryDatasetIntegrationService } from "../OutputGalleryDatasetIntegrationService";
import { ImageRunHistoryExecutionStatuses } from "../ImageRunHistoryDataContract";
import { InMemoryImageRunHistoryRepository } from "../ImageRunHistoryRepository";
import { ImageRunHistoryService } from "../ImageRunHistoryService";
import { SystemDatasetInstanceService, type SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public resolveAsset(input: { readonly assetId: string; readonly versionId?: string }) {
    if (!input.assetId.startsWith("asset:dataset:")) {
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

describe("ImageRunHistoryService", () => {
  it("lists persisted run history entries and resolves linked output gallery items", async () => {
    const datasetService = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog(),
      undefined,
      new AllowAnySystem(),
    );
    await datasetService.ensureOutputImageStoreInstance({
      systemId: "system:image",
      instanceId: "instance:out",
      datasetAssetId: "asset:dataset:out",
      datasetAssetVersionId: "v1",
    });

    await datasetService.ingestImageRecordIntoInstance({
      systemId: "system:image",
      instanceId: "instance:out",
      recordId: "record:1",
      record: {
        assetRef: { kind: "generated-output", outputId: "output:1", stableId: "output:1" },
        width: 512,
        height: 512,
        format: "png",
        metadata: { prompt: "noir portrait" },
      },
    });

    await datasetService.updateImageRecordInInstance({
      systemId: "system:image",
      instanceId: "instance:out",
      recordId: "record:1",
      patch: {
        generationPatch: {
          runId: "run:1",
          role: "primary",
          workflowAssetId: "asset:workflow:image",
          outputAssetRef: { kind: "generated-output", outputId: "output:1", stableId: "output:1" },
          metadataPatch: { replace: { prompt: "noir portrait" } },
          tags: ["primary"],
        },
      },
    });

    const service = new ImageRunHistoryService(
      new InMemoryImageRunHistoryRepository(),
      new OutputGalleryDatasetIntegrationService(datasetService),
      () => new Date("2026-04-02T12:00:00.000Z"),
    );

    const saved = service.recordRun({
      runId: "run:1",
      workflowExecutionId: "exec:1",
      systemId: "system:image",
      workflowAssetId: "asset:workflow:image",
      workflowAssetVersionId: "v1",
      status: ImageRunHistoryExecutionStatuses.completed,
      parameterSummary: { prompt: "noir portrait", guidance: 6.5 },
      outputDatasetInstance: {
        instanceId: "instance:out",
        datasetAssetId: "asset:dataset:out",
        datasetAssetVersionId: "v1",
        role: "output-store",
        persistedRecordIds: ["record:1"],
      },
      outputImages: [{ outputId: "output:1", recordId: "record:1" }],
      timestamps: {
        requestedAt: "2026-04-02T11:59:00.000Z",
        startedAt: "2026-04-02T11:59:10.000Z",
        completedAt: "2026-04-02T11:59:40.000Z",
      },
    });

    expect(saved.runId).toBe("run:1");
    expect(saved.outputs.datasetInstance?.persistedRecordIds).toEqual(["record:1"]);

    const listing = service.listRuns({ systemId: "system:image", limit: 10 });
    expect(listing.summary.totalRuns).toBe(1);
    expect(listing.runs[0]?.inputs.parameterSummary.prompt).toBe("noir portrait");

    const withOutputs = service.getRunWithLinkedOutputs({ systemId: "system:image", runId: "run:1" });
    expect(withOutputs?.linkedOutputs).toHaveLength(1);
    expect(withOutputs?.linkedOutputs[0]?.image.recordId).toBe("record:1");
  });
});
