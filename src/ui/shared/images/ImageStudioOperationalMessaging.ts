import {
  ImageManipulationEscalationCategories,
  ImageManipulationRecoveryActionHintKinds,
  deriveImageManipulationRetryRecoveryContractFromClassification,
  type ImageManipulationRetryRecoveryContract,
} from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";
import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  createImageManipulationIssueClassification,
  parseImageManipulationIssueCode,
  type ImageManipulationFailureDisposition,
  type ImageManipulationFailureSummaryCategory,
  type ImageManipulationIssueClassification,
  type ImageManipulationIssueKind,
  type ImageManipulationIssueLayer,
} from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";

export const ImageStudioOperationalMessageKinds = Object.freeze({
  none: "none",
  userActionRequired: "user-action-required",
  waitAndRetryLater: "wait-and-retry-later",
  operatorActionRequired: "operator-action-required",
  terminalFailure: "terminal-failure",
} as const);

export type ImageStudioOperationalMessageKind =
  typeof ImageStudioOperationalMessageKinds[keyof typeof ImageStudioOperationalMessageKinds];

export interface ImageStudioOperationalGuidance {
  readonly kind: ImageStudioOperationalMessageKind;
  readonly summary: string;
  readonly recommendedActions: ReadonlyArray<string>;
  readonly canRetryNow: boolean;
}

export function mapImageStudioFailureCodeToClassification(input: {
  readonly code?: string;
  readonly fallbackLayer: ImageManipulationIssueLayer;
}): ImageManipulationIssueClassification | undefined {
  const rawCode = input.code?.trim().toLowerCase();
  if (!rawCode) {
    return undefined;
  }

  const parsed = parseImageManipulationIssueCode(rawCode);
  if (parsed) {
    return createImageManipulationIssueClassification({
      layer: parsed.layer,
      kind: parsed.kind,
      summaryCategory: resolveSummaryCategoryFromReason(parsed.reason),
      disposition: resolveDispositionFromReason(parsed.reason),
      reason: parsed.reason,
      userFixable: parsed.kind === ImageManipulationIssueKinds.validation,
      degraded: parsed.kind === ImageManipulationIssueKinds.operational,
    });
  }

  const kind = resolveIssueKindFromCode(rawCode);
  return createImageManipulationIssueClassification({
    layer: input.fallbackLayer,
    kind,
    summaryCategory: resolveSummaryCategoryFromReason(rawCode),
    disposition: resolveDispositionFromReason(rawCode),
    reason: sanitizeReason(rawCode),
    userFixable: kind === ImageManipulationIssueKinds.validation,
    degraded: kind === ImageManipulationIssueKinds.operational,
  });
}

export function deriveImageStudioOperationalGuidance(input: {
  readonly recovery?: ImageManipulationRetryRecoveryContract;
  readonly classification?: ImageManipulationIssueClassification;
  readonly retryable?: boolean;
  readonly fallbackSummary: string;
  readonly launchReady?: boolean;
}): ImageStudioOperationalGuidance {
  const classification = input.classification;
  const recovery = input.recovery
    ?? (classification
      ? deriveImageManipulationRetryRecoveryContractFromClassification({
        classification,
        retryable: input.retryable ?? false,
      })
      : undefined);
  const canRetryNow = Boolean(input.launchReady) && Boolean(recovery?.retry.retryEligible && recovery.retry.retrySafe);

  if (classification?.userFixable) {
    return Object.freeze({
      kind: ImageStudioOperationalMessageKinds.userActionRequired,
      summary: input.fallbackSummary,
      recommendedActions: Object.freeze([
        "Review your image and settings, then run again.",
        "Use advanced details only if you need technical diagnostics.",
      ]),
      canRetryNow: false,
    });
  }

  if (recovery?.recoveryAction.kind === ImageManipulationRecoveryActionHintKinds.userActionRequired) {
    return Object.freeze({
      kind: ImageStudioOperationalMessageKinds.userActionRequired,
      summary: input.fallbackSummary,
      recommendedActions: Object.freeze([
        "Review your image and settings, then run again.",
        "Use advanced details only if you need technical diagnostics.",
      ]),
      canRetryNow: false,
    });
  }

  if (
    recovery?.recoveryAction.kind === ImageManipulationRecoveryActionHintKinds.backendRecoveryPending
    || recovery?.retry.retryEligible
  ) {
    return Object.freeze({
      kind: ImageStudioOperationalMessageKinds.waitAndRetryLater,
      summary: input.fallbackSummary,
      recommendedActions: Object.freeze([
        "Refresh readiness and check service availability.",
        "Retry when availability stabilizes.",
      ]),
      canRetryNow,
    });
  }

  if (recovery?.escalation.category === ImageManipulationEscalationCategories.operator) {
    return Object.freeze({
      kind: ImageStudioOperationalMessageKinds.operatorActionRequired,
      summary: input.fallbackSummary,
      recommendedActions: Object.freeze([
        "Retry after operational health improves.",
        "Contact an operator if this continues.",
      ]),
      canRetryNow: false,
    });
  }

  if (
    recovery?.recoveryAction.kind === ImageManipulationRecoveryActionHintKinds.terminalNotRetryable
    || recovery?.escalation.category === ImageManipulationEscalationCategories.admin
  ) {
    return Object.freeze({
      kind: ImageStudioOperationalMessageKinds.terminalFailure,
      summary: input.fallbackSummary,
      recommendedActions: Object.freeze([
        "Reopen setup and verify your latest selections.",
        "Contact support if this keeps happening.",
      ]),
      canRetryNow: false,
    });
  }

  return Object.freeze({
    kind: ImageStudioOperationalMessageKinds.none,
    summary: input.fallbackSummary,
    recommendedActions: Object.freeze([]),
    canRetryNow: false,
  });
}

