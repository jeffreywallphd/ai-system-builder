import type {
  ImageManipulationIssueClassification,
} from "./ImageManipulationValidationFailureTaxonomy";

export class ImageManipulationResilienceContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageManipulationResilienceContractError";
  }
}

export const ImageManipulationResilienceScopes = Object.freeze({
  authoritativeState: "authoritative-state",
  executionAvailability: "execution-availability",
  nodeEligibility: "node-eligibility",
  resultAvailability: "result-availability",
  previewReadiness: "preview-readiness",
  assetRetrieval: "asset-retrieval",
  backendConnectivity: "backend-connectivity",
} as const);

export type ImageManipulationResilienceScope =
  typeof ImageManipulationResilienceScopes[keyof typeof ImageManipulationResilienceScopes];

export const ImageManipulationResilienceStateKinds = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  partial: "partial",
  pendingRecovery: "pending-recovery",
  blocked: "blocked",
  temporarilyUnavailable: "temporarily-unavailable",
  unavailable: "unavailable",
} as const);

export type ImageManipulationResilienceStateKind =
  typeof ImageManipulationResilienceStateKinds[keyof typeof ImageManipulationResilienceStateKinds];

export const ImageManipulationResilienceDurabilityClasses = Object.freeze({
  temporary: "temporary",
  persistent: "persistent",
  unknown: "unknown",
} as const);

export type ImageManipulationResilienceDurabilityClass =
  typeof ImageManipulationResilienceDurabilityClasses[keyof typeof ImageManipulationResilienceDurabilityClasses];

export const ImageManipulationResilienceRecoveryKinds = Object.freeze({
  none: "none",
  retry: "retry",
  pendingRecovery: "pending-recovery",
  userAction: "user-action",
  operatorAction: "operator-action",
  platformRepair: "platform-repair",
} as const);

export type ImageManipulationResilienceRecoveryKind =
  typeof ImageManipulationResilienceRecoveryKinds[keyof typeof ImageManipulationResilienceRecoveryKinds];

export interface ImageManipulationResilienceRecoveryDescriptor {
  readonly kind: ImageManipulationResilienceRecoveryKind;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly blocking: boolean;
}

