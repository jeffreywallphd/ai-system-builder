import type {
  UnifiedIngestionConfigMode,
  UnifiedIngestionDetectionResult,
  UnifiedIngestionIssue,
  UnifiedIngestionOutputTargetKind,
  UnifiedIngestionRouteResolution,
  UnifiedIngestionSourceReference,
} from "@domain/dataset-studio/UnifiedIngestionDomain";
import type { DatasetSchemaIntentId } from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionIssueCodes,
  UnifiedIngestionIssueSeverities,
  UnifiedIngestionNormalizationVersion,
  UnifiedIngestionOutputTargetKinds,
  type UnifiedIngestionNormalizedOutput,
} from "@domain/dataset-studio/UnifiedIngestionDomain";
import type { CanonicalDataShape, CanonicalDataShapeKind } from "@domain/dataset-studio/CanonicalDataShapes";

export interface UnifiedIngestionNormalizationRequest {
  readonly source: UnifiedIngestionSourceReference;
  readonly detection: UnifiedIngestionDetectionResult;
  readonly route: UnifiedIngestionRouteResolution;
  readonly outputTarget: UnifiedIngestionOutputTargetKind;
  readonly configurationMode: UnifiedIngestionConfigMode;
  readonly schemaIntentId?: DatasetSchemaIntentId;
  readonly output: CanonicalDataShape;
}

