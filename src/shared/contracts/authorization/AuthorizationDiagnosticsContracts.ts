import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  RuntimeAvailabilityBlockingDependencyCategory,
  RuntimeAvailabilityBlockingReasonCode,
  RuntimeAvailabilityState,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";
import {
  AuthorizationDiagnosticProvenanceStages,
  type AuthorizationDiagnosticProvenanceStage,
  type AuthorizationDiagnosticReasonCode,
  isKnownAuthorizationDiagnosticReasonCode,
} from "./AuthorizationDiagnosticCatalogs";
export {
  AuthorizationDecisionDenialReasonCodes,
  AuthorizationDecisionReasonCodes,
  AuthorizationDiagnosticProvenanceStages,
  AuthorizationDiagnosticReasonCodes,
  AuthorizationRuntimeAvailabilityReasonCodes,
  AuthorizationTransportMappingReasonCodes,
  isKnownAuthorizationDiagnosticReasonCode,
} from "./AuthorizationDiagnosticCatalogs";
export type {
  AuthorizationDecisionDenialReasonCode,
  AuthorizationDecisionReasonCode,
  AuthorizationDiagnosticProvenanceStage,
  AuthorizationDiagnosticReasonCode,
  AuthorizationRuntimeAvailabilityReasonCode,
  AuthorizationTransportMappingReasonCode,
} from "./AuthorizationDiagnosticCatalogs";

const SensitiveKeyPattern = /(secret|token|password|credential|private[-_]?key|public[-_]?key|api[-_]?key|authorization|bearer|session|cookie|raw|payload|prompt|completion|transcript|message|instruction|content|path|file|directory|uri|url|connection[-_]?string|database[-_]?url|access[-_]?key)/i;
const SensitiveValuePattern = /(bearer\s+[A-Za-z0-9._-]+|-----BEGIN [A-Z ]+-----|[A-Za-z]:\\[^\s]+|\/(?:[^\s/]+\/)+[^\s]*)/i;

export class AuthorizationDiagnosticContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationDiagnosticContractError";
  }
}

export const AuthorizationDiagnosticContractVersions = Object.freeze({
  v1: "authorization-diagnostic/v1",
} as const);

export type AuthorizationDiagnosticContractVersion =
  typeof AuthorizationDiagnosticContractVersions[keyof typeof AuthorizationDiagnosticContractVersions];

export const AuthorizationDiagnosticTargetKinds = Object.freeze({
  resourceInstance: "resource-instance",
  workspaceCapability: "workspace-capability",
  unresolved: "unresolved",
} as const);

export type AuthorizationDiagnosticTargetKind =
  typeof AuthorizationDiagnosticTargetKinds[keyof typeof AuthorizationDiagnosticTargetKinds];

export const AuthorizationDiagnosticMatchedSourceKinds = Object.freeze({
  explicitDeny: "explicit-deny",
  ownerOverride: "owner-override",
  roleGrant: "role-grant",
  permissionGrant: "permission-grant",
  sharingGrant: "sharing-grant",
  visibilityRule: "visibility-rule",
  none: "none",
  notEvaluated: "not-evaluated",
} as const);

export type AuthorizationDiagnosticMatchedSourceKind =
  typeof AuthorizationDiagnosticMatchedSourceKinds[keyof typeof AuthorizationDiagnosticMatchedSourceKinds];

export const AuthorizationDiagnosticOutcomes = Object.freeze({
  allow: "allow",
  deny: "deny",
  unavailable: "unavailable",
  degraded: "degraded",
} as const);

export type AuthorizationDiagnosticOutcome =
  typeof AuthorizationDiagnosticOutcomes[keyof typeof AuthorizationDiagnosticOutcomes];

export const AuthorizationDiagnosticEvidenceKinds = Object.freeze({
  actorMembershipUnavailable: "actor-membership-unavailable",
  roleAssignmentsUnavailable: "role-assignments-unavailable",
  permissionGrantsUnavailable: "permission-grants-unavailable",
  sharingGrantsUnavailable: "sharing-grants-unavailable",
  resourcePolicyUnavailable: "resource-policy-unavailable",
  runtimeReadinessUnavailable: "runtime-readiness-unavailable",
  upstreamFailure: "upstream-failure",
} as const);

