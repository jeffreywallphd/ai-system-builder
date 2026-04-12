import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  createImageManipulationIssueClassification,
  type ImageManipulationFailureDisposition,
  type ImageManipulationFailureSummaryCategory,
  type ImageManipulationIssueClassification,
  type ImageManipulationIssueKind,
  type ImageManipulationIssueLayer,
} from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";
import {
  deriveImageManipulationRetryRecoveryContractFromClassification,
  type ImageManipulationRetryRecoveryContract,
} from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";
import {
  createImageManipulationResilienceCondition,
  createImageManipulationResilienceSnapshot,
  type ImageManipulationResilienceDurabilityClass,
  type ImageManipulationResilienceRecoveryKind,
  type ImageManipulationResilienceScope,
  type ImageManipulationResilienceSnapshot,
  type ImageManipulationResilienceStateKind,
} from "@shared/contracts/image-workflows/ImageManipulationResilienceStateContracts";

export interface ImageAssetNormalizedFailure {
  readonly classification: ImageManipulationIssueClassification;
  readonly recovery: ImageManipulationRetryRecoveryContract;
  readonly resilience?: ImageManipulationResilienceSnapshot;
}

export interface CreateImageAssetNormalizedFailureInput {
  readonly layer: ImageManipulationIssueLayer;
  readonly kind: ImageManipulationIssueKind;
  readonly reason: string;
  readonly summaryCategory: ImageManipulationFailureSummaryCategory;
  readonly disposition?: ImageManipulationFailureDisposition;
  readonly userFixable?: boolean;
  readonly degraded?: boolean;
  readonly retryable?: boolean;
  readonly retryAfterMs?: number;
  readonly resilience?: {
    readonly code: string;
    readonly scope: ImageManipulationResilienceScope;
    readonly state: ImageManipulationResilienceStateKind;
    readonly summary: string;
    readonly observedAt?: string;
    readonly durability?: ImageManipulationResilienceDurabilityClass;
    readonly recoveryKind?: ImageManipulationResilienceRecoveryKind;
    readonly recoveryBlocking?: boolean;
    readonly recoveryRetryable?: boolean;
    readonly recoveryRetryAfterMs?: number;
  };
}

export function createImageAssetNormalizedFailure(
  input: CreateImageAssetNormalizedFailureInput,
): ImageAssetNormalizedFailure {
  const classification = createImageManipulationIssueClassification({
    layer: input.layer,
    kind: input.kind,
    summaryCategory: input.summaryCategory,
    disposition: input.disposition ?? (input.retryable
      ? ImageManipulationFailureDispositions.retryable
      : ImageManipulationFailureDispositions.terminal),
    reason: input.reason,
    userFixable: input.userFixable,
    degraded: input.degraded,
  });

  const resilience = input.resilience
    ? createImageManipulationResilienceSnapshot({
      observedAt: input.resilience.observedAt,
      conditions: Object.freeze([createImageManipulationResilienceCondition({
        code: input.resilience.code,
        scope: input.resilience.scope,
        state: input.resilience.state,
        summary: input.resilience.summary,
        observedAt: input.resilience.observedAt,
        classification,
        durability: input.resilience.durability,
        recovery: {
          kind: input.resilience.recoveryKind,
          blocking: input.resilience.recoveryBlocking,
          retryable: input.resilience.recoveryRetryable,
          retryAfterMs: input.resilience.recoveryRetryAfterMs,
        },
      })]),
    })
    : undefined;

  return Object.freeze({
    classification,
    recovery: deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: Boolean(input.retryable),
      retryAfterMs: input.retryAfterMs,
      resilienceState: resilience?.state,
    }),
    resilience,
  });
}

export function withImageAssetNormalizedFailureDetails(
  details: Readonly<Record<string, unknown>> | undefined,
  failure: ImageAssetNormalizedFailure,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...(details ?? {}),
    imageManipulationFailure: failure,
  });
}

export const ImageAssetFailureDefaults = Object.freeze({
  layer: {
    ingestion: ImageManipulationIssueLayers.assetIngestion,
    preview: ImageManipulationIssueLayers.previewGeneration,
    retrieval: ImageManipulationIssueLayers.protectedRetrieval,
  },
  kind: {
    validation: ImageManipulationIssueKinds.validation,
    operational: ImageManipulationIssueKinds.operational,
  },
  summary: {
    validation: ImageManipulationFailureSummaryCategories.validation,
    connectivity: ImageManipulationFailureSummaryCategories.connectivity,
    output: ImageManipulationFailureSummaryCategories.output,
    internal: ImageManipulationFailureSummaryCategories.internal,
    unknown: ImageManipulationFailureSummaryCategories.unknown,
  },
});
