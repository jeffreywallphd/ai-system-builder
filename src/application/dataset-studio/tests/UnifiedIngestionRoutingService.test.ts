import { describe, expect, it } from "bun:test";
import {
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
  type UnifiedIngestionDetectionResult,
} from "@domain/dataset-studio/UnifiedIngestionDomain";
import { UnifiedIngestionRoutingService } from "../UnifiedIngestionRoutingService";

function createDetectionResult(kind: UnifiedIngestionDetectionResult["detectedKind"]): UnifiedIngestionDetectionResult {
  return Object.freeze({
    contractVersion: "1.0.0",
    source: Object.freeze({
      sourceId: "source-1",
      referenceKind: UnifiedIngestionReferenceKinds.localPath,
      reference: "C:/tmp/source",
      extension: ".csv",
    }),
    detectedKind: kind,
    confidence: "high",
    normalizedMetadata: Object.freeze({}),
    candidateScores: Object.freeze({
      csv: kind === "csv" ? 90 : 0,
      json: kind === "json" ? 90 : 0,
      document: kind === "document" ? 90 : 0,
      image: kind === "image" ? 90 : 0,
      unknown: kind === "unknown" ? 10 : 0,
    }),
    evidence: Object.freeze([]),
  });
}

describe("UnifiedIngestionRoutingService", () => {
  it("routes detected csv sources to csv ingestor descriptor metadata", () => {
    const service = new UnifiedIngestionRoutingService();
    const route = service.route({
      source: createDetectionResult("csv").source,
      detection: createDetectionResult("csv"),
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(route.status).toBe("resolved");
    if (route.status === "resolved") {
      expect(route.handlerKind).toBe("csv");
      expect(route.assetId).toBe("csv-ingestor");
      expect(route.fallbackUsed).toBeFalse();
      expect(route.reason.includes("mapped")).toBeTrue();
    }
  });

  it("uses deterministic output-target fallback for unknown sources", () => {
    const service = new UnifiedIngestionRoutingService();
    const route = service.route({
      source: createDetectionResult("unknown").source,
      detection: createDetectionResult("unknown"),
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
      }),
    });

    expect(route.status).toBe("resolved");
    if (route.status === "resolved") {
      expect(route.handlerKind).toBe("document");
      expect(route.fallbackUsed).toBeTrue();
      expect(route.policy).toBe("output-target-fallback");
    }
  });

  it("returns structured unsupported result when route mapping is missing", () => {
    const service = new UnifiedIngestionRoutingService(Object.freeze([]));
    const route = service.route({
      source: createDetectionResult("json").source,
      detection: createDetectionResult("json"),
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(route.status).toBe("unsupported");
    if (route.status === "unsupported") {
      expect(route.failureCode).toBe("missing-route-mapping");
      expect(route.reason.includes("No low-level ingestor")).toBeTrue();
    }
  });

  it("supports advanced strategy override without duplicating routing orchestration", () => {
    const service = new UnifiedIngestionRoutingService();
    const route = service.route({
      source: createDetectionResult("unknown").source,
      detection: createDetectionResult("unknown"),
      configuration: Object.freeze({
        mode: "advanced",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
        strategy: "json",
      }),
    });

    expect(route.status).toBe("resolved");
    if (route.status === "resolved") {
      expect(route.handlerKind).toBe("json");
      expect(route.policy).toBe("advanced-strategy");
      expect(route.reason.includes("Advanced strategy")).toBeTrue();
    }
  });
});