export type AuthorizationDiagnosticEvidenceKind =
  typeof AuthorizationDiagnosticEvidenceKinds[keyof typeof AuthorizationDiagnosticEvidenceKinds];

export const AuthorizationDiagnosticEmissionSurfaces = Object.freeze({
  internal: "internal",
  external: "external",
} as const);

export type AuthorizationDiagnosticEmissionSurface =
  typeof AuthorizationDiagnosticEmissionSurfaces[keyof typeof AuthorizationDiagnosticEmissionSurfaces];

export const AuthorizationDenialProvenanceStages = AuthorizationDiagnosticProvenanceStages;

export type AuthorizationDenialProvenanceStage =
  AuthorizationDiagnosticProvenanceStage;

export interface AuthorizationDiagnosticCorrelation {
  readonly requestId?: string;
  readonly correlationId?: string;
}

export interface AuthorizationDiagnosticActor {
  readonly actorIdentityId?: string;
  readonly actorActiveWorkspaceId?: string;
}

export interface AuthorizationDiagnosticTarget {
  readonly kind: AuthorizationDiagnosticTargetKind;
  readonly targetIdentifier?: string;
  readonly targetWorkspaceId?: string;
  readonly targetResourceFamily?: AuthorizationResourceFamily;
  readonly targetResourceType?: string;
}

export interface AuthorizationDiagnosticCounts {
  readonly roleAssignmentCount?: number;
  readonly permissionGrantCount?: number;
  readonly sharingGrantCount?: number;
  readonly sharingPolicyMetadataCount?: number;
  readonly applicableScopeCount?: number;
}

export interface AuthorizationRuntimeAvailabilityDiagnostic {
  readonly affectedByRuntimeAvailability: boolean;
  readonly degraded: boolean;
  readonly runtimeState?: RuntimeAvailabilityState;
  readonly blockingReasonCodes?: ReadonlyArray<RuntimeAvailabilityBlockingReasonCode | string>;
  readonly dependencyCategory?: RuntimeAvailabilityBlockingDependencyCategory | string;
  readonly detail?: string;
}

export interface AuthorizationDiagnosticEvidence {
  readonly roleAssignmentIds?: ReadonlyArray<string>;
  readonly permissionGrantIds?: ReadonlyArray<string>;
  readonly sharingGrantIds?: ReadonlyArray<string>;
  readonly missing?: ReadonlyArray<AuthorizationDiagnosticEvidenceKind | string>;
}

