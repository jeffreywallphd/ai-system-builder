import { describe, expect, it } from "bun:test";
import { createCanonicalImageMetadataRecordsShape, createCanonicalRecordsShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
  type IUnifiedIngestionRouter,
  type IUnifiedIngestionSourceTypeDetector,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import { DataConverterOperationKinds, type DataConverterResult } from "../DataConverterContracts";
import { UnifiedIngestionOrchestrationService } from "../UnifiedIngestionOrchestrationService";

function createSource() {
  return Object.freeze({
    sourceId: "source-1",
    referenceKind: UnifiedIngestionReferenceKinds.inMemory,
    reference: "memory://source-1",
    displayName: "source-1",
  });
}

function createDetection(kind: "csv" | "json" | "document" | "image" | "unknown") {
  return Object.freeze({
    contractVersion: UnifiedIngestionContractVersion,
    source: createSource(),
    detectedKind: kind,
    confidence: "high" as const,
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

describe("UnifiedIngestionOrchestrationService", () => {
  it("executes routed CSV ingestion and converts raw records via shared converter", async () => {
    const converterCalls: string[] = [];
    const detector: IUnifiedIngestionSourceTypeDetector = Object.freeze({
      detect: async () => createDetection("csv"),
    });
    const router: IUnifiedIngestionRouter = Object.freeze({
      route: () => Object.freeze({
        status: "resolved" as const,
        sourceKind: "csv" as const,
        handlerKind: "csv" as const,
        assetId: "csv-ingestor",
        policy: "detected-kind" as const,
        fallbackUsed: false,
        reason: "csv route",
      }),
    });
    const converter = {
      convert: (request: { operation: string }): DataConverterResult => {
        converterCalls.push(request.operation);
        return Object.freeze({
          ok: true,
          operation: DataConverterOperationKinds.sourceToRecords,
          context: Object.freeze({}),
          contract: Object.freeze({
            schemaVersion: "1.0.0",
            converterId: "test-converter",
            converterVersion: "1.0.0",
            operation: DataConverterOperationKinds.sourceToRecords,
            inputBoundary: "resolved-source",
            outputShapeKind: "records",
          }),
          metadata: Object.freeze({ schemaVersion: "1.0.0" }),
          output: createCanonicalRecordsShape({
            records: Object.freeze([Object.freeze({ recordId: "1", fields: Object.freeze({ id: "1" }) })]),
          }),
          diagnostics: Object.freeze([]),
        });
      },
    };

    const service = new UnifiedIngestionOrchestrationService({
      detector,
      router,
      converter: converter as never,
      csvIngestor: {
        execute: () => Object.freeze({
          ok: true,
          records: Object.freeze([Object.freeze({ id: "1", name: "Ada" })]),
        }),
      } as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: "id,name\n1,Ada",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.output.kind).toBe("records");
      expect(result.normalized.canonicalOutputKind).toBe("records");
      expect(result.route.assetId).toBe("csv-ingestor");
      expect(result.conversion.operation).toBe("source-to-records");
      expect(converterCalls).toEqual(["source-to-records"]);
    }
  });

  it("surfaces structured routing failure when no route is supported", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("unknown"),
      }) as never,
      router: Object.freeze({
        route: () => Object.freeze({
          status: "unsupported" as const,
          sourceKind: "unknown" as const,
          failureCode: "unsupported-source-kind" as const,
          fallbackUsed: false,
          reason: "unsupported",
        }),
      }) as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: "raw",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.stage).toBe("routing");
      expect(result.issues[0]?.code).toBe("routing-unsupported");
      expect(result.failure.disposition).toBe("recoverable");
      expect(result.partial.detectionResolved).toBeTrue();
    }
  });

  it("propagates converter failures with conversion stage details", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("document"),
      }) as never,
      router: Object.freeze({
        route: () => Object.freeze({
          status: "resolved" as const,
          sourceKind: "document" as const,
          handlerKind: "document" as const,
          assetId: "document-pdf-ingestor",
          policy: "detected-kind" as const,
          fallbackUsed: false,
          reason: "document route",
        }),
      }) as never,
      documentIngestor: {
        execute: async () => Object.freeze({
          ok: true,
          fullText: "hello world",
        }),
      } as never,
      converter: {
        convert: () => Object.freeze({
          ok: false,
          operation: DataConverterOperationKinds.documentToTextItems,
          context: Object.freeze({}),
          diagnostics: Object.freeze([Object.freeze({
            code: "converter-failure",
            severity: "error",
            message: "conversion failed",
          })]),
        }),
      } as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: "hello world",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.stage).toBe("conversion");
      expect(result.issues[0]?.code).toBe("conversion-failed");
      expect(result.failure.disposition).toBe("terminal");
    }
  });

  it("normalizes image ingestion to canonical image-metadata-records through converter", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("image"),
      }) as never,
      router: Object.freeze({
        route: () => Object.freeze({
          status: "resolved" as const,
          sourceKind: "image" as const,
          handlerKind: "image" as const,
          assetId: "image-ingestor-v1",
          policy: "detected-kind" as const,
          fallbackUsed: false,
          reason: "image route",
        }),
      }) as never,
      imageIngestor: {
        execute: async () => Object.freeze({
          ok: true,
          metadata: Object.freeze({ width: 10, height: 10, format: "png" }),
        }),
      } as never,
      converter: {
        convert: () => Object.freeze({
          ok: true,
          operation: DataConverterOperationKinds.imageMetadataToRecords,
          context: Object.freeze({}),
          contract: Object.freeze({
            schemaVersion: "1.0.0",
            converterId: "test-converter",
            converterVersion: "1.0.0",
            operation: DataConverterOperationKinds.imageMetadataToRecords,
            inputBoundary: "image-metadata",
            outputShapeKind: "image-metadata-records",
          }),
          metadata: Object.freeze({ schemaVersion: "1.0.0" }),
          output: createCanonicalImageMetadataRecordsShape({
            items: Object.freeze([Object.freeze({ itemId: "img-1", imageId: "img-1" })]),
          }),
          diagnostics: Object.freeze([]),
        }),
      } as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: new Uint8Array([1, 2, 3]),
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.imageMetadataRecords,
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.output.kind).toBe("image-metadata-records");
      expect(result.conversion.operation).toBe("image-metadata-to-records");
    }
  });

  it("rejects contradictory advanced configuration before routing/execution", async () => {
    const service = new UnifiedIngestionOrchestrationService();
    const result = await service.ingest({
      source: createSource(),
      payload: "{\"id\":1}",
      configuration: Object.freeze({
        mode: "advanced",
        strategy: "document",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.stage).toBe("configuration");
      expect(result.issues[0]?.code).toBe("invalid-configuration");
    }
  });

  it("returns preview contracts from normalized unified ingestion outputs", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("json"),
      }) as never,
      router: Object.freeze({
        route: () => Object.freeze({
          status: "resolved" as const,
          sourceKind: "json" as const,
          handlerKind: "json" as const,
          assetId: "json-ingestor",
          policy: "detected-kind" as const,
          fallbackUsed: false,
          reason: "json route",
        }),
      }) as never,
      jsonIngestor: {
        execute: () => Object.freeze({
          ok: true,
          records: Object.freeze([Object.freeze({ id: 1, name: "Ada" })]),
        }),
      } as never,
    });

    const result = await service.ingestWithPreview({
      source: createSource(),
      payload: "{\"id\":1,\"name\":\"Ada\"}",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.preview.ok).toBeTrue();
      expect(result.preview.degraded).toBeFalse();
      expect(result.preview.outputKind).toBe("records");
      expect(result.preview.summary.totalCount).toBe(1);
    }
  });

  it("surfaces deterministic fallback metadata when unknown detection routes via output-target policy", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("unknown"),
      }) as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: "{\"id\":1}",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.route.fallbackUsed).toBeTrue();
      expect(result.fallbacks.some((decision) => decision.kind === "unknown-route-fallback")).toBeTrue();
    }
  });

  it("surfaces detection tie-break fallback decisions when detector resolves conflicting signals", async () => {
    const detector: IUnifiedIngestionSourceTypeDetector = Object.freeze({
      detect: async () => Object.freeze({
        ...createDetection("json"),
        evidence: Object.freeze([
          Object.freeze({
            kind: "extension-heuristic" as const,
            message: "File extension '.csv' maps to 'csv'.",
            candidateKind: "csv" as const,
            weight: 45,
          }),
          Object.freeze({
            kind: "content-sniff" as const,
            message: "Content sample is valid JSON.",
            candidateKind: "json" as const,
            weight: 50,
          }),
          Object.freeze({
            kind: "conflict-resolution" as const,
            message: "Conflicting detection signals were resolved by score priority.",
            candidateKind: "json" as const,
            weight: 5,
            details: Object.freeze({ topScore: 55, secondScore: 50 }),
          }),
        ]),
      }),
    });
    const service = new UnifiedIngestionOrchestrationService({
      detector,
      jsonIngestor: {
        execute: () => Object.freeze({
          ok: true,
          records: Object.freeze([Object.freeze({ id: 1 })]),
        }),
      } as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: "{\"id\":1}",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.fallbacks.some((decision) => decision.kind === "detection-tie-breaker")).toBeTrue();
    }
  });

  it("degrades preview instead of failing the full ingestion result", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("json"),
      }) as never,
      router: Object.freeze({
        route: () => Object.freeze({
          status: "resolved" as const,
          sourceKind: "json" as const,
          handlerKind: "json" as const,
          assetId: "json-ingestor",
          policy: "detected-kind" as const,
          fallbackUsed: false,
          reason: "json route",
        }),
      }) as never,
      jsonIngestor: {
        execute: () => Object.freeze({
          ok: true,
          records: Object.freeze([Object.freeze({ id: 1, name: "Ada" })]),
        }),
      } as never,
      previewService: {
        generate: () => Object.freeze({
          contractVersion: "1.0.0",
          ok: true,
          degraded: true,
          source: createSource(),
          outputKind: "records",
          preview: Object.freeze({
            kind: "error",
            message: "degraded",
            summary: Object.freeze({ totalCount: 1, sampleCount: 0, truncated: false }),
            metadata: Object.freeze({ schemaVersion: "1.0.0", lineageCount: 0 }),
            diagnostics: Object.freeze({
              infoCount: 0,
              warningCount: 1,
              errorCount: 0,
              diagnostics: Object.freeze([]),
            }),
          }),
          summary: Object.freeze({
            totalCount: 1,
            sampleCount: 0,
            truncated: false,
            isEmpty: false,
          }),
          metadataSummary: Object.freeze({
            outputTarget: UnifiedIngestionOutputTargetKinds.records,
            configurationMode: "simple",
          }),
          detectionSummary: Object.freeze({
            detectedKind: "json",
            confidence: "high",
            evidenceCount: 1,
          }),
          routeSummary: Object.freeze({
            handlerKind: "json",
            assetId: "json-ingestor",
            policy: "detected-kind",
            fallbackUsed: false,
          }),
          samples: Object.freeze([]),
          issues: Object.freeze([]),
        }),
      } as never,
    });

    const result = await service.ingestWithPreview({
      source: createSource(),
      payload: "{\"id\":1,\"name\":\"Ada\"}",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      }),
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.preview.ok).toBeTrue();
      expect(result.preview.degraded).toBeTrue();
      expect(result.fallbacks.some((decision) => decision.kind === "degraded-preview")).toBeTrue();
    }
  });

  it("surfaces normalization failures when output target mismatches canonical output", async () => {
    const service = new UnifiedIngestionOrchestrationService({
      detector: Object.freeze({
        detect: async () => createDetection("csv"),
      }) as never,
      router: Object.freeze({
        route: () => Object.freeze({
          status: "resolved" as const,
          sourceKind: "csv" as const,
          handlerKind: "csv" as const,
          assetId: "csv-ingestor",
          policy: "detected-kind" as const,
          fallbackUsed: false,
          reason: "csv route",
        }),
      }) as never,
      csvIngestor: {
        execute: () => Object.freeze({
          ok: true,
          records: Object.freeze([Object.freeze({ id: "1" })]),
        }),
      } as never,
    });

    const result = await service.ingest({
      source: createSource(),
      payload: "id\n1",
      configuration: Object.freeze({
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.stage).toBe("normalization");
      expect(result.issues[0]?.code).toBe("normalization-failed");
    }
  });
});
