import {
  ImageManipulationFailureDispositions,
  ImageManipulationIssueResolutionActors,
  type ImageManipulationIssueClassification,
} from "./ImageManipulationValidationFailureTaxonomy";
import {
  ImageManipulationResilienceRecoveryKinds,
  ImageManipulationResilienceStateKinds,
  type ImageManipulationResilienceCondition,
  type ImageManipulationResilienceSnapshot,
  type ImageManipulationResilienceStateKind,
} from "./ImageManipulationResilienceStateContracts";

export class ImageManipulationRetryRecoveryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageManipulationRetryRecoveryContractError";
  }
}

export const ImageManipulationRetryModes = Object.freeze({
  none: "none",
  automatic: "automatic",
  manual: "manual",
} as const);

export type ImageManipulationRetryMode =
  typeof ImageManipulationRetryModes[keyof typeof ImageManipulationRetryModes];

export const ImageManipulationRecoveryActionHintKinds = Object.freeze({
  none: "none",
  retryAutomatic: "retry-automatic",
  retryManual: "retry-manual",
  userActionRequired: "user-action-required",
  backendRecoveryPending: "backend-recovery-pending",
  terminalNotRetryable: "terminal-not-retryable",
} as const);

export type ImageManipulationRecoveryActionHintKind =
  typeof ImageManipulationRecoveryActionHintKinds[keyof typeof ImageManipulationRecoveryActionHintKinds];

export const ImageManipulationEscalationCategories = Object.freeze({
  none: "none",
  operator: "operator",
  admin: "admin",
} as const);

export type ImageManipulationEscalationCategory =
  typeof ImageManipulationEscalationCategories[keyof typeof ImageManipulationEscalationCategories];

export interface ImageManipulationRetryAdvice {
  readonly retryEligible: boolean;
  readonly retrySafe: boolean;
  readonly retryMode: ImageManipulationRetryMode;
  readonly retryAfterMs?: number;
}

export interface ImageManipulationRecoveryActionHint {
  readonly kind: ImageManipulationRecoveryActionHintKind;
  readonly userActionRequired: boolean;
  readonly backendRecoveryPending: boolean;
  readonly terminalNotRetryable: boolean;
  readonly summary: string;
}

export interface ImageManipulationEscalationAdvice {
  readonly category: ImageManipulationEscalationCategory;
  readonly required: boolean;
}

export interface ImageManipulationRetryRecoveryContract {
  readonly retry: ImageManipulationRetryAdvice;
  readonly recoveryAction: ImageManipulationRecoveryActionHint;
  readonly escalation: ImageManipulationEscalationAdvice;
}

export function createImageManipulationRetryRecoveryContract(input: {
  readonly retry: ImageManipulationRetryAdvice;
  readonly recoveryAction: ImageManipulationRecoveryActionHint;
  readonly escalation: ImageManipulationEscalationAdvice;
}): ImageManipulationRetryRecoveryContract {
  if (typeof input.retry.retryAfterMs === "number" && input.retry.retryAfterMs < 0) {
    throw new ImageManipulationRetryRecoveryContractError("retryAfterMs must be >= 0.");
  }

  return Object.freeze({
    retry: Object.freeze({
      retryEligible: input.retry.retryEligible,
      retrySafe: input.retry.retrySafe,
      retryMode: input.retry.retryMode,
      retryAfterMs: input.retry.retryAfterMs,
    }),
    recoveryAction: Object.freeze({
      kind: input.recoveryAction.kind,
      userActionRequired: input.recoveryAction.userActionRequired,
      backendRecoveryPending: input.recoveryAction.backendRecoveryPending,
      terminalNotRetryable: input.recoveryAction.terminalNotRetryable,
      summary: input.recoveryAction.summary.trim(),
    }),
    escalation: Object.freeze({
      category: input.escalation.category,
      required: input.escalation.required,
    }),
  });
}

