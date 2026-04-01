import { describe, expect, it } from "bun:test";
import {
  UnifiedIngestionLineageStageKinds,
  UnifiedIngestionLineageStageStatuses,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
  createUnifiedIngestionInputCollection,
  getUnifiedIngestionOutputTargets,
  normalizeUnifiedIngestionSourceReference,
} from "../UnifiedIngestionDomain";

describe("UnifiedIngestionDomain contracts", () => {
  it("normalizes source references for deterministic contract-level handling", () => {
    const normalized = normalizeUnifiedIngestionSourceReference({
      sourceId: " source-1 ",
      referenceKind: UnifiedIngestionReferenceKinds.localPath,
      reference: "  C:\\tmp\\users.json  ",
      extension: "JSON",
      mimeType: " Application/JSON ",
      displayName: " users.json ",
    });

    expect(normalized.sourceId).toBe("source-1");
    expect(normalized.reference).toBe("C:\\tmp\\users.json");
    expect(normalized.extension).toBe(".json");
    expect(normalized.mimeType).toBe("application/json");
    expect(normalized.displayName).toBe("users.json");
  });

  it("supports versioned source input collection contracts for one or more sources", () => {
    const collection = createUnifiedIngestionInputCollection({
      sources: Object.freeze([
        {
          sourceId: "single",
          referenceKind: UnifiedIngestionReferenceKinds.localPath,
          reference: "C:\\tmp\\users.csv",
        },
        {
          sourceId: "future-batch",
          referenceKind: UnifiedIngestionReferenceKinds.fileHandle,
          reference: "handle:123",
          extension: ".csv",
        },
      ]),
    });

    expect(collection.contractVersion).toBe("1.0.0");
    expect(collection.sources).toHaveLength(2);
    expect(collection.sources[1]?.referenceKind).toBe("file-handle");
  });

  it("maps unified output targets to canonical shape kinds", () => {
    const targets = getUnifiedIngestionOutputTargets();
    const byTarget = Object.fromEntries(targets.map((target) => [target.target, target.canonicalShapeKind]));

    expect(byTarget[UnifiedIngestionOutputTargetKinds.records]).toBe("records");
    expect(byTarget[UnifiedIngestionOutputTargetKinds.textItems]).toBe("text-items");
    expect(byTarget[UnifiedIngestionOutputTargetKinds.imageMetadataRecords]).toBe("image-metadata-records");
  });

  it("rejects empty source collections", () => {
    expect(() => createUnifiedIngestionInputCollection({ sources: Object.freeze([]) })).toThrow(
      "at least one source",
    );
  });

  it("keeps lineage stage contracts stable and serializable", () => {
    const lineageStage = Object.freeze({
      stage: UnifiedIngestionLineageStageKinds.detection,
      status: UnifiedIngestionLineageStageStatuses.succeeded,
      startedAt: "2026-03-31T10:00:00.000Z",
      completedAt: "2026-03-31T10:00:00.500Z",
      details: Object.freeze({ detectedKind: "json", confidence: "high" }),
    });

    const serialized = JSON.stringify(lineageStage);
    expect(serialized).toContain("\"stage\":\"detection\"");
    expect(serialized).toContain("\"status\":\"succeeded\"");
  });
});
