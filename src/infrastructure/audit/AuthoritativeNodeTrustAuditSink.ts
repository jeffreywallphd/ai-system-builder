import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type { NodeTrustAuditEvent, NodeTrustAuditSink } from "@application/nodes/ports/NodeTrustAuditPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

const NodeTrustActionByType = Object.freeze({
  "node-enrollment-requested": "node.enrollment.requested",
  "node-enrollment-expired": "node.enrollment.expired",
  "node-pending-enrollment-reviewed": "node.enrollment.reviewed",
  "node-approved": "node.approved",
  "node-activated": "node.activated",
  "node-rejected": "node.rejected",
  "node-revoked": "node.revoked",
  "node-heartbeat-recorded": "node.heartbeat.recorded",
  "node-heartbeat-rejected": "node.heartbeat.rejected",
  "node-availability-transitioned": "node.availability.transitioned",
  "node-trusted-inventory-queried": "node.inventory.trusted.queried",
  "node-inventory-queried": "node.inventory.queried",
  "node-inventory-detail-queried": "node.inventory.detail.queried",
} as const satisfies Record<NodeTrustAuditEvent["type"], string>);

export class AuthoritativeNodeTrustAuditSink implements NodeTrustAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordNodeTrustAuditEvent(event: NodeTrustAuditEvent): Promise<void> {
    const actorUserIdentityId = normalizeOptional(event.actorUserIdentityId);
    const actor = actorUserIdentityId && actorUserIdentityId.startsWith("user:")
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      })
      : Object.freeze({
        actorId: actorUserIdentityId ?? "service:node-trust",
        actorKind: AuditActorKinds.service,
        actorServiceId: actorUserIdentityId ?? "service:node-trust",
      });
    const workspaceId = normalizeOptional(event.workspaceId);
    const nodeId = normalizeOptional(event.nodeId);
    const enrollmentRequestId = normalizeOptional(event.enrollmentRequestId);
    const operationDiscriminator = firstDefined(nodeId, enrollmentRequestId, workspaceId, event.type, "event");

    await this.recorder.recordNodeTrustEvent({
      operationKey: `node-trust:${event.type}:${operationDiscriminator}`,
      eventType: event.type,
      action: NodeTrustActionByType[event.type],
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
      actionContext: {
        nodeId,
      },
      payload: {
        userSafeDetails: Object.freeze({
          nodeId,
          enrollmentRequestId,
          deploymentId: normalizeOptional(event.deploymentId),
          outcome: event.outcome,
        }),
        adminOnlyDetails: event.details,
      },
    });
  }
}

function resolveOutcome(event: NodeTrustAuditEvent): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (event.outcome === "rejected" || event.type === "node-heartbeat-rejected") {
    return AuditEventOutcomes.rejected;
  }
  if (event.outcome === "already-applied") {
    return AuditEventOutcomes.succeeded;
  }
  return AuditEventOutcomes.succeeded;
}

function resolveProtectedResource(
  event: NodeTrustAuditEvent,
  workspaceId: string | undefined,
): {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly sensitivityClass: "standard" | "sensitive" | "protected";
  readonly workspaceId?: string;
} | undefined {
  const nodeId = normalizeOptional(event.nodeId);
  if (nodeId) {
    const canonicalNodeId = stripTypedPrefix(nodeId, "node");
    return Object.freeze({
      resourceType: "node",
      resourceId: canonicalNodeId,
      resourceRef: `node:${canonicalNodeId}`,
      sensitivityClass: "sensitive",
      workspaceId,
    });
  }

  const enrollmentRequestId = normalizeOptional(event.enrollmentRequestId);
  if (enrollmentRequestId) {
    return Object.freeze({
      resourceType: "node-enrollment-request",
      resourceId: enrollmentRequestId,
      resourceRef: `node-enrollment-request:${enrollmentRequestId}`,
      sensitivityClass: "sensitive",
      workspaceId,
    });
  }

  return undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function firstDefined(...values: ReadonlyArray<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = normalizeOptional(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function stripTypedPrefix(value: string, prefix: string): string {
  return value.startsWith(`${prefix}:`)
    ? value.slice(prefix.length + 1)
    : value;
}