export function deriveImageManipulationRetryRecoveryContractFromClassification(input: {
  readonly classification?: ImageManipulationIssueClassification;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly resilienceState?: ImageManipulationResilienceStateKind;
}): ImageManipulationRetryRecoveryContract {
  const classification = input.classification;
  const backendRecoveryPending = input.resilienceState === ImageManipulationResilienceStateKinds.pendingRecovery;

  if (classification?.userFixable) {
    return createImageManipulationRetryRecoveryContract({
      retry: {
        retryEligible: false,
        retrySafe: false,
        retryMode: ImageManipulationRetryModes.none,
      },
      recoveryAction: {
        kind: ImageManipulationRecoveryActionHintKinds.userActionRequired,
        userActionRequired: true,
        backendRecoveryPending,
        terminalNotRetryable: true,
        summary: "User correction is required before retrying.",
      },
      escalation: {
        category: ImageManipulationEscalationCategories.none,
        required: false,
      },
    });
  }

  if (backendRecoveryPending) {
    return createImageManipulationRetryRecoveryContract({
      retry: {
        retryEligible: input.retryable,
        retrySafe: input.retryable,
        retryMode: input.retryable ? ImageManipulationRetryModes.manual : ImageManipulationRetryModes.none,
        retryAfterMs: normalizeRetryAfterMs(input.retryAfterMs),
      },
      recoveryAction: {
        kind: ImageManipulationRecoveryActionHintKinds.backendRecoveryPending,
        userActionRequired: false,
        backendRecoveryPending: true,
        terminalNotRetryable: !input.retryable,
        summary: "Backend recovery is pending. Retry after backend health stabilizes.",
      },
      escalation: {
        category: ImageManipulationEscalationCategories.operator,
        required: true,
      },
    });
  }

  if (input.retryable) {
    const automaticRetry = classification?.disposition === ImageManipulationFailureDispositions.retryable && !classification.userFixable;
    return createImageManipulationRetryRecoveryContract({
      retry: {
        retryEligible: true,
        retrySafe: true,
        retryMode: automaticRetry ? ImageManipulationRetryModes.automatic : ImageManipulationRetryModes.manual,
        retryAfterMs: normalizeRetryAfterMs(input.retryAfterMs),
      },
      recoveryAction: {
        kind: automaticRetry
          ? ImageManipulationRecoveryActionHintKinds.retryAutomatic
          : ImageManipulationRecoveryActionHintKinds.retryManual,
        userActionRequired: false,
        backendRecoveryPending: false,
        terminalNotRetryable: false,
        summary: automaticRetry ? "Automatic retry is allowed." : "Manual retry is allowed.",
      },
      escalation: {
        category: ImageManipulationEscalationCategories.none,
        required: false,
      },
    });
  }

  const escalationCategory = classification?.resolutionActor === ImageManipulationIssueResolutionActors.platform
    ? ImageManipulationEscalationCategories.admin
    : classification?.resolutionActor === ImageManipulationIssueResolutionActors.operator
      ? ImageManipulationEscalationCategories.operator
      : ImageManipulationEscalationCategories.none;

  return createImageManipulationRetryRecoveryContract({
    retry: {
      retryEligible: false,
      retrySafe: false,
      retryMode: ImageManipulationRetryModes.none,
    },
    recoveryAction: {
      kind: ImageManipulationRecoveryActionHintKinds.terminalNotRetryable,
      userActionRequired: false,
      backendRecoveryPending: false,
      terminalNotRetryable: true,
      summary: "The failure is terminal and not retryable.",
    },
    escalation: {
      category: escalationCategory,
      required: escalationCategory !== ImageManipulationEscalationCategories.none,
    },
  });
}

export function deriveImageManipulationRetryRecoveryContractFromResilienceCondition(
  condition: ImageManipulationResilienceCondition,
): ImageManipulationRetryRecoveryContract {
  const retryMode = condition.recovery.retryable
    ? condition.recovery.kind === ImageManipulationResilienceRecoveryKinds.retry
      ? ImageManipulationRetryModes.automatic
      : ImageManipulationRetryModes.manual
    : ImageManipulationRetryModes.none;
  const backendRecoveryPending = condition.recovery.kind === ImageManipulationResilienceRecoveryKinds.pendingRecovery
    || condition.state === ImageManipulationResilienceStateKinds.pendingRecovery;
  const userActionRequired = condition.recovery.kind === ImageManipulationResilienceRecoveryKinds.userAction;
  const terminalNotRetryable = !condition.recovery.retryable
    && condition.state === ImageManipulationResilienceStateKinds.unavailable;

  const escalationCategory = condition.recovery.kind === ImageManipulationResilienceRecoveryKinds.operatorAction
    ? ImageManipulationEscalationCategories.operator
    : condition.recovery.kind === ImageManipulationResilienceRecoveryKinds.platformRepair
      ? ImageManipulationEscalationCategories.admin
      : ImageManipulationEscalationCategories.none;

  return createImageManipulationRetryRecoveryContract({
    retry: {
      retryEligible: condition.recovery.retryable,
      retrySafe: condition.recovery.retryable,
      retryMode,
      retryAfterMs: normalizeRetryAfterMs(condition.recovery.retryAfterMs),
    },
    recoveryAction: {
      kind: backendRecoveryPending
        ? ImageManipulationRecoveryActionHintKinds.backendRecoveryPending
        : userActionRequired
          ? ImageManipulationRecoveryActionHintKinds.userActionRequired
          : terminalNotRetryable
            ? ImageManipulationRecoveryActionHintKinds.terminalNotRetryable
            : retryMode === ImageManipulationRetryModes.automatic
              ? ImageManipulationRecoveryActionHintKinds.retryAutomatic
              : retryMode === ImageManipulationRetryModes.manual
                ? ImageManipulationRecoveryActionHintKinds.retryManual
                : ImageManipulationRecoveryActionHintKinds.none,
      userActionRequired,
      backendRecoveryPending,
      terminalNotRetryable,
      summary: condition.summary,
    },
    escalation: {
      category: escalationCategory,
      required: escalationCategory !== ImageManipulationEscalationCategories.none,
    },
  });
}

export function deriveImageManipulationRetryRecoveryContractFromResilienceSnapshot(
  snapshot: ImageManipulationResilienceSnapshot | undefined,
): ImageManipulationRetryRecoveryContract | undefined {
  const condition = snapshot?.conditions[0];
  if (!condition) {
    return undefined;
  }
  return deriveImageManipulationRetryRecoveryContractFromResilienceCondition(condition);
}

function normalizeRetryAfterMs(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}