function resolveIssueKindFromCode(code: string): ImageManipulationIssueKind {
  if (
    code.includes("validation")
    || code.includes("invalid")
    || code.includes("not-found")
    || code.includes("forbidden")
    || code.includes("unauthorized")
    || code.includes("missing")
  ) {
    return ImageManipulationIssueKinds.validation;
  }
  return ImageManipulationIssueKinds.operational;
}

function resolveDispositionFromReason(reason: string): ImageManipulationFailureDisposition {
  if (
    reason.includes("timeout")
    || reason.includes("quota")
    || reason.includes("rate-limit")
    || reason.includes("busy")
    || reason.includes("pending")
    || reason.includes("connect")
    || reason.includes("unavailable")
  ) {
    return ImageManipulationFailureDispositions.retryable;
  }
  if (reason.includes("cancel")) {
    return ImageManipulationFailureDispositions.terminal;
  }
  if (reason.includes("validation") || reason.includes("invalid") || reason.includes("missing")) {
    return ImageManipulationFailureDispositions.terminal;
  }
  return ImageManipulationFailureDispositions.retryable;
}

function resolveSummaryCategoryFromReason(reason: string): ImageManipulationFailureSummaryCategory {
  if (reason.includes("timeout") || reason.includes("rate-limit") || reason.includes("quota")) {
    return ImageManipulationFailureSummaryCategories.timeout;
  }
  if (reason.includes("connect") || reason.includes("unavailable") || reason.includes("offline")) {
    return ImageManipulationFailureSummaryCategories.connectivity;
  }
  if (reason.includes("cancel")) {
    return ImageManipulationFailureSummaryCategories.cancellation;
  }
  if (reason.includes("output") || reason.includes("persist") || reason.includes("preview")) {
    return ImageManipulationFailureSummaryCategories.output;
  }
  if (reason.includes("dependency") || reason.includes("model")) {
    return ImageManipulationFailureSummaryCategories.dependency;
  }
  if (reason.includes("validation") || reason.includes("invalid") || reason.includes("missing")) {
    return ImageManipulationFailureSummaryCategories.validation;
  }
  return ImageManipulationFailureSummaryCategories.execution;
}

function sanitizeReason(code: string): string {
  const normalized = code
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length > 0) {
    return normalized;
  }
  return "unknown";
}

export const ImageStudioFailureMappingLayers = Object.freeze({
  workflowConfiguration: ImageManipulationIssueLayers.workflowConfiguration,
  runReadiness: ImageManipulationIssueLayers.runReadiness,
  executionDispatch: ImageManipulationIssueLayers.executionDispatch,
  resultCollection: ImageManipulationIssueLayers.resultCollection,
  previewGeneration: ImageManipulationIssueLayers.previewGeneration,
  protectedRetrieval: ImageManipulationIssueLayers.protectedRetrieval,
});