export interface ImageManipulationResilienceCondition {
  readonly code: string;
  readonly scope: ImageManipulationResilienceScope;
  readonly state: ImageManipulationResilienceStateKind;
  readonly summary: string;
  readonly detail?: string;
  readonly observedAt: string;
  readonly durability: ImageManipulationResilienceDurabilityClass;
  readonly recovery: ImageManipulationResilienceRecoveryDescriptor;
  readonly classification?: ImageManipulationIssueClassification;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationResilienceSnapshot {
  readonly observedAt: string;
  readonly state: ImageManipulationResilienceStateKind;
  readonly usable: boolean;
  readonly partiallyUsable: boolean;
  readonly conditions: ReadonlyArray<ImageManipulationResilienceCondition>;
  readonly degradedConditions: ReadonlyArray<ImageManipulationResilienceCondition>;
  readonly blockedConditions: ReadonlyArray<ImageManipulationResilienceCondition>;
  readonly unavailableConditions: ReadonlyArray<ImageManipulationResilienceCondition>;
}

export interface ImageManipulationResilienceApiProjection {
  readonly state: ImageManipulationResilienceStateKind;
  readonly usable: boolean;
  readonly partiallyUsable: boolean;
  readonly blockingConditionCodes: ReadonlyArray<string>;
  readonly degradedConditionCodes: ReadonlyArray<string>;
}

export interface ImageManipulationResilienceMonitoringProjection {
  readonly state: ImageManipulationResilienceStateKind;
  readonly conditionCount: number;
  readonly blockedConditionCount: number;
  readonly unavailableConditionCount: number;
  readonly tags: ReadonlyArray<string>;
}

const statePriority: Readonly<Record<ImageManipulationResilienceStateKind, number>> = Object.freeze({
  [ImageManipulationResilienceStateKinds.healthy]: 0,
  [ImageManipulationResilienceStateKinds.degraded]: 1,
  [ImageManipulationResilienceStateKinds.partial]: 2,
  [ImageManipulationResilienceStateKinds.pendingRecovery]: 3,
  [ImageManipulationResilienceStateKinds.blocked]: 4,
  [ImageManipulationResilienceStateKinds.temporarilyUnavailable]: 5,
  [ImageManipulationResilienceStateKinds.unavailable]: 6,
});

export function createImageManipulationResilienceCondition(
  input: {
    readonly code: string;
    readonly scope: ImageManipulationResilienceScope;
    readonly state: ImageManipulationResilienceStateKind;
    readonly summary: string;
    readonly detail?: string;
    readonly observedAt: string;
    readonly durability?: ImageManipulationResilienceDurabilityClass;
    readonly recovery?: Partial<ImageManipulationResilienceRecoveryDescriptor>;
    readonly classification?: ImageManipulationIssueClassification;
    readonly metadata?: Readonly<Record<string, unknown>>;
  },
): ImageManipulationResilienceCondition {
  const code = input.code.trim();
  if (!code) {
    throw new ImageManipulationResilienceContractError("Resilience condition code is required.");
  }

  const summary = input.summary.trim();
  if (!summary) {
    throw new ImageManipulationResilienceContractError("Resilience condition summary is required.");
  }

  return Object.freeze({
    code,
    scope: input.scope,
    state: input.state,
    summary,
    detail: input.detail?.trim() || undefined,
    observedAt: input.observedAt,
    durability: input.durability ?? ImageManipulationResilienceDurabilityClasses.unknown,
    recovery: Object.freeze({
      kind: input.recovery?.kind ?? defaultRecoveryKind(input.state),
      retryable: input.recovery?.retryable ?? defaultRetryable(input.state),
      retryAfterMs: input.recovery?.retryAfterMs,
      blocking: input.recovery?.blocking ?? isImageManipulationResilienceBlockingState(input.state),
    }),
    classification: input.classification,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export function createImageManipulationResilienceSnapshot(input: {
  readonly observedAt: string;
  readonly conditions: ReadonlyArray<ImageManipulationResilienceCondition>;
}): ImageManipulationResilienceSnapshot {
  const sortedConditions = [...input.conditions]
    .sort((left, right) => {
      const stateComparison = statePriority[right.state] - statePriority[left.state];
      if (stateComparison !== 0) {
        return stateComparison;
      }
      return left.code.localeCompare(right.code);
    })
    .map((condition) => Object.freeze({
      ...condition,
      recovery: Object.freeze({ ...condition.recovery }),
      metadata: condition.metadata ? Object.freeze({ ...condition.metadata }) : undefined,
    }));

  const state = sortedConditions[0]?.state ?? ImageManipulationResilienceStateKinds.healthy;
  const blockedConditions = Object.freeze(
    sortedConditions.filter((condition) => isImageManipulationResilienceBlockingState(condition.state)),
  );
  const unavailableConditions = Object.freeze(
    sortedConditions.filter((condition) => isImageManipulationResilienceUnavailableState(condition.state)),
  );
  const degradedConditions = Object.freeze(
    sortedConditions.filter((condition) => condition.state !== ImageManipulationResilienceStateKinds.healthy),
  );
  const usable = blockedConditions.length === 0 && unavailableConditions.length === 0;
  const partiallyUsable = usable && degradedConditions.length > 0;

  return Object.freeze({
    observedAt: input.observedAt,
    state,
    usable,
    partiallyUsable,
    conditions: Object.freeze(sortedConditions),
    degradedConditions,
    blockedConditions,
    unavailableConditions,
  });
}

export function isImageManipulationResilienceBlockingState(state: ImageManipulationResilienceStateKind): boolean {
  return state === ImageManipulationResilienceStateKinds.blocked
    || state === ImageManipulationResilienceStateKinds.temporarilyUnavailable
    || state === ImageManipulationResilienceStateKinds.unavailable;
}

export function isImageManipulationResilienceUnavailableState(state: ImageManipulationResilienceStateKind): boolean {
  return state === ImageManipulationResilienceStateKinds.temporarilyUnavailable
    || state === ImageManipulationResilienceStateKinds.unavailable;
}

export function toImageManipulationResilienceApiProjection(
  snapshot: ImageManipulationResilienceSnapshot,
): ImageManipulationResilienceApiProjection {
  return Object.freeze({
    state: snapshot.state,
    usable: snapshot.usable,
    partiallyUsable: snapshot.partiallyUsable,
    blockingConditionCodes: Object.freeze(snapshot.blockedConditions.map((condition) => condition.code)),
    degradedConditionCodes: Object.freeze(snapshot.degradedConditions.map((condition) => condition.code)),
  });
}

export function toImageManipulationResilienceMonitoringProjection(
  snapshot: ImageManipulationResilienceSnapshot,
): ImageManipulationResilienceMonitoringProjection {
  return Object.freeze({
    state: snapshot.state,
    conditionCount: snapshot.conditions.length,
    blockedConditionCount: snapshot.blockedConditions.length,
    unavailableConditionCount: snapshot.unavailableConditions.length,
    tags: Object.freeze(snapshot.conditions.map((condition) => `${condition.scope}:${condition.state}:${condition.code}`)),
  });
}

function defaultRecoveryKind(state: ImageManipulationResilienceStateKind): ImageManipulationResilienceRecoveryKind {
  switch (state) {
    case ImageManipulationResilienceStateKinds.healthy:
      return ImageManipulationResilienceRecoveryKinds.none;
    case ImageManipulationResilienceStateKinds.degraded:
    case ImageManipulationResilienceStateKinds.partial:
      return ImageManipulationResilienceRecoveryKinds.retry;
    case ImageManipulationResilienceStateKinds.pendingRecovery:
      return ImageManipulationResilienceRecoveryKinds.pendingRecovery;
    case ImageManipulationResilienceStateKinds.blocked:
      return ImageManipulationResilienceRecoveryKinds.operatorAction;
    case ImageManipulationResilienceStateKinds.temporarilyUnavailable:
      return ImageManipulationResilienceRecoveryKinds.retry;
    case ImageManipulationResilienceStateKinds.unavailable:
      return ImageManipulationResilienceRecoveryKinds.platformRepair;
    default:
      return ImageManipulationResilienceRecoveryKinds.none;
  }
}

function defaultRetryable(state: ImageManipulationResilienceStateKind): boolean {
  return state === ImageManipulationResilienceStateKinds.degraded
    || state === ImageManipulationResilienceStateKinds.partial
    || state === ImageManipulationResilienceStateKinds.pendingRecovery
    || state === ImageManipulationResilienceStateKinds.temporarilyUnavailable;
}