export interface AuthorizationDiagnosticRecord {
  readonly contractVersion: AuthorizationDiagnosticContractVersion;
  readonly observedAt: string;
  readonly outcome: AuthorizationDiagnosticOutcome;
  readonly correlation: AuthorizationDiagnosticCorrelation;
  readonly actor: AuthorizationDiagnosticActor;
  readonly target: AuthorizationDiagnosticTarget;
  readonly requiredPermissionKey?: string;
  readonly counts: AuthorizationDiagnosticCounts;
  readonly matchedSourceKind?: AuthorizationDiagnosticMatchedSourceKind;
  readonly reasonCode: AuthorizationDiagnosticReasonCode;
  readonly denialProvenanceStage: AuthorizationDenialProvenanceStage;
  readonly runtimeAvailability?: AuthorizationRuntimeAvailabilityDiagnostic;
  readonly evidence?: AuthorizationDiagnosticEvidence;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface AuthorizationDiagnosticProjectionOptions {
  readonly surface: AuthorizationDiagnosticEmissionSurface;
  readonly maxIdentifierCount?: number;
  readonly includeIdentifiers?: boolean;
  readonly secretSensitiveSurface?: boolean;
  readonly adminSensitiveSurface?: boolean;
}

interface CreateAuthorizationDiagnosticRecordInput {
  readonly observedAt?: string;
  readonly outcome: AuthorizationDiagnosticOutcome;
  readonly correlation: AuthorizationDiagnosticCorrelation;
  readonly actor?: AuthorizationDiagnosticActor;
  readonly target: AuthorizationDiagnosticTarget;
  readonly requiredPermissionKey?: string;
  readonly counts?: AuthorizationDiagnosticCounts;
  readonly matchedSourceKind?: AuthorizationDiagnosticMatchedSourceKind;
  readonly reasonCode: AuthorizationDiagnosticReasonCode | string;
  readonly denialProvenanceStage: AuthorizationDenialProvenanceStage;
  readonly runtimeAvailability?: AuthorizationRuntimeAvailabilityDiagnostic;
  readonly evidence?: AuthorizationDiagnosticEvidence;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

const StagesRequiringEvaluationEvidence = new Set<AuthorizationDiagnosticProvenanceStage>([
  AuthorizationDiagnosticProvenanceStages.useCase,
  AuthorizationDiagnosticProvenanceStages.evaluator,
  AuthorizationDiagnosticProvenanceStages.evaluatorResolution,
  AuthorizationDiagnosticProvenanceStages.finalDecisionEmission,
  AuthorizationDiagnosticProvenanceStages.adapter,
]);

const MatchedSourceKindsForAllow = new Set<AuthorizationDiagnosticMatchedSourceKind>([
  AuthorizationDiagnosticMatchedSourceKinds.ownerOverride,
  AuthorizationDiagnosticMatchedSourceKinds.roleGrant,
  AuthorizationDiagnosticMatchedSourceKinds.permissionGrant,
  AuthorizationDiagnosticMatchedSourceKinds.sharingGrant,
  AuthorizationDiagnosticMatchedSourceKinds.visibilityRule,
]);

export function createAuthorizationDiagnosticRecord(
  input: CreateAuthorizationDiagnosticRecordInput,
): AuthorizationDiagnosticRecord {
  const observedAt = normalizeIsoTimestamp(input.observedAt ?? new Date().toISOString(), "Authorization diagnostic observedAt");
  const correlation = normalizeCorrelation(input.correlation);
  const target = normalizeTarget(input.target);
  const runtimeAvailability = normalizeRuntimeAvailability(input.runtimeAvailability);
  const evidence = normalizeEvidence(input.evidence);

  const record = Object.freeze({
    contractVersion: AuthorizationDiagnosticContractVersions.v1,
    observedAt,
    outcome: input.outcome,
    correlation,
    actor: normalizeActor(input.actor),
    target,
    requiredPermissionKey: normalizeOptional(input.requiredPermissionKey),
    counts: normalizeCounts(input.counts),
    matchedSourceKind: input.matchedSourceKind,
    reasonCode: normalizeReasonCode(input.reasonCode),
    denialProvenanceStage: input.denialProvenanceStage,
    runtimeAvailability,
    evidence,
    extensions: normalizeExtensions(input.extensions),
  } satisfies AuthorizationDiagnosticRecord);

  validateDiagnosticCompleteness(record);
  return record;
}

export function projectAuthorizationDiagnosticRecord(
  record: AuthorizationDiagnosticRecord,
  options: AuthorizationDiagnosticProjectionOptions,
): AuthorizationDiagnosticRecord {
  const maxIdentifierCount = normalizeIdentifierLimit(options.maxIdentifierCount);
  const shouldIncludeIdentifiers = options.surface === AuthorizationDiagnosticEmissionSurfaces.internal
    ? options.includeIdentifiers !== false
    : false;
  const sensitiveBoundary = options.secretSensitiveSurface === true || options.adminSensitiveSurface === true;

  const projectedEvidence = projectEvidence(record.evidence, {
    includeIdentifiers: shouldIncludeIdentifiers,
    maxIdentifierCount,
  });

  const projectedRuntimeAvailability = record.runtimeAvailability
    ? Object.freeze({
      ...record.runtimeAvailability,
      detail: sanitizeFreeText(record.runtimeAvailability.detail),
    })
    : undefined;

  const projectedActor = options.surface === AuthorizationDiagnosticEmissionSurfaces.external
    ? Object.freeze({
      actorIdentityId: undefined,
      actorActiveWorkspaceId: undefined,
    })
    : record.actor;

  const projectedTarget = options.surface === AuthorizationDiagnosticEmissionSurfaces.external
    ? Object.freeze({
      kind: record.target.kind,
      targetIdentifier: undefined,
      targetWorkspaceId: sensitiveBoundary ? undefined : record.target.targetWorkspaceId,
      targetResourceFamily: record.target.targetResourceFamily,
      targetResourceType: sensitiveBoundary ? undefined : record.target.targetResourceType,
    })
    : record.target;

  const projectedExtensions = options.surface === AuthorizationDiagnosticEmissionSurfaces.external
    ? filterExtensionsForExternal(record.extensions, sensitiveBoundary)
    : sanitizeExtensionValues(record.extensions);

  return Object.freeze({
    ...record,
    actor: projectedActor,
    target: projectedTarget,
    requiredPermissionKey: options.surface === AuthorizationDiagnosticEmissionSurfaces.external && sensitiveBoundary
      ? undefined
      : record.requiredPermissionKey,
    runtimeAvailability: projectedRuntimeAvailability,
    evidence: projectedEvidence,
    extensions: projectedExtensions,
  });
}

function validateDiagnosticCompleteness(record: AuthorizationDiagnosticRecord): void {
  if (
    (record.outcome === AuthorizationDiagnosticOutcomes.allow || record.outcome === AuthorizationDiagnosticOutcomes.deny)
    && !record.requiredPermissionKey
  ) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostics for allow/deny outcomes must include requiredPermissionKey.",
    );
  }

