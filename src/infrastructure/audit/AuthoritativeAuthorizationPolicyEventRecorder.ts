import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  AuthorizationPolicyEvaluationEventTypes,
  type AuthorizationPolicyRecordedEvent,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyEventRecorder } from "@application/authorization/ports/IAuthorizationPolicyEventRecorder";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

export class AuthoritativeAuthorizationPolicyEventRecorder implements IAuthorizationPolicyEventRecorder {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordPolicyEvaluationEvent(event: AuthorizationPolicyRecordedEvent): Promise<void> {
    const actorUserIdentityId = normalizeOptional(event.actor.actorUserIdentityId);
    const actorServiceId = normalizeOptional(event.actor.actorServiceId);
    const actor = actorUserIdentityId
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      })
      : Object.freeze({
        actorId: actorServiceId ?? "service:authorization-policy",
        actorKind: AuditActorKinds.service,
        actorServiceId: actorServiceId ?? "service:authorization-policy",
      });
    const workspaceId = normalizeOptional(event.workspaceId);

    await this.recorder.recordSharingEvent({
      operationKey: resolveOperationKey(event),
      eventType: event.type,
      action: resolveAction(event),
      outcome: resolveOutcome(event),
      occurredAt: event.occurredAt,
      actor,
      scope: workspaceId
        ? Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId,
        })
        : Object.freeze({
          kind: AuditScopeKinds.global,
        }),
      protectedResource: resolveProtectedResource(event, workspaceId),
      correlationId: normalizeOptional(event.correlationId),
      payload: resolvePayload(event),
    });
  }
}

function resolveOperationKey(event: AuthorizationPolicyRecordedEvent): string {
  if ("mutation" in event) {
    return event.mutation.operationKey;
  }
  const correlation = normalizeOptional(event.correlationId) ?? "event";
  return `authorization:${event.type}:${correlation}`;
}

function resolveAction(event: AuthorizationPolicyRecordedEvent): string {
  if (event.type === AuthorizationPolicyEvaluationEventTypes.evaluated) {
    return "permission.policy.evaluated";
  }
  if (event.type === AuthorizationPolicyEvaluationEventTypes.denied) {
    return "permission.policy.denied";
  }

  if ("mutation" in event && event.mutation.entityKind === "sharing-grant") {
    return event.mutation.mutationKind === "revoke"
      ? "share.grant.revoked"
      : "share.grant.upserted";
  }

  if ("mutation" in event && event.mutation.entityKind === "role-assignment") {
    return event.mutation.mutationKind === "revoke"
      ? "permission.role-assignment.revoked"
      : "permission.role-assignment.upserted";
  }

  if ("mutation" in event && event.mutation.entityKind === "resource-policy") {
    if (event.mutation.mutationKind === "soft-delete") {
      return "share.resource-policy.soft-deleted";
    }

    const details = asRecord(event.details);
    const visibility = normalizeOptional(asString(details?.visibility));
    const sharingPolicyMode = normalizeOptional(asString(details?.sharingPolicyMode));
    const publishedAt = normalizeOptional(asString(details?.publishedAt));
    if (visibility === "published" || sharingPolicyMode === "published" || publishedAt) {
      return "share.resource.publication.updated";
    }
    return "share.resource-policy.updated";
  }

  return "permission.resource-policy.updated";
}

function resolveOutcome(event: AuthorizationPolicyRecordedEvent): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (event.type === AuthorizationPolicyEvaluationEventTypes.denied) {
    return AuditEventOutcomes.denied;
  }

  if ("outcome" in event) {
    return event.outcome === "deny"
      ? AuditEventOutcomes.denied
      : AuditEventOutcomes.succeeded;
  }

  return AuditEventOutcomes.succeeded;
}

function resolvePayload(event: AuthorizationPolicyRecordedEvent): {
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
} {
  if ("mutation" in event) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        entityKind: event.mutation.entityKind,
        mutationKind: event.mutation.mutationKind,
        changed: event.mutation.changed,
        wasReplay: event.mutation.wasReplay,
        expectedRevision: event.mutation.expectedRevision,
      }),
      adminOnlyDetails: event.details
        ? Object.freeze({
          details: event.details,
          operationKey: event.mutation.operationKey,
        })
        : Object.freeze({
          operationKey: event.mutation.operationKey,
        }),
    });
  }

  return Object.freeze({
    userSafeDetails: Object.freeze({
      requiredPermissionKey: event.requiredPermissionKey,
      outcome: event.outcome,
      reasonCode: event.reasonCode,
      roleAssignmentCount: event.roleAssignmentCount,
      permissionGrantCount: event.permissionGrantCount,
      sharingGrantCount: event.sharingGrantCount,
    }),
    adminOnlyDetails: Object.freeze({
      denialReason: event.denialReason,
    }),
  });
}

function resolveProtectedResource(
  event: AuthorizationPolicyRecordedEvent,
  workspaceId: string | undefined,
): {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly sensitivityClass: "standard" | "sensitive" | "protected";
  readonly workspaceId?: string;
} | undefined {
  const resourceType = normalizeOptional(event.resource?.resourceType);
  const resourceId = normalizeOptional(event.resource?.resourceId);
  if (!resourceType || !resourceId) {
    return undefined;
  }

  return Object.freeze({
    resourceType,
    resourceId,
    resourceRef: `${resourceType}:${resourceId}`,
    sensitivityClass: "sensitive",
    workspaceId,
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
