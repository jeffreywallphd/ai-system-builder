import { describe, expect, it } from "bun:test";
import { DatasetPipelineStageKinds } from "@domain/dataset-studio/StagePipelineDomain";
import { RawStorageStageService } from "../RawStorageStageService";

describe("RawStorageStageService", () => {
  it("persists raw-storage metadata through the stage adapter seam", async () => {
    const service = new RawStorageStageService({
      persist: async () => Object.freeze({
        storageReference: "raw://dataset-studio/source-1/abc",
        persistedAt: "2026-03-31T11:00:00.000Z",
        byteLength: 12,
        contentDigest: "digest-1",
      }),
    });

    const result = await service.persist({
      source: Object.freeze({
        sourceId: "source-1",
        sourceReference: "C:/tmp/source.json",
        referenceKind: "local-path",
        sourceAssetId: "asset-source",
        sourceVersionId: "v1",
      }),
      rawPayload: "{\"id\":1}",
      contentType: "application/json",
      traceability: Object.freeze({
        lineageId: "lineage-1",
        pipelineId: "dataset-unified-ingestion",
        upstreamStageId: "ingestion",
        executionId: "exec-1",
        runId: "run-1",
      }),
      metadata: Object.freeze({ persistRawPayload: true }),
    });

    expect(result.output.stageKind).toBe(DatasetPipelineStageKinds.rawStorage);
    expect(result.output.persistence.storageReference).toBe("raw://dataset-studio/source-1/abc");
    expect(result.stageRecord.storageReference).toBe("raw://dataset-studio/source-1/abc");
    expect(result.output.traceability.lineageId).toBe("lineage-1");
    expect(result.lineage.producer.assetId).toBe("raw-storage-stage");
    expect(result.log.status).toBe("succeeded");
  });
});

