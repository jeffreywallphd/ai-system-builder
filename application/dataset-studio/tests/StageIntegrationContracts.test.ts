import { describe, expect, it } from "bun:test";
import {
  createRawStorageStageOutput,
  readRawStorageStageOutput,
  readUnifiedIngestionStageOutput,
  StageExecutionStatusKinds,
  toStageRecordFromRawStorageOutput,
} from "../StageIntegrationContracts";

describe("StageIntegrationContracts", () => {
  it("reads legacy unified-ingestion stage output records for backward compatibility", () => {
    const parsed = readUnifiedIngestionStageOutput(Object.freeze({
      completed: true,
      detectedSourceKind: "json",
      outputTarget: "canonical-records",
      canonicalOutputKind: "records",
      sourceReference: "memory://source-1",
      sourceId: "source-1",
      pipelineId: "dataset-unified-ingestion",
      lineageId: "lineage-1",
    }));

    expect(parsed).toBeDefined();
    expect(parsed?.status).toBe("completed");
    expect(parsed?.detectedSourceKind).toBe("json");
    expect(parsed?.metadata?.pipelineId).toBe("dataset-unified-ingestion");
  });

  it("round-trips raw-storage stage output records with inspectable metadata", () => {
    const output = createRawStorageStageOutput({
      status: StageExecutionStatusKinds.completed,
      source: Object.freeze({
        sourceId: "source-1",
        sourceReference: "C:/data/source.csv",
        referenceKind: "local-path",
      }),
      persistence: Object.freeze({
        storageReference: "raw://dataset/source-1/abc",
        persistedAt: "2026-03-31T10:00:00.000Z",
        byteLength: 128,
        contentDigest: "digest-1",
      }),
      traceability: Object.freeze({
        lineageId: "lineage-1",
        pipelineId: "dataset-unified-ingestion",
        upstreamStageId: "ingestion",
      }),
    });

    const stageRecord = toStageRecordFromRawStorageOutput(output);
    const parsed = readRawStorageStageOutput(stageRecord);

    expect(parsed).toBeDefined();
    expect(parsed?.persistence.storageReference).toBe("raw://dataset/source-1/abc");
    expect(parsed?.traceability.lineageId).toBe("lineage-1");
  });
});
