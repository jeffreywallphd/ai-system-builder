import { describe, expect, it } from "bun:test";
import { createCanonicalRecordsShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
  type UnifiedIngestionNormalizedOutput,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import { UnifiedIngestionPreviewService } from "../UnifiedIngestionPreviewService";

function createSource() {
  return Object.freeze({
    sourceId: "source-1",
    referenceKind: UnifiedIngestionReferenceKinds.inMemory,
    reference: "in-memory://source",
  });
}

function createNormalizedOutput(records: number): UnifiedIngestionNormalizedOutput {
  return Object.freeze({
    contractVersion: UnifiedIngestionContractVersion,
    normalizationVersion: "1.0.0",
    canonicalOutputKind: "records",
    normalizedPayload: createCanonicalRecordsShape({
      records: Object.freeze(Array.from({ length: records }).map((_, index) => Object.freeze({
        recordId: `r-${index + 1}`,
        fields: Object.freeze({ id: index + 1 }),
      }))),
    }),
    metadata: Object.freeze({
      outputTarget: UnifiedIngestionOutputTargetKinds.records,
      configurationMode: "simple" as const,
      sourceId: "source-1",
      sourceReference: "in-memory://source",
      totalCount: records,
      isEmpty: records === 0,
    }),
    detectionSummary: Object.freeze({
      detectedKind: "json" as const,
      confidence: "high" as const,
      evidenceCount: 2,
    }),
    routeSummary: Object.freeze({
      handlerKind: "json" as const,
      assetId: "json-ingestor",
      policy: "detected-kind" as const,
      fallbackUsed: false,
    }),
    warnings: Object.freeze([]),
  });
}

describe("UnifiedIngestionPreviewService", () => {
  it("generates preview contracts from normalized unified ingestion output", () => {
    const service = new UnifiedIngestionPreviewService();
    const result = service.generate({
      source: createSource(),
      normalized: createNormalizedOutput(2),
      sampleLimit: 1,
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.summary.totalCount).toBe(2);
      expect(result.summary.sampleCount).toBe(1);
      expect(result.samples).toHaveLength(1);
      expect(result.routeSummary.assetId).toBe("json-ingestor");
    }
  });

  it("handles empty normalized datasets gracefully", () => {
    const service = new UnifiedIngestionPreviewService();
    const result = service.generate({
      source: createSource(),
      normalized: createNormalizedOutput(0),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.summary.isEmpty).toBeTrue();
      expect(result.summary.totalCount).toBe(0);
    }
  });

  it("returns degraded preview payload when preview generation fails", () => {
    const service = new UnifiedIngestionPreviewService({
      previewEngine: {
        buildFromCanonicalShape: () => {
          throw new Error("preview crashed");
        },
      } as never,
    });
    const result = service.generate({
      source: createSource(),
      normalized: createNormalizedOutput(1),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.degraded).toBeTrue();
      expect(result.preview.kind).toBe("error");
      expect(result.issues.some((issue) => issue.code === "preview-generation-failed")).toBeTrue();
    }
  });
});

