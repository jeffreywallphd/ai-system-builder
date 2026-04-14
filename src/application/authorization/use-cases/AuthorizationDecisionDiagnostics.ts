import type {
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyEvaluationDiagnosticContext,
  AuthorizationPolicyEvaluationTargetKind,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  AuthorizationDiagnosticMatchedSourceKinds,
  AuthorizationDiagnosticTargetKinds,
  createAuthorizationDiagnosticRecord,
  type AuthorizationDiagnosticMatchedSourceKind,
  type AuthorizationDiagnosticOutcome,
  type AuthorizationDiagnosticReasonCode,
  type AuthorizationDiagnosticRecord,
  type AuthorizationDenialProvenanceStage,
} from "@shared/contracts/authorization/AuthorizationDiagnosticsContracts";

export interface AuthorizationDecisionDiagnosticsLogger {
  info(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void;
}

export interface AuthorizationDiagnosticTargetContext {
  readonly targetKind: AuthorizationPolicyEvaluationTargetKind;
  readonly targetIdentifier?: string;
  readonly targetWorkspaceId?: string;
  readonly targetResourceFamily?: AuthorizationResourceFamily;
  readonly targetResourceType?: string;
}

export interface EmitAuthorizationDiagnosticRecordInput {
  readonly logger: AuthorizationDecisionDiagnosticsLogger;
  readonly event: string;
  readonly outcome: AuthorizationDiagnosticOutcome;
  readonly reasonCode: AuthorizationDiagnosticReasonCode | string;
  readonly denialProvenanceStage: AuthorizationDenialProvenanceStage;
  readonly correlationId: string;
  readonly requestId?: string;
  readonly actorIdentityId?: string;
  readonly actorActiveWorkspaceId?: string;
  readonly requiredPermissionKey?: string;
  readonly matchedSourceKind?: AuthorizationDiagnosticMatchedSourceKind;
  readonly target: AuthorizationDiagnosticTargetContext;
  readonly counts?: {
    readonly roleAssignmentCount?: number;
    readonly permissionGrantCount?: number;
    readonly sharingGrantCount?: number;
    readonly sharingPolicyMetadataCount?: number;
    readonly applicableScopeCount?: number;
  };
  readonly evidence?: {
    readonly roleAssignmentIds?: ReadonlyArray<string>;
    readonly permissionGrantIds?: ReadonlyArray<string>;
    readonly sharingGrantIds?: ReadonlyArray<string>;
    readonly missing?: ReadonlyArray<string>;
  };
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export function emitAuthorizationDiagnosticRecord(
  input: EmitAuthorizationDiagnosticRecordInput,
): AuthorizationDiagnosticRecord {
  const diagnostic = createAuthorizationDiagnosticRecord({
    outcome: input.outcome,
    correlation: Object.freeze({
      requestId: input.requestId,
      correlationId: input.correlationId,
    }),
    actor: Object.freeze({
      actorIdentityId: input.actorIdentityId,
      actorActiveWorkspaceId: input.actorActiveWorkspaceId,
    }),
    target: toDiagnosticTarget(input.target),
    requiredPermissionKey: input.requiredPermissionKey,
    counts: input.counts,
    matchedSourceKind: input.matchedSourceKind,
    reasonCode: input.reasonCode,
    denialProvenanceStage: input.denialProvenanceStage,
    evidence: input.evidence,
    extensions: input.extensions,
  });

  input.logger.info({
    event: input.event,
    details: Object.freeze({
      diagnosticCorrelationId: diagnostic.correlation.correlationId ?? diagnostic.correlation.requestId,
      diagnostic,
    }),
  });
  return diagnostic;
}

export function buildAuthorizationDiagnosticCorrelationId(input: {
  readonly request: AuthorizationPolicyDecisionEvaluationRequest;
  readonly evaluatedAt: string;
}): string {
  const actorId = input.request.actor.actorUserIdentityId
    ?? input.request.actor.actorServiceId
    ?? "anonymous";
  const normalizedActorId = actorId.trim() || "anonymous";
  const normalizedPermission = input.request.requiredPermissionKey.trim() || "permission-unknown";

  if (input.request.target.kind === "resource-instance") {
    const resourceType = input.request.target.resource.resourceType.trim() || "resource";
    const resourceId = input.request.target.resource.resourceId.trim() || "identifier";
    return `${normalizedActorId}:${normalizedPermission}:resource:${resourceType}:${resourceId}:${input.evaluatedAt}`;
  }

  const workspaceId = input.request.target.workspaceId.trim() || "workspace-unknown";
  const capabilityResourceType = input.request.target.capabilityResourceType.trim() || "capability";
  return `${normalizedActorId}:${normalizedPermission}:workspace-capability:${workspaceId}:${capabilityResourceType}:${input.evaluatedAt}`;
}

export function buildAuthorizationPolicyDiagnosticContext(input: {
  readonly request: AuthorizationPolicyDecisionEvaluationRequest;
  readonly correlationId: string;
  readonly targetWorkspaceId?: string;
  readonly targetResourceType?: string;
  readonly targetIdentifier?: string;
}): AuthorizationPolicyEvaluationDiagnosticContext {
  if (input.request.target.kind === "resource-instance") {
    return Object.freeze({
      correlationId: input.correlationId,
      targetKind: input.request.target.kind,
      targetIdentifier: input.targetIdentifier ?? input.request.target.resource.resourceId,
      targetWorkspaceId: input.targetWorkspaceId,
      targetResourceFamily: input.request.target.resource.resourceFamily,
      targetResourceType: input.targetResourceType ?? input.request.target.resource.resourceType,
      synthesizedFallbackUsed: false,
    });
  }

  const workspaceId = input.targetWorkspaceId ?? input.request.target.workspaceId;
  const capabilityResourceType = input.targetResourceType ?? input.request.target.capabilityResourceType;
  return Object.freeze({
    correlationId: input.correlationId,
    targetKind: input.request.target.kind,
    targetIdentifier: input.targetIdentifier ?? `workspace-capability:${workspaceId}:${capabilityResourceType}`,
    targetWorkspaceId: workspaceId,
    targetResourceType: capabilityResourceType,
    synthesizedFallbackUsed: true,
  });
}

export function toAuthorizationDiagnosticMatchedSourceKind(
  sourceKind: string,
): AuthorizationDiagnosticMatchedSourceKind {
  const normalized = sourceKind.trim().toLowerCase();
  if (
    normalized === AuthorizationDiagnosticMatchedSourceKinds.explicitDeny
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.ownerOverride
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.roleGrant
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.permissionGrant
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.sharingGrant
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.visibilityRule
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.none
    || normalized === AuthorizationDiagnosticMatchedSourceKinds.notEvaluated
  ) {
    return normalized as AuthorizationDiagnosticMatchedSourceKind;
  }
  return AuthorizationDiagnosticMatchedSourceKinds.none;
}

export function collectWorkspaceIdsFromAuthorizationInputs(input: {
  readonly roleAssignments: ReadonlyArray<{
    readonly scope: string;
    readonly workspaceId?: string;
  }>;
  readonly permissionGrants: ReadonlyArray<{
    readonly scope: string;
    readonly workspaceId?: string;
  }>;
  readonly resourceWorkspaceId?: string;
}): ReadonlyArray<string> {
  const workspaceIds = new Set<string>();
  const resourceWorkspaceId = normalizeOptional(input.resourceWorkspaceId);
  if (resourceWorkspaceId) {
    workspaceIds.add(resourceWorkspaceId);
  }

  for (const assignment of input.roleAssignments) {
    if (assignment.scope === "workspace") {
      const workspaceId = normalizeOptional(assignment.workspaceId);
      if (workspaceId) {
        workspaceIds.add(workspaceId);
      }
    }
  }

  for (const grant of input.permissionGrants) {
    if (grant.scope === "workspace") {
      const workspaceId = normalizeOptional(grant.workspaceId);
      if (workspaceId) {
        workspaceIds.add(workspaceId);
      }
    }
  }

  return Object.freeze([...workspaceIds]);
}

function toDiagnosticTarget(target: AuthorizationDiagnosticTargetContext): {
  readonly kind: "resource-instance" | "workspace-capability";
  readonly targetIdentifier?: string;
  readonly targetWorkspaceId?: string;
  readonly targetResourceFamily?: AuthorizationResourceFamily;
  readonly targetResourceType?: string;
} {
  if (target.targetKind === "resource-instance") {
    return Object.freeze({
      kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
      targetIdentifier: target.targetIdentifier ?? "resource-unresolved",
      targetWorkspaceId: target.targetWorkspaceId,
      targetResourceFamily: target.targetResourceFamily,
      targetResourceType: target.targetResourceType,
    });
  }

  return Object.freeze({
    kind: AuthorizationDiagnosticTargetKinds.workspaceCapability,
    targetIdentifier: target.targetIdentifier,
    targetWorkspaceId: target.targetWorkspaceId ?? "workspace-unresolved",
    targetResourceFamily: target.targetResourceFamily,
    targetResourceType: target.targetResourceType,
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
