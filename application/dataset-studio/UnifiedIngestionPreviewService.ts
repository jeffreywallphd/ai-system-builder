import { DataPreviewEngine, type DataPreviewModel } from "../data-studio/DataPreviewEngine";
import type {
  UnifiedIngestionIssue,
  UnifiedIngestionNormalizedOutput,
  UnifiedIngestionSourceReference,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionIssueCodes,
  UnifiedIngestionIssueSeverities,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";

export interface UnifiedIngestionPreviewSampleItem {
  readonly sampleId: string;
  readonly itemType: "record" | "text-item" | "image-item";
  readonly value: Readonly<Record<string, unknown>>;
}

export interface UnifiedIngestionPreviewSuccessResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: true;
  readonly degraded: boolean;
  readonly source: UnifiedIngestionSourceReference;
  readonly outputKind: UnifiedIngestionNormalizedOutput["canonicalOutputKind"];
  readonly preview: DataPreviewModel;
  readonly summary: {
    readonly totalCount: number;
    readonly sampleCount: number;
    readonly truncated: boolean;
    readonly isEmpty: boolean;
  };
  readonly metadataSummary: {
    readonly outputTarget: UnifiedIngestionNormalizedOutput["metadata"]["outputTarget"];
    readonly configurationMode: UnifiedIngestionNormalizedOutput["metadata"]["configurationMode"];
    readonly sourceAssetId?: string;
    readonly sourceVersionId?: string;
  };
  readonly detectionSummary: UnifiedIngestionNormalizedOutput["detectionSummary"];
  readonly routeSummary: UnifiedIngestionNormalizedOutput["routeSummary"];
  readonly samples: ReadonlyArray<UnifiedIngestionPreviewSampleItem>;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export interface UnifiedIngestionPreviewFailureResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: false;
  readonly degraded: boolean;
  readonly source: UnifiedIngestionSourceReference;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export type UnifiedIngestionPreviewResult = UnifiedIngestionPreviewSuccessResult | UnifiedIngestionPreviewFailureResult;

export interface UnifiedIngestionPreviewRequest {
  readonly source: UnifiedIngestionSourceReference;
  readonly normalized: UnifiedIngestionNormalizedOutput;
  readonly issues?: ReadonlyArray<UnifiedIngestionIssue>;
  readonly sampleLimit?: number;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildIssue(input: {
  readonly code: UnifiedIngestionIssue["code"];
  readonly message: string;
  readonly sourceId?: string;
  readonly severity?: UnifiedIngestionIssue["severity"];
  readonly details?: Readonly<Record<string, unknown>>;
}): UnifiedIngestionIssue {
  return Object.freeze({
    code: input.code,
    severity: input.severity ?? UnifiedIngestionIssueSeverities.error,
    message: input.message,
    sourceId: normalizeOptional(input.sourceId),
    details: input.details,
  });
}

function toSampleItems(
  output: UnifiedIngestionNormalizedOutput,
  sampleLimit: number,
): ReadonlyArray<UnifiedIngestionPreviewSampleItem> {
  const limit = Math.max(1, sampleLimit);
  if (output.normalizedPayload.kind === "records") {
    return Object.freeze(output.normalizedPayload.records.slice(0, limit).map((record) => Object.freeze({
      sampleId: record.recordId,
      itemType: "record" as const,
      value: record.fields as Readonly<Record<string, unknown>>,
    })));
  }
  if (output.normalizedPayload.kind === "text-items") {
    return Object.freeze(output.normalizedPayload.items.slice(0, limit).map((item) => Object.freeze({
      sampleId: item.itemId,
      itemType: "text-item" as const,
      value: Object.freeze({
        text: item.text,
        sourceDocumentId: item.sourceDocumentId,
        startOffset: item.startOffset,
        endOffset: item.endOffset,
      }),
    })));
  }
  return Object.freeze(output.normalizedPayload.items.slice(0, limit).map((item) => Object.freeze({
    sampleId: item.itemId,
    itemType: "image-item" as const,
    value: Object.freeze({
      imageId: item.imageId,
      label: item.label,
      confidence: item.confidence,
      boundingBox: item.boundingBox,
    }),
  })));
}

export class UnifiedIngestionPreviewService {
  private readonly previewEngine: DataPreviewEngine;

  constructor(options?: { readonly previewEngine?: DataPreviewEngine }) {
    this.previewEngine = options?.previewEngine ?? new DataPreviewEngine();
  }

  public generate(request: UnifiedIngestionPreviewRequest): UnifiedIngestionPreviewResult {
    const issues = [...(request.issues ?? []), ...request.normalized.warnings];

    try {
      const preview = this.previewEngine.buildFromCanonicalShape(request.normalized.normalizedPayload, {
        maxItems: request.sampleLimit ?? 25,
        maxColumns: 12,
        maxTextLength: 320,
      });
      const samples = toSampleItems(request.normalized, request.sampleLimit ?? 10);
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: true,
        degraded: false,
        source: request.source,
        outputKind: request.normalized.canonicalOutputKind,
        preview,
        summary: Object.freeze({
          totalCount: request.normalized.metadata.totalCount,
          sampleCount: preview.summary.sampleCount,
          truncated: preview.summary.truncated,
          isEmpty: request.normalized.metadata.isEmpty,
        }),
        metadataSummary: Object.freeze({
          outputTarget: request.normalized.metadata.outputTarget,
          configurationMode: request.normalized.metadata.configurationMode,
          sourceAssetId: request.normalized.metadata.sourceAssetId,
          sourceVersionId: request.normalized.metadata.sourceVersionId,
        }),
        detectionSummary: request.normalized.detectionSummary,
        routeSummary: request.normalized.routeSummary,
        samples,
        issues: Object.freeze(issues),
      });
    } catch (error) {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: true,
        degraded: true,
        source: request.source,
        outputKind: request.normalized.canonicalOutputKind,
        preview: Object.freeze({
          kind: "error",
          message: "Preview generation was degraded.",
          summary: Object.freeze({
            totalCount: request.normalized.metadata.totalCount,
            sampleCount: 0,
            truncated: false,
          }),
          metadata: Object.freeze({
            schemaVersion: "1.0.0",
            sourceFileName: request.normalized.metadata.sourceReference,
            sourceFormat: request.normalized.metadata.outputTarget,
            lineageCount: 0,
          }),
          diagnostics: Object.freeze({
            infoCount: 0,
            warningCount: 1,
            errorCount: 0,
            diagnostics: Object.freeze([]),
          }),
        }),
        summary: Object.freeze({
          totalCount: request.normalized.metadata.totalCount,
          sampleCount: 0,
          truncated: false,
          isEmpty: request.normalized.metadata.isEmpty,
        }),
        metadataSummary: Object.freeze({
          outputTarget: request.normalized.metadata.outputTarget,
          configurationMode: request.normalized.metadata.configurationMode,
          sourceAssetId: request.normalized.metadata.sourceAssetId,
          sourceVersionId: request.normalized.metadata.sourceVersionId,
        }),
        detectionSummary: request.normalized.detectionSummary,
        routeSummary: request.normalized.routeSummary,
        samples: Object.freeze([]),
        issues: Object.freeze([
          ...issues,
          buildIssue({
            code: UnifiedIngestionIssueCodes.previewGenerationFailed,
            sourceId: request.source.sourceId,
            severity: UnifiedIngestionIssueSeverities.warning,
            message: "Unified ingestion preview generation failed; a degraded preview was returned.",
            details: Object.freeze({
              errorType: error instanceof Error ? error.name : typeof error,
            }),
          }),
        ]),
      });
    }
  }
}
