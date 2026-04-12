export const SecurityMaterialRotationVersionStates = Object.freeze({
  active: "active",
  previous: "previous",
  pending: "pending",
});

export type SecurityMaterialRotationVersionState =
  typeof SecurityMaterialRotationVersionStates[keyof typeof SecurityMaterialRotationVersionStates];

export const SecurityMaterialRotationPolicyModes = Object.freeze({
  manual: "manual",
  scheduled: "scheduled",
  onDemand: "on-demand",
  onCompromise: "on-compromise",
});

export type SecurityMaterialRotationPolicyMode =
  typeof SecurityMaterialRotationPolicyModes[keyof typeof SecurityMaterialRotationPolicyModes];

export const SecurityMaterialRotationCutoverStrategies = Object.freeze({
  immediate: "immediate",
  scheduledCutover: "scheduled-cutover",
  dualActiveOverlap: "dual-active-overlap",
});

export type SecurityMaterialRotationCutoverStrategy =
  typeof SecurityMaterialRotationCutoverStrategies[keyof typeof SecurityMaterialRotationCutoverStrategies];

export interface SecurityMaterialRotationVersionContract {
  readonly versionId: string;
  readonly state: SecurityMaterialRotationVersionState;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly predecessorVersionId?: string;
  readonly successorVersionId?: string;
}

export interface SecurityMaterialRotationPolicyMetadata {
  readonly rotationMode: SecurityMaterialRotationPolicyMode;
  readonly cutoverStrategy?: SecurityMaterialRotationCutoverStrategy;
  readonly rotationIntervalDays?: number;
  readonly pendingActivationWindowDays?: number;
  readonly maxActiveOverlapMinutes?: number;
  readonly lastRotatedAt?: string;
  readonly nextRotationDueAt?: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeTimestamp(value: string, field: string): string {
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be an integer >= 1.`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be an integer >= 0.`);
  }
}

function assertOneOf<T extends string>(value: string, allowed: ReadonlyArray<T>, field: string): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`${field} '${value}' is invalid.`);
  }
}

export function createSecurityMaterialRotationVersionContract(
  input: SecurityMaterialRotationVersionContract,
): SecurityMaterialRotationVersionContract {
  const versionId = normalizeRequired(input.versionId, "Security material rotation versionId");
  assertOneOf(
    input.state,
    Object.values(SecurityMaterialRotationVersionStates),
    "Security material rotation version state",
  );
  const effectiveFrom = normalizeTimestamp(
    input.effectiveFrom,
    "Security material rotation effectiveFrom",
  );
  const effectiveUntil = input.effectiveUntil
    ? normalizeTimestamp(input.effectiveUntil, "Security material rotation effectiveUntil")
    : undefined;

  if (effectiveUntil && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)) {
    throw new Error("Security material rotation effectiveUntil must be later than effectiveFrom.");
  }

  const predecessorVersionId = normalizeOptional(input.predecessorVersionId);
  const successorVersionId = normalizeOptional(input.successorVersionId);
  if (predecessorVersionId && predecessorVersionId === versionId) {
    throw new Error("Security material rotation predecessorVersionId cannot match versionId.");
  }
  if (successorVersionId && successorVersionId === versionId) {
    throw new Error("Security material rotation successorVersionId cannot match versionId.");
  }

  return Object.freeze({
    versionId,
    state: input.state,
    effectiveFrom,
    effectiveUntil,
    predecessorVersionId,
    successorVersionId,
  });
}

export function createSecurityMaterialRotationPolicyMetadata(
  input: SecurityMaterialRotationPolicyMetadata,
): SecurityMaterialRotationPolicyMetadata {
  assertOneOf(
    input.rotationMode,
    Object.values(SecurityMaterialRotationPolicyModes),
    "Security material rotation policy mode",
  );
  if (input.cutoverStrategy) {
    assertOneOf(
      input.cutoverStrategy,
      Object.values(SecurityMaterialRotationCutoverStrategies),
      "Security material rotation cutover strategy",
    );
  }
  if (input.rotationIntervalDays !== undefined) {
    assertPositiveInteger(
      input.rotationIntervalDays,
      "Security material rotation policy rotationIntervalDays",
    );
  }
  if (input.pendingActivationWindowDays !== undefined) {
    assertNonNegativeInteger(
      input.pendingActivationWindowDays,
      "Security material rotation policy pendingActivationWindowDays",
    );
  }
  if (input.maxActiveOverlapMinutes !== undefined) {
    assertNonNegativeInteger(
      input.maxActiveOverlapMinutes,
      "Security material rotation policy maxActiveOverlapMinutes",
    );
  }

  const lastRotatedAt = input.lastRotatedAt
    ? normalizeTimestamp(input.lastRotatedAt, "Security material rotation policy lastRotatedAt")
    : undefined;
  const nextRotationDueAt = input.nextRotationDueAt
    ? normalizeTimestamp(input.nextRotationDueAt, "Security material rotation policy nextRotationDueAt")
    : undefined;
  if (lastRotatedAt && nextRotationDueAt && Date.parse(nextRotationDueAt) <= Date.parse(lastRotatedAt)) {
    throw new Error("Security material rotation policy nextRotationDueAt must be later than lastRotatedAt.");
  }

  return Object.freeze({
    rotationMode: input.rotationMode,
    cutoverStrategy: input.cutoverStrategy,
    rotationIntervalDays: input.rotationIntervalDays,
    pendingActivationWindowDays: input.pendingActivationWindowDays,
    maxActiveOverlapMinutes: input.maxActiveOverlapMinutes,
    lastRotatedAt,
    nextRotationDueAt,
  });
}
