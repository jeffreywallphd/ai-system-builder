import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTextItemsShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import { UnifiedIngestionNormalizationPipeline } from "../UnifiedIngestionNormalizationPipeline";

function createSource() {
  return Object.freeze({
    sourceId: "source-1",
    referenceKind: UnifiedIngestionReferenceKinds.inMemory,
    reference: "in-memory://source-1",
  });
}

function createDetection(kind: "csv" | "json" | "document" | "image") {
  return Object.freeze({
    contractVersion: UnifiedIngestionContractVersion,
    source: createSource(),
    detectedKind: kind,
    confidence: "high" as const,
    normalizedMetadata: Object.freeze({}),
    candidateScores: Object.freeze({
      csv: kind === "csv" ? 100 : 0,
      json: kind === "json" ? 100 : 0,
      document: kind === "document" ? 100 : 0,
      image: kind === "image" ? 100 : 0,
      unknown: 0,
    }),
    evidence: Object.freeze([Object.freeze({
      kind: "content-sniff" as const,
      message: "detected",
      candidateKind: kind,
      weight: 50,
    })]),
  });
}

function createRoute(handler: "csv" | "json" | "document" | "image") {
  return Object.freeze({
    status: "resolved" as const,
    sourceKind: handler,
    handlerKind: handler,
    assetId: `${handler}-ingestor`,
    assetVersion: "1.0.0",
    policy: "detected-kind" as const,
    fallbackUsed: false,
    reason: "route",
  });
}

describe("UnifiedIngestionNormalizationPipeline", () => {
  it("normalizes records output into a versioned unified envelope", () => {
    const pipeline = new UnifiedIngestionNormalizationPipeline();
    const result = pipeline.normalize({
      source: createSource(),
      detection: createDetection("csv"),
      route: createRoute("csv"),
      outputTarget: UnifiedIngestionOutputTargetKinds.records,
      configurationMode: "simple",
      output: createCanonicalRecordsShape({
        records: Object.freeze([
          Object.freeze({ recordId: "r-1", fields: Object.freeze({ id: "1" }) }),
        ]),
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.normalized.canonicalOutputKind).toBe("records");
      expect(result.normalized.normalizationVersion).toBe("1.0.0");
      expect(result.normalized.metadata.totalCount).toBe(1);
      expect(result.normalized.metadata.isEmpty).toBeFalse();
    }
  });

  it("normalizes text-item and image outputs with consistent metadata summaries", () => {
    const pipeline = new UnifiedIngestionNormalizationPipeline();
    const textResult = pipeline.normalize({
      source: createSource(),
      detection: createDetection("document"),
      route: createRoute("document"),
      outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
      configurationMode: "advanced",
      output: createCanonicalTextItemsShape({
        items: Object.freeze([Object.freeze({ itemId: "t-1", text: "hello" })]),
      }),
    });
    const imageResult = pipeline.normalize({
      source: createSource(),
      detection: createDetection("image"),
      route: createRoute("image"),
      outputTarget: UnifiedIngestionOutputTargetKinds.imageMetadataRecords,
      configurationMode: "simple",
      output: createCanonicalImageMetadataRecordsShape({
        items: Object.freeze([Object.freeze({ itemId: "i-1", imageId: "img-1" })]),
      }),
    });

    expect(textResult.ok).toBeTrue();
    expect(imageResult.ok).toBeTrue();
    if (textResult.ok && imageResult.ok) {
      expect(textResult.normalized.canonicalOutputKind).toBe("text-items");
      expect(imageResult.normalized.canonicalOutputKind).toBe("image-metadata-records");
      expect(textResult.normalized.metadata.configurationMode).toBe("advanced");
    }
  });

  it("fails normalization when output kind does not match requested output target", () => {
    const pipeline = new UnifiedIngestionNormalizationPipeline();
    const result = pipeline.normalize({
      source: createSource(),
      detection: createDetection("csv"),
      route: createRoute("csv"),
      outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
      configurationMode: "simple",
      output: createCanonicalRecordsShape({ records: Object.freeze([]) }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("normalization-failed");
    }
  });

  it("emits structured warnings for empty normalized outputs", () => {
    const pipeline = new UnifiedIngestionNormalizationPipeline();
    const result = pipeline.normalize({
      source: createSource(),
      detection: createDetection("json"),
      route: createRoute("json"),
      outputTarget: UnifiedIngestionOutputTargetKinds.records,
      configurationMode: "simple",
      output: createCanonicalRecordsShape({ records: Object.freeze([]) }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.normalized.metadata.isEmpty).toBeTrue();
      expect(result.normalized.warnings[0]?.code).toBe("empty-normalized-output");
    }
  });
});