  if (record.outcome === AuthorizationDiagnosticOutcomes.allow) {
    if (!record.matchedSourceKind || !MatchedSourceKindsForAllow.has(record.matchedSourceKind)) {
      throw new AuthorizationDiagnosticContractError(
        "Authorization allow diagnostics must include a matchedSourceKind that identifies the effective authorization source.",
      );
    }
  }

  if (record.outcome === AuthorizationDiagnosticOutcomes.deny && !record.matchedSourceKind) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization deny diagnostics must include matchedSourceKind (use 'none' when no source matched).",
    );
  }

  if (
    (record.outcome === AuthorizationDiagnosticOutcomes.unavailable || record.outcome === AuthorizationDiagnosticOutcomes.degraded)
    && (!record.runtimeAvailability || !record.runtimeAvailability.affectedByRuntimeAvailability)
  ) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization unavailable/degraded diagnostics must include runtimeAvailability with affectedByRuntimeAvailability=true.",
    );
  }

  if (StagesRequiringEvaluationEvidence.has(record.denialProvenanceStage)) {
    assertEvidenceForEvaluationStage(record);
  }
}

function assertEvidenceForEvaluationStage(record: AuthorizationDiagnosticRecord): void {
  const hasRoleEvidence = record.counts.roleAssignmentCount !== undefined || !!record.evidence?.roleAssignmentIds;
  const hasPermissionEvidence = record.counts.permissionGrantCount !== undefined || !!record.evidence?.permissionGrantIds;
  const hasSharingEvidence = record.counts.sharingGrantCount !== undefined || !!record.evidence?.sharingGrantIds;
  const missing = new Set(record.evidence?.missing ?? []);

  if (!hasRoleEvidence && !missing.has(AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable)) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostics missing role-assignment evidence. Emit counts/ids or declare role-assignments-unavailable.",
    );
  }
  if (!hasPermissionEvidence && !missing.has(AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable)) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostics missing permission-grant evidence. Emit counts/ids or declare permission-grants-unavailable.",
    );
  }
  if (!hasSharingEvidence && !missing.has(AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable)) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostics missing sharing-grant evidence. Emit counts/ids or declare sharing-grants-unavailable.",
    );
  }
}