export interface UnifiedIngestionNormalizationSuccessResult {
  readonly ok: true;
  readonly normalized: UnifiedIngestionNormalizedOutput;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export interface UnifiedIngestionNormalizationFailureResult {
  readonly ok: false;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export type UnifiedIngestionNormalizationResult =
  | UnifiedIngestionNormalizationSuccessResult
  | UnifiedIngestionNormalizationFailureResult;

interface UnifiedIngestionNormalizationState {
  readonly request: UnifiedIngestionNormalizationRequest;
  readonly warnings: ReadonlyArray<UnifiedIngestionIssue>;
  readonly totalCount: number;
  readonly failedIssue?: UnifiedIngestionIssue;
}

interface IUnifiedIngestionNormalizationStage {
  readonly stageId: string;
  run(state: UnifiedIngestionNormalizationState): UnifiedIngestionNormalizationState;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildIssue(input: {
  readonly code: UnifiedIngestionIssue["code"];
  readonly severity?: UnifiedIngestionIssue["severity"];
  readonly message: string;
  readonly sourceId?: string;
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

function countOutputItems(output: CanonicalDataShape): number {
  if (output.kind === "records") {
    return output.records.length;
  }
  if (output.kind === "text-items") {
    return output.items.length;
  }
  if (output.kind === "image-metadata-records") {
    return output.items.length;
  }
  return output.rows.length;
}

function expectedShapeKind(outputTarget: UnifiedIngestionOutputTargetKind): CanonicalDataShapeKind {
  if (outputTarget === UnifiedIngestionOutputTargetKinds.textItems) {
    return "text-items";
  }
  if (outputTarget === UnifiedIngestionOutputTargetKinds.imageMetadataRecords) {
    return "image-metadata-records";
  }
  return "records";
}

class CanonicalKindValidationStage implements IUnifiedIngestionNormalizationStage {
  public readonly stageId = "canonical-kind-validation";

  public run(state: UnifiedIngestionNormalizationState): UnifiedIngestionNormalizationState {
    const actualKind = state.request.output.kind;
    if (
      actualKind !== "records"
      && actualKind !== "text-items"
      && actualKind !== "image-metadata-records"
    ) {
      return Object.freeze({
        ...state,
        failedIssue: buildIssue({
          code: UnifiedIngestionIssueCodes.normalizationFailed,
          message: `Unified ingestion normalization does not support canonical output kind '${actualKind}'.`,
          sourceId: state.request.source.sourceId,
          details: Object.freeze({
            stage: this.stageId,
            outputKind: actualKind,
          }),
        }),
      });
    }
    return state;
  }
}

class OutputTargetAlignmentStage implements IUnifiedIngestionNormalizationStage {
  public readonly stageId = "output-target-alignment";

  public run(state: UnifiedIngestionNormalizationState): UnifiedIngestionNormalizationState {
    const expectedKind = expectedShapeKind(state.request.outputTarget);
    if (state.request.output.kind === expectedKind) {
      return state;
    }

    return Object.freeze({
      ...state,
      failedIssue: buildIssue({
        code: UnifiedIngestionIssueCodes.normalizationFailed,
        message: `Normalized output kind '${state.request.output.kind}' does not match output target '${state.request.outputTarget}'.`,
        sourceId: state.request.source.sourceId,
        details: Object.freeze({
          stage: this.stageId,
          outputTarget: state.request.outputTarget,
          expectedKind,
          actualKind: state.request.output.kind,
        }),
      }),
    });
  }
}

class OutputSummaryStage implements IUnifiedIngestionNormalizationStage {
  public readonly stageId = "output-summary";

  public run(state: UnifiedIngestionNormalizationState): UnifiedIngestionNormalizationState {
    const totalCount = countOutputItems(state.request.output);
    const warnings = [...state.warnings];
    if (totalCount === 0) {
      warnings.push(buildIssue({
        code: UnifiedIngestionIssueCodes.emptyNormalizedOutput,
        severity: UnifiedIngestionIssueSeverities.warning,
        message: "Normalized output is empty.",
        sourceId: state.request.source.sourceId,
        details: Object.freeze({ stage: this.stageId }),
      }));
    }
    if (state.request.route.fallbackUsed) {
      warnings.push(buildIssue({
        code: UnifiedIngestionIssueCodes.partialNormalizedOutput,
        severity: UnifiedIngestionIssueSeverities.warning,
        message: "Fallback routing was used; review normalized output before execution.",
        sourceId: state.request.source.sourceId,
        details: Object.freeze({
          stage: this.stageId,
          policy: state.request.route.policy,
          handlerKind: state.request.route.handlerKind,
        }),
      }));
    }

    return Object.freeze({
      ...state,
      totalCount,
      warnings: Object.freeze(warnings),
    });
  }
}

export class UnifiedIngestionNormalizationPipeline {
  private readonly stages: ReadonlyArray<IUnifiedIngestionNormalizationStage>;

  constructor(stages?: ReadonlyArray<IUnifiedIngestionNormalizationStage>) {
    this.stages = stages ?? Object.freeze([
      new CanonicalKindValidationStage(),
      new OutputTargetAlignmentStage(),
      new OutputSummaryStage(),
    ]);
  }

  public normalize(request: UnifiedIngestionNormalizationRequest): UnifiedIngestionNormalizationResult {
    let state: UnifiedIngestionNormalizationState = Object.freeze({
      request,
      warnings: Object.freeze([]),
      totalCount: 0,
    });

    for (const stage of this.stages) {
      state = stage.run(state);
      if (state.failedIssue) {
        return Object.freeze({
          ok: false,
          issues: Object.freeze([state.failedIssue]),
        });
      }
    }

    const normalized: UnifiedIngestionNormalizedOutput = Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      normalizationVersion: UnifiedIngestionNormalizationVersion,
      canonicalOutputKind: request.output.kind,
      normalizedPayload: request.output,
      metadata: Object.freeze({
        outputTarget: request.outputTarget,
        configurationMode: request.configurationMode,
        ...(request.schemaIntentId ? { schemaIntentId: request.schemaIntentId } : {}),
        sourceId: request.source.sourceId,
        sourceReference: request.source.reference,
        sourceAssetId: request.source.sourceAssetId,
        sourceVersionId: request.source.sourceVersionId,
        totalCount: state.totalCount,
        isEmpty: state.totalCount === 0,
      }),
      detectionSummary: Object.freeze({
        detectedKind: request.detection.detectedKind,
        confidence: request.detection.confidence,
        evidenceCount: request.detection.evidence.length,
      }),
      routeSummary: Object.freeze({
        handlerKind: request.route.handlerKind,
        assetId: request.route.assetId,
        assetVersion: request.route.assetVersion,
        policy: request.route.policy,
        fallbackUsed: request.route.fallbackUsed,
      }),
      warnings: state.warnings,
    });

    return Object.freeze({
      ok: true,
      normalized,
      issues: state.warnings,
    });
  }
}


