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
});
