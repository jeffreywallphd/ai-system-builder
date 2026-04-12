import { describe, expect, it } from "bun:test";
import { PreparedStorageStageService } from "../PreparedStorageStageService";

describe("PreparedStorageStageService", () => {
  it("persists prepared dataset outputs and emits lineage with upstream linkage", async () => {
    const service = new PreparedStorageStageService({
      persist: async () => Object.freeze({
        storageReference: "prepared://dataset/prepared.dataset.v1/1.0.1",
        persistedAt: "2026-03-31T12:00:00.000Z",
        contentDigest: "digest-1",
      }),
    });

    const result = await service.persistPreparedDataset({
      preparedDataset: Object.freeze({
        preparedAssetId: "prepared.dataset.v1",
        preparedAssetVersionId: "1.0.1",
        outputShapeKind: "records",
        recordCount: 25,
      }),
      storageTarget: Object.freeze({
        targetId: "prepared://dataset",
      }),
      pipeline: Object.freeze({
        pipelineAssetId: "data-studio.pipeline.v1",
        pipelineVersionId: "1.0.1",
      }),
      upstream: Object.freeze({
        upstreamAssetIds: Object.freeze(["source.dataset.v2"]),
        upstreamPipelineAssetIds: Object.freeze(["pipeline.tabular-cleaning.v1"]),
        upstreamSourceReferences: Object.freeze(["in-memory://records"]),
      }),
      stageLineage: Object.freeze([
        Object.freeze({ stageId: "SourceSelection", order: 1, status: "completed" as const }),
        Object.freeze({ stageId: "UnifiedIngestion", order: 2, status: "completed" as const }),
        Object.freeze({ stageId: "StoragePrepared", order: 3, status: "current" as const }),
      ]),
      preparationContext: Object.freeze({
        authoringMode: "wizard",
        presentationMode: "simple",
        currentStageId: "StoragePrepared",
      }),
      reuse: Object.freeze({
        reusableAsAsset: true,
        reusableLabel: "Prepared Dataset",
      }),
      traceability: Object.freeze({
        lineageId: "lineage-prepared-1",
        executionId: "exec-1",
      }),
      metadata: Object.freeze({
        destinationLabel: "Prepared Dataset",
      }),
    });

    expect(result.output.dataset.preparedAssetId).toBe("prepared.dataset.v1");
    expect(result.output.persistence.storageReference).toContain("prepared://dataset");
    expect(result.stageRecord.lineageId).toBe("lineage-prepared-1");
    expect(result.lineage.execution.pipelineId).toBe("data-studio.pipeline.v1");
    expect(result.lineage.outputs[0]?.assetId).toBe("prepared.dataset.v1");
    expect(result.output.lineage.stageStructure.length).toBe(3);
    expect(result.output.lineage.reuse?.reusableAsAsset).toBeTrue();
  });

  it("rejects requests missing upstream lineage references", async () => {
    const service = new PreparedStorageStageService();
    await expect(
      service.persistPreparedDataset({
        preparedDataset: Object.freeze({
          preparedAssetId: "prepared.dataset.v1",
          preparedAssetVersionId: "1.0.1",
          outputShapeKind: "records",
        }),
        storageTarget: Object.freeze({
          targetId: "prepared://dataset",
        }),
        pipeline: Object.freeze({
          pipelineAssetId: "data-studio.pipeline.v1",
        }),
        upstream: Object.freeze({
          upstreamAssetIds: Object.freeze([]),
          upstreamPipelineAssetIds: Object.freeze([]),
        }),
      }),
    ).rejects.toThrow("requires at least one upstream asset or upstream pipeline reference");
  });
});
