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
            metadata: Object.freeze({
              contractVersion: "1.0.0",
              metadataVersion: "1.0.0",
              source: Object.freeze({
                sourceId: "source-1",
                reference: "in-memory://source-1",
                referenceKind: "in-memory",
              }),
              detection: Object.freeze({
                detectedKind: "json",
                confidence: "high",
                candidateScores: Object.freeze({
                  csv: 0,
                  json: 100,
                  document: 0,
                  image: 0,
                  unknown: 0,
                }),
                evidenceCount: 0,
                normalizedMetadata: Object.freeze({}),
              }),
              route: Object.freeze({
                status: "resolved",
                sourceKind: "json",
                handlerKind: "json",
                assetId: "json-ingestor",
                fallbackUsed: false,
                policy: "detected-kind",
              }),
              conversion: Object.freeze({
                operation: "source-to-records",
                inputBoundary: "resolved-source",
                outputKind: "records",
              }),
              normalization: Object.freeze({
                normalizationVersion: "1.0.0",
                outputTarget: "canonical-records",
                canonicalOutputKind: "records",
                totalCount: 0,
                isEmpty: true,
              }),
              processing: Object.freeze({
                startedAt: "2026-03-31T00:00:00.000Z",
                completedAt: "2026-03-31T00:00:01.000Z",
                configurationMode: "simple",
                outputTarget: "canonical-records",
                stageCount: 6,
                warningCount: 0,
                errorCount: 0,
                fallbackCount: 0,
              }),
            }),
            lineage: Object.freeze({
              contractVersion: "1.0.0",
              lineageVersion: "1.0.0",
              lineageId: "lineage-1",
              capturedAt: "2026-03-31T00:00:01.000Z",
              source: Object.freeze({
                sourceId: "source-1",
                reference: "in-memory://source-1",
                referenceKind: "in-memory",
              }),
              stages: Object.freeze([]),
              detection: Object.freeze({
                detectedKind: "json",
                confidence: "high",
                candidateScores: Object.freeze({
                  csv: 0,
                  json: 100,
                  document: 0,
                  image: 0,
                  unknown: 0,
                }),
                evidenceCount: 0,
                normalizedMetadata: Object.freeze({}),
              }),
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
    expect(result.result.ok).toBeTrue();
    if (result.result.ok) {
      expect(result.result.metadata.processing.stageCount).toBe(6);
      expect(result.result.lineage.lineageId).toBe("lineage-1");
    }
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
            metadata: Object.freeze({
              contractVersion: "1.0.0",
              metadataVersion: "1.0.0",
              source: Object.freeze({
                sourceId: "source-1",
                reference: "in-memory://source-1",
                referenceKind: "in-memory",
              }),
              processing: Object.freeze({
                startedAt: "2026-03-31T00:00:00.000Z",
                completedAt: "2026-03-31T00:00:00.500Z",
                configurationMode: "advanced",
                outputTarget: "canonical-records",
                stageCount: 1,
                warningCount: 0,
                errorCount: 1,
                fallbackCount: 0,
              }),
            }),
            lineage: Object.freeze({
              contractVersion: "1.0.0",
              lineageVersion: "1.0.0",
              lineageId: "lineage-2",
              capturedAt: "2026-03-31T00:00:00.500Z",
              source: Object.freeze({
                sourceId: "source-1",
                reference: "in-memory://source-1",
                referenceKind: "in-memory",
              }),
              stages: Object.freeze([]),
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
    if (!result.result.ok) {
      expect(result.result.lineage.lineageId).toBe("lineage-2");
      expect(result.result.metadata.processing.errorCount).toBe(1);
    }
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
          metadata: Object.freeze({
            contractVersion: "1.0.0",
            metadataVersion: "1.0.0",
            processing: Object.freeze({
              startedAt: "2026-03-31T00:00:00.000Z",
              completedAt: "2026-03-31T00:00:01.000Z",
              outputTarget: "canonical-records",
              configurationMode: "simple",
              continueOnError: true,
              requestedConcurrency: 4,
            }),
            counts: Object.freeze({
              totalItems: 2,
              succeeded: 1,
              failed: 1,
              skipped: 0,
              partialSuccess: true,
              empty: false,
            }),
            outputs: Object.freeze({
              normalizedOutputCount: 0,
              totalRecordCount: 0,
              totalTextItemCount: 0,
              totalImageItemCount: 0,
            }),
          }),
          lineage: Object.freeze({
            contractVersion: "1.0.0",
            lineageVersion: "1.0.0",
            lineageId: "batch-lineage-1",
            capturedAt: "2026-03-31T00:00:01.000Z",
            itemLineages: Object.freeze([]),
            summary: Object.freeze({
              totalItems: 2,
              succeeded: 1,
              failed: 1,
              skipped: 0,
            }),
          }),
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
    expect(result.result.metadata.counts.partialSuccess).toBeTrue();
    expect(result.result.lineage.lineageId).toBe("batch-lineage-1");
  });
});
