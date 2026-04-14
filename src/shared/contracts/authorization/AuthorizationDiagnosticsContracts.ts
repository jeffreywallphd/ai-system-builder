import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  RuntimeAvailabilityBlockingDependencyCategory,
  RuntimeAvailabilityBlockingReasonCode,
  RuntimeAvailabilityState,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";

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

export const AuthorizationDenialProvenanceStages = Object.freeze({
  route: "route",
  api: "api",
  useCase: "use-case",
  evaluator: "evaluator",
  adapter: "adapter",
  runtimeReadiness: "runtime-readiness",
} as const);

export type AuthorizationDenialProvenanceStage =
  typeof AuthorizationDenialProvenanceStages[keyof typeof AuthorizationDenialProvenanceStages];

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

export interface AuthorizationDiagnosticRecord {
  readonly contractVersion: AuthorizationDiagnosticContractVersion;
  readonly observedAt: string;
  readonly correlation: AuthorizationDiagnosticCorrelation;
  readonly actor: AuthorizationDiagnosticActor;
  readonly target: AuthorizationDiagnosticTarget;
  readonly requiredPermissionKey?: string;
  readonly counts: AuthorizationDiagnosticCounts;
  readonly matchedSourceKind?: AuthorizationDiagnosticMatchedSourceKind;
  readonly reasonCode: string;
  readonly denialProvenanceStage: AuthorizationDenialProvenanceStage;
  readonly runtimeAvailability?: AuthorizationRuntimeAvailabilityDiagnostic;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

interface CreateAuthorizationDiagnosticRecordInput {
  readonly observedAt?: string;
  readonly correlation: AuthorizationDiagnosticCorrelation;
  readonly actor?: AuthorizationDiagnosticActor;
  readonly target: AuthorizationDiagnosticTarget;
  readonly requiredPermissionKey?: string;
  readonly counts?: AuthorizationDiagnosticCounts;
  readonly matchedSourceKind?: AuthorizationDiagnosticMatchedSourceKind;
  readonly reasonCode: string;
  readonly denialProvenanceStage: AuthorizationDenialProvenanceStage;
  readonly runtimeAvailability?: AuthorizationRuntimeAvailabilityDiagnostic;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export function createAuthorizationDiagnosticRecord(
  input: CreateAuthorizationDiagnosticRecordInput,
): AuthorizationDiagnosticRecord {
  const observedAt = normalizeIsoTimestamp(input.observedAt ?? new Date().toISOString(), "Authorization diagnostic observedAt");
  const correlation = normalizeCorrelation(input.correlation);
  const target = normalizeTarget(input.target);
  const runtimeAvailability = normalizeRuntimeAvailability(input.runtimeAvailability);

  return Object.freeze({
    contractVersion: AuthorizationDiagnosticContractVersions.v1,
    observedAt,
    correlation,
    actor: normalizeActor(input.actor),
    target,
    requiredPermissionKey: normalizeOptional(input.requiredPermissionKey),
    counts: normalizeCounts(input.counts),
    matchedSourceKind: input.matchedSourceKind,
    reasonCode: normalizeRequired(input.reasonCode, "Authorization diagnostic reasonCode"),
    denialProvenanceStage: input.denialProvenanceStage,
    runtimeAvailability,
    extensions: normalizeExtensions(input.extensions),
  });
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
