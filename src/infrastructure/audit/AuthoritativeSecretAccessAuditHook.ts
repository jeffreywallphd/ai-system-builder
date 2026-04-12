import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  SecretAuditEventKinds,
  type SecretAccessAuditEvent,
} from "@application/security/ports/SecretServicePorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";
import { redactSecretMaterial } from "@shared/security/SecretRedaction";

export function createAuthoritativeSecretAccessAuditHook(
  recorder: AuthoritativeAuditRecordingPort,
): (event: SecretAccessAuditEvent) => Promise<void> {
  return async (event) => {
    const operation = normalizeOptional("operation" in event ? event.operation : event.action) ?? "unknown";
    const actor = resolveActor(event);
    const scope = resolveScope(event);
    const secretId = normalizeOptional(event.target.secretId);
    const sanitizedDetails = sanitizeSecretAuditDetails(event.details);
    const operationKey = normalizeOptional(event.operationKey)
      ?? `secret:${event.eventKind}:${operation}:${secretId ?? "unknown"}:${event.occurredAt}`;

    await recorder.recordSecretsEvent({
      operationKey,
      eventType: event.eventKind,
      action: event.eventKind === SecretAuditEventKinds.accessDecision
        ? `secret.${operation}.access-evaluated`
        : `secret.${operation}.operation-recorded`,
      outcome: resolveOutcome(event),
      occurredAt: event.occurredAt,
      actor,
      scope,
      protectedResource: secretId
        ? Object.freeze({
          resourceType: "secret",
          resourceId: secretId,
          resourceRef: `secret:${secretId}`,
          sensitivityClass: "protected" as const,
          workspaceId: scope.kind === AuditScopeKinds.workspace ? scope.workspaceId : undefined,
        })
        : undefined,
      payload: Object.freeze({
        userSafeDetails: Object.freeze({
          eventKind: event.eventKind,
          operation,
          status: "status" in event ? event.status : undefined,
          decision: "decision" in event ? event.decision : undefined,
          reasonCode: "reasonCode" in event ? event.reasonCode : undefined,
          reason: "reason" in event ? event.reason : undefined,
          scope: event.target.scope,
          workspaceId: normalizeOptional(event.target.workspaceId),
          userIdentityId: normalizeOptional(event.target.userIdentityId),
          detailKeys: sanitizedDetails ? Object.freeze(Object.keys(sanitizedDetails)) : undefined,
        }),
        adminOnlyDetails: Object.freeze({
          operationKey: normalizeOptional(event.operationKey),
          serviceIdentity: normalizeOptional(event.serviceIdentity),
          justification: "justification" in event ? normalizeOptional(event.justification) : undefined,
          details: sanitizedDetails,
        }),
      }),
    });
  };
}

export function composeBestEffortSecretAuditHooks(
  ...hooks: ReadonlyArray<((event: SecretAccessAuditEvent) => Promise<void> | void) | undefined>
): (event: SecretAccessAuditEvent) => Promise<void> {
  return async (event) => {
    for (const hook of hooks) {
      if (!hook) {
        continue;
      }
      try {
        await hook(event);
      } catch {
        // Secret audit fan-out remains best-effort to avoid blocking secret operations.
      }
    }
  };
}

function resolveActor(
  event: SecretAccessAuditEvent,
): {
  readonly actorId: string;
  readonly actorKind: "user" | "service";
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
} {
  const actorId = normalizeOptional(event.actor.actorId) ?? "unknown-actor";
  const actorType = normalizeOptional(event.actor.actorType)?.toLowerCase();
  const userIdentityId = normalizeOptional(event.actor.userIdentityId);

  const isServiceActor = actorType === "server-runtime"
    || actorType === "workspace-service"
    || actorType === "system"
    || actorType === "service";

  if (isServiceActor) {
    return Object.freeze({
      actorId,
      actorKind: AuditActorKinds.service,
      actorServiceId: actorId,
    });
  }

  return Object.freeze({
    actorId: userIdentityId ?? actorId,
    actorKind: AuditActorKinds.user,
    actorUserIdentityId: userIdentityId ?? actorId,
  });
}

function resolveScope(
  event: SecretAccessAuditEvent,
): {
  readonly kind: "global" | "workspace";
  readonly workspaceId?: string;
} {
  const workspaceId = normalizeOptional(event.target.workspaceId) ?? normalizeOptional(event.actor.workspaceId);
  if (workspaceId) {
    return Object.freeze({
      kind: AuditScopeKinds.workspace,
      workspaceId,
    });
  }
  return Object.freeze({
    kind: AuditScopeKinds.global,
  });
}

function resolveOutcome(
  event: SecretAccessAuditEvent,
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (event.eventKind === SecretAuditEventKinds.accessDecision) {
    return event.decision === "allowed"
      ? AuditEventOutcomes.succeeded
      : AuditEventOutcomes.denied;
  }

  switch (event.status) {
    case "succeeded":
      return AuditEventOutcomes.succeeded;
    case "denied":
      return AuditEventOutcomes.denied;
    case "rejected":
      return AuditEventOutcomes.rejected;
    case "failed":
      return AuditEventOutcomes.failed;
    case "conflict":
      return AuditEventOutcomes.rejected;
    case "missing":
      return AuditEventOutcomes.denied;
    default:
      return AuditEventOutcomes.failed;
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function sanitizeSecretAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  return redactSecretMaterial(details);
}
