import { describe, expect, it } from "bun:test";
import { UnifiedIngestionReferenceKinds } from "../../domain/dataset-studio/UnifiedIngestionDomain";
import {
  UnifiedIngestionAssetExecutionWrapper,
  UnifiedIngestionAssetId,
  UnifiedIngestionAssetInputContractVersion,
  UnifiedIngestionAssetOutputContractVersion,
  UnifiedIngestionAssetVersion,
} from "../UnifiedIngestionAsset";

function createSource() {
  return Object.freeze({
    sourceId: "source-1",
    referenceKind: UnifiedIngestionReferenceKinds.inMemory,
    reference: "in-memory://source-1",
  });
}

describe("UnifiedIngestionAssetExecutionWrapper", () => {
  it("executes through the unified orchestration seam with versioned contracts", async () => {
    const calls: string[] = [];
    const wrapper = new UnifiedIngestionAssetExecutionWrapper({
      orchestration: {
        ingest: async () => {
          calls.push("ingest");
          return Object.freeze({
            contractVersion: "1.0.0",
            ok: true as const,
            source: createSource(),
            outputTarget: "canonical-records" as const,
            detection: Object.freeze({
              contractVersion: "1.0.0",
              source: createSource(),
              detectedKind: "json" as const,
              confidence: "high" as const,
              normalizedMetadata: Object.freeze({}),
              candidateScores: Object.freeze({
                csv: 0,
                json: 100,
                document: 0,
                image: 0,
                unknown: 0,
              }),
              evidence: Object.freeze([]),
            }),
            route: Object.freeze({
              status: "resolved" as const,
              sourceKind: "json" as const,
              handlerKind: "json" as const,
              assetId: "json-ingestor",
              policy: "detected-kind" as const,
              fallbackUsed: false,
              reason: "json route",
            }),
            output: Object.freeze({
              kind: "records" as const,
              records: Object.freeze([]),
              metadata: Object.freeze({ schemaVersion: "1.0.0" }),
            }),
            normalized: Object.freeze({
              contractVersion: "1.0.0",
              normalizationVersion: "1.0.0",
              canonicalOutputKind: "records" as const,
              normalizedPayload: Object.freeze({
                kind: "records" as const,
                records: Object.freeze([]),
                metadata: Object.freeze({ schemaVersion: "1.0.0" }),
              }),
              metadata: Object.freeze({
                outputTarget: "canonical-records" as const,
                configurationMode: "simple" as const,
                sourceId: "source-1",
                sourceReference: "in-memory://source-1",
                totalCount: 0,
                isEmpty: true,
              }),
              detectionSummary: Object.freeze({
                detectedKind: "json" as const,
                confidence: "high" as const,
                evidenceCount: 0,
              }),
              routeSummary: Object.freeze({
                handlerKind: "json" as const,
                assetId: "json-ingestor",
                policy: "detected-kind" as const,
                fallbackUsed: false,
              }),
              warnings: Object.freeze([]),
            }),
            conversion: Object.freeze({
              operation: "source-to-records" as const,
              inputBoundary: "resolved-source" as const,
            }),
            issues: Object.freeze([]),
            fallbacks: Object.freeze([]),
          });
        },
      } as never,
    });

    const result = await wrapper.execute({
      source: createSource(),
      payload: "{\"id\":1}",
      configurationMode: "simple",
      configurationValues: Object.freeze({
        outputTarget: "canonical-records",
      }),
    });

    expect(calls).toEqual(["ingest"]);
    expect(result.assetId).toBe(UnifiedIngestionAssetId);
    expect(result.assetVersion).toBe(UnifiedIngestionAssetVersion);
    expect(result.inputContractVersion).toBe(UnifiedIngestionAssetInputContractVersion);
    expect(result.outputContractVersion).toBe(UnifiedIngestionAssetOutputContractVersion);
    expect(result.mode).toBe("execute");
    expect(result.configuration.mode).toBe("simple");
  });

  it("routes preview requests to ingestWithPreview through the same wrapper seam", async () => {
    const calls: string[] = [];
    const wrapper = new UnifiedIngestionAssetExecutionWrapper({
      orchestration: {
        ingestWithPreview: async () => {
          calls.push("preview");
          return Object.freeze({
            contractVersion: "1.0.0",
            ok: false as const,
            source: createSource(),
            stage: "configuration" as const,
            issues: Object.freeze([]),
            failure: Object.freeze({
              stage: "configuration" as const,
              disposition: "recoverable" as const,
              code: "invalid-configuration",
              message: "invalid",
            }),
            fallbacks: Object.freeze([]),
            partial: Object.freeze({
              detectionResolved: false,
              routeResolved: false,
            }),
          });
        },
      } as never,
    });

    const result = await wrapper.preview({
      source: createSource(),
      payload: "{\"id\":1}",
      configurationMode: "advanced",
      configurationValues: Object.freeze({
        strategy: "document",
        outputTarget: "canonical-records",
      }),
    });

    expect(calls).toEqual(["preview"]);
    expect(result.mode).toBe("preview");
    expect(result.result.ok).toBeFalse();
  });

  it("exposes unified batch preview through the same asset wrapper contract", async () => {
    const wrapper = new UnifiedIngestionAssetExecutionWrapper({
      batchOrchestration: {
        previewBatch: async () => Object.freeze({
          summary: Object.freeze({
            totalItems: 2,
            succeeded: 1,
            failed: 1,
            skipped: 0,
            partialSuccess: true,
            empty: false,
            sourceKindDistribution: Object.freeze({ json: 1, csv: 1 }),
          }),
          items: Object.freeze([]),
          outputs: Object.freeze([]),
          normalizedOutputs: Object.freeze([]),
          issues: Object.freeze([]),
          sourceIssues: Object.freeze([]),
        }),
      } as never,
    });

    const result = await wrapper.previewBatch({
      sources: Object.freeze([createSource()]),
      configurationMode: "simple",
      configurationValues: Object.freeze({
        outputTarget: "canonical-records",
      }),
    });

    expect(result.mode).toBe("preview-batch");
    expect(result.assetId).toBe(UnifiedIngestionAssetId);
    expect(result.result.summary.partialSuccess).toBeTrue();
  });
});