function normalizeReasonCode(value: string): AuthorizationDiagnosticReasonCode {
  const normalized = normalizeRequired(value, "Authorization diagnostic reasonCode");
  if (isKnownAuthorizationDiagnosticReasonCode(normalized)) {
    return normalized;
  }
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/.test(normalized)) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostic reasonCode must be a known catalog value or a stable namespaced code.",
    );
  }
  return normalized as AuthorizationDiagnosticReasonCode;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AuthorizationDiagnosticContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new AuthorizationDiagnosticContractError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeCorrelation(value: AuthorizationDiagnosticCorrelation): AuthorizationDiagnosticCorrelation {
  const requestId = normalizeOptional(value.requestId);
  const correlationId = normalizeOptional(value.correlationId);
  if (!requestId && !correlationId) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostic correlation.requestId or correlation.correlationId is required.",
    );
  }
  return Object.freeze({
    requestId,
    correlationId,
  });
}

function normalizeActor(value: AuthorizationDiagnosticActor | undefined): AuthorizationDiagnosticActor {
  return Object.freeze({
    actorIdentityId: normalizeOptional(value?.actorIdentityId),
    actorActiveWorkspaceId: normalizeOptional(value?.actorActiveWorkspaceId),
  });
}

function normalizeTarget(value: AuthorizationDiagnosticTarget): AuthorizationDiagnosticTarget {
  const targetIdentifier = normalizeOptional(value.targetIdentifier);
  const targetWorkspaceId = normalizeOptional(value.targetWorkspaceId);
  const targetResourceType = normalizeOptional(value.targetResourceType);

  if (value.kind === AuthorizationDiagnosticTargetKinds.resourceInstance && !targetIdentifier) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostic target.targetIdentifier is required for kind='resource-instance'.",
    );
  }

  if (value.kind === AuthorizationDiagnosticTargetKinds.workspaceCapability && !targetWorkspaceId) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization diagnostic target.targetWorkspaceId is required for kind='workspace-capability'.",
    );
  }

  return Object.freeze({
    kind: value.kind,
    targetIdentifier,
    targetWorkspaceId,
    targetResourceFamily: value.targetResourceFamily,
    targetResourceType,
  });
}

function normalizeCount(value: number | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new AuthorizationDiagnosticContractError(`${field} must be a non-negative finite number.`);
  }
  return Math.floor(value);
}

function normalizeCounts(value: AuthorizationDiagnosticCounts | undefined): AuthorizationDiagnosticCounts {
  return Object.freeze({
    roleAssignmentCount: normalizeCount(value?.roleAssignmentCount, "Authorization diagnostic roleAssignmentCount"),
    permissionGrantCount: normalizeCount(value?.permissionGrantCount, "Authorization diagnostic permissionGrantCount"),
    sharingGrantCount: normalizeCount(value?.sharingGrantCount, "Authorization diagnostic sharingGrantCount"),
    sharingPolicyMetadataCount: normalizeCount(
      value?.sharingPolicyMetadataCount,
      "Authorization diagnostic sharingPolicyMetadataCount",
    ),
    applicableScopeCount: normalizeCount(value?.applicableScopeCount, "Authorization diagnostic applicableScopeCount"),
  });
}

function normalizeRuntimeAvailability(
  value: AuthorizationRuntimeAvailabilityDiagnostic | undefined,
): AuthorizationRuntimeAvailabilityDiagnostic | undefined {
  if (!value) {
    return undefined;
  }

  const blockingReasonCodes = value.blockingReasonCodes
    ? Object.freeze(value.blockingReasonCodes
      .map((entry) => normalizeRequired(String(entry), "Authorization runtime availability blocking reason code")))
    : undefined;

  const detail = normalizeOptional(value.detail);
  const dependencyCategory = normalizeOptional(value.dependencyCategory ? String(value.dependencyCategory) : undefined);

  if (
    value.affectedByRuntimeAvailability
    && !value.runtimeState
    && !blockingReasonCodes?.length
    && !dependencyCategory
    && !detail
  ) {
    throw new AuthorizationDiagnosticContractError(
      "Authorization runtime availability diagnostics marked as affected must include runtime state, reason code, dependency category, or detail.",
    );
  }

  return Object.freeze({
    affectedByRuntimeAvailability: value.affectedByRuntimeAvailability,
    degraded: value.degraded,
    runtimeState: value.runtimeState,
    blockingReasonCodes,
    dependencyCategory,
    detail,
  });
}

