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
  readonly temporary: boolean;
  readonly statusSummary: string;
  readonly actionNow: "wait" | "retry" | "adjust-configuration" | "contact-operator" | "contact-admin" | "none";
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
  const statusContext = resolveOperationalStatusContext(classification);
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
      temporary: false,
      statusSummary: "Configuration needs adjustments before retry.",
      actionNow: "adjust-configuration",
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
      temporary: false,
      statusSummary: "Configuration needs adjustments before retry.",
      actionNow: "adjust-configuration",
    });
  }

  if (
    recovery?.recoveryAction.kind === ImageManipulationRecoveryActionHintKinds.backendRecoveryPending
    || recovery?.retry.retryEligible
  ) {
    return Object.freeze({
      kind: ImageStudioOperationalMessageKinds.waitAndRetryLater,
      summary: input.fallbackSummary,
      recommendedActions: Object.freeze(resolveRetryLaterActions(statusContext)),
      canRetryNow,
      temporary: true,
      statusSummary: statusContext.statusSummary,
      actionNow: canRetryNow ? "retry" : "wait",
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
      temporary: statusContext.category !== "outage",
      statusSummary: statusContext.statusSummary,
      actionNow: "contact-operator",
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
      temporary: false,
      statusSummary: "The current failure is not automatically recoverable.",
      actionNow: recovery?.escalation.category === ImageManipulationEscalationCategories.admin
        ? "contact-admin"
        : "none",
    });
  }

  return Object.freeze({
    kind: ImageStudioOperationalMessageKinds.none,
    summary: input.fallbackSummary,
    recommendedActions: Object.freeze([]),
    canRetryNow: false,
    temporary: false,
    statusSummary: "No operational recovery action is currently required.",
    actionNow: "none",
  });
}

type OperationalStatusCategory =
  | "general"
  | "no-eligible-node"
  | "backend-degraded"
  | "outage"
  | "preview-delayed";

function resolveOperationalStatusContext(
  classification: ImageManipulationIssueClassification | undefined,
): {
  readonly category: OperationalStatusCategory;
  readonly statusSummary: string;
} {
  const reason = classification?.issueCode?.toLowerCase() ?? "";
  if (reason.includes("execution-node-no-eligible-match")) {
    return Object.freeze({
      category: "no-eligible-node",
      statusSummary: "Workflow is valid, but no eligible execution node is currently available.",
    });
  }
  if (reason.includes("execution-node-candidates-unavailable")) {
    return Object.freeze({
      category: "outage",
      statusSummary: "Execution nodes are temporarily unavailable.",
    });
  }
  if (reason.includes("backend-degraded") || reason.includes("execution-degraded")) {
    return Object.freeze({
      category: "backend-degraded",
      statusSummary: "Backend is available with degraded capacity.",
    });
  }
  if (
    reason.includes("backend-unavailable")
    || reason.includes("timeout")
    || reason.includes("connect")
    || reason.includes("unavailable")
    || reason.includes("offline")
  ) {
    return Object.freeze({
      category: "outage",
      statusSummary: "Execution backend is temporarily unavailable.",
    });
  }
  if (
    reason.includes("preview")
    && (reason.includes("pending") || reason.includes("delay") || reason.includes("timeout") || reason.includes("unavailable"))
  ) {
    return Object.freeze({
      category: "preview-delayed",
      statusSummary: "Result preview service is delayed; result records may still be available.",
    });
  }
  return Object.freeze({
    category: "general",
    statusSummary: "Operational availability requires verification before retry.",
  });
}

function resolveRetryLaterActions(input: {
  readonly category: OperationalStatusCategory;
}): ReadonlyArray<string> {
  if (input.category === "no-eligible-node") {
    return Object.freeze([
      "Wait for node availability or adjust execution settings.",
      "Retry after checking readiness again.",
    ]);
  }
  if (input.category === "preview-delayed") {
    return Object.freeze([
      "Wait for preview processing to finish.",
      "Refresh results to load preview updates.",
    ]);
  }
  if (input.category === "backend-degraded") {
    return Object.freeze([
      "You can continue, but expect slower or partial backend behavior.",
      "Retry if quality or completion is impacted.",
    ]);
  }
  return Object.freeze([
    "Refresh readiness and check service availability.",
    "Retry when availability stabilizes.",
  ]);
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