function normalizeEvidence(value: AuthorizationDiagnosticEvidence | undefined): AuthorizationDiagnosticEvidence | undefined {
  if (!value) {
    return undefined;
  }

  return Object.freeze({
    roleAssignmentIds: normalizeIdentifiers(value.roleAssignmentIds, "roleAssignmentIds"),
    permissionGrantIds: normalizeIdentifiers(value.permissionGrantIds, "permissionGrantIds"),
    sharingGrantIds: normalizeIdentifiers(value.sharingGrantIds, "sharingGrantIds"),
    missing: value.missing
      ? Object.freeze(value.missing.map((entry) => normalizeRequired(String(entry), "Authorization diagnostic evidence missing")))
      : undefined,
  });
}

function normalizeIdentifiers(values: ReadonlyArray<string> | undefined, label: string): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = values
    .map((entry) => normalizeRequired(entry, `Authorization diagnostic ${label} entry`))
    .filter((entry, index, all) => all.indexOf(entry) === index);

  return Object.freeze(normalized);
}

function normalizeExtensions(
  value: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeRequired(key, "Authorization diagnostic extension key").toLowerCase();
    if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/.test(normalizedKey)) {
      throw new AuthorizationDiagnosticContractError(
        `Authorization diagnostic extension key '${key}' is invalid. Use namespaced keys like 'team.feature'.`,
      );
    }
    normalized[normalizedKey] = entry;
  }

  return Object.freeze(normalized);
}

function normalizeIdentifierLimit(value: number | undefined): number {
  if (value === undefined) {
    return 25;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new AuthorizationDiagnosticContractError("Authorization diagnostic maxIdentifierCount must be a non-negative finite number.");
  }
  return Math.floor(value);
}

function projectEvidence(
  evidence: AuthorizationDiagnosticEvidence | undefined,
  options: {
    readonly includeIdentifiers: boolean;
    readonly maxIdentifierCount: number;
  },
): AuthorizationDiagnosticEvidence | undefined {
  if (!evidence) {
    return undefined;
  }

  return Object.freeze({
    roleAssignmentIds: options.includeIdentifiers
      ? clampIdentifiers(evidence.roleAssignmentIds, options.maxIdentifierCount)
      : undefined,
    permissionGrantIds: options.includeIdentifiers
      ? clampIdentifiers(evidence.permissionGrantIds, options.maxIdentifierCount)
      : undefined,
    sharingGrantIds: options.includeIdentifiers
      ? clampIdentifiers(evidence.sharingGrantIds, options.maxIdentifierCount)
      : undefined,
    missing: evidence.missing,
  });
}

function clampIdentifiers(
  values: ReadonlyArray<string> | undefined,
  maxIdentifierCount: number,
): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }
  return Object.freeze(values.slice(0, maxIdentifierCount));
}

function filterExtensionsForExternal(
  extensions: Readonly<Record<string, unknown>> | undefined,
  sensitiveBoundary: boolean,
): Readonly<Record<string, unknown>> | undefined {
  if (!extensions) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extensions)) {
    if (sensitiveBoundary) {
      continue;
    }
    if (SensitiveKeyPattern.test(key)) {
      continue;
    }
    if (key.endsWith(".public") || key.endsWith(":public")) {
      output[key] = sanitizeUnknown(value);
    }
  }

  if (Object.keys(output).length === 0) {
    return undefined;
  }
  return Object.freeze(output);
}

function sanitizeExtensionValues(
  extensions: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!extensions) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extensions)) {
    output[key] = SensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitizeUnknown(value);
  }

  return Object.freeze(output);
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeFreeText(value);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => sanitizeUnknown(entry)));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SensitiveKeyPattern.test(key)
      ? "[REDACTED]"
      : sanitizeUnknown(nested);
  }
  return Object.freeze(output);
}

function sanitizeFreeText(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  if (SensitiveValuePattern.test(normalized)) {
    return "[REDACTED]";
  }
  return normalized;
}
