import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type {
  ExecutionNodeManagementAuditEvent,
  ExecutionNodeManagementAuditSink,
} from "@application/nodes/ports/ExecutionNodeManagementAuditPorts";
import { ExecutionNodeManagementAuditEventTypes } from "@application/nodes/ports/ExecutionNodeManagementAuditPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

const NodeManagementActionByType = Object.freeze({
  [ExecutionNodeManagementAuditEventTypes.executionNodeRegistered]: "node.execution.registered",
  [ExecutionNodeManagementAuditEventTypes.executionNodeActivated]: "node.execution.activated",
  [ExecutionNodeManagementAuditEventTypes.executionNodeAvailabilityOverrideUpdated]: "node.execution.availability.override-updated",
  [ExecutionNodeManagementAuditEventTypes.executionNodeBackendStateRefreshed]: "node.execution.backend-state.refreshed",
  [ExecutionNodeManagementAuditEventTypes.executionNodeSelectionEvaluated]: "run.node-assignment.selection.evaluated",
} as const satisfies Record<ExecutionNodeManagementAuditEvent["type"], string>);

export class AuthoritativeExecutionNodeManagementAuditSink implements ExecutionNodeManagementAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordExecutionNodeManagementAuditEvent(event: ExecutionNodeManagementAuditEvent): Promise<void> {
    const actorUserIdentityId = normalizeOptional(event.actorUserIdentityId);
    const actor = actorUserIdentityId && actorUserIdentityId.startsWith("user:")
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      })
      : Object.freeze({
        actorId: actorUserIdentityId ?? "service:execution-node-management",
        actorKind: AuditActorKinds.service,
        actorServiceId: actorUserIdentityId ?? "service:execution-node-management",
      });

    const workspaceId = normalizeOptional(event.workspaceId);
    const action = NodeManagementActionByType[event.type];
    const operationDiscriminator = firstDefined(
      normalizeOptional(event.nodeId),
      normalizeOptional(event.runId),
      workspaceId,
      event.occurredAt,
    ) ?? "event";

    const recordInput = Object.freeze({
      operationKey: `execution-node-management:${event.type}:${operationDiscriminator}`,
      eventType: event.type,
      action,
      outcome: resolveOutcome(event.outcome),
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
        nodeId: normalizeOptional(event.nodeId),
      },
      payload: Object.freeze({
        userSafeDetails: Object.freeze({
          nodeId: normalizeOptional(event.nodeId),
          runId: normalizeOptional(event.runId),
          outcome: event.outcome,
        }),
        adminOnlyDetails: event.details,
      }),
    });

    if (event.type === ExecutionNodeManagementAuditEventTypes.executionNodeSelectionEvaluated) {
      await this.recorder.recordRunsEvent(recordInput);
      return;
    }
    await this.recorder.recordNodeTrustEvent(recordInput);
  }
}

function resolveOutcome(
  outcome: ExecutionNodeManagementAuditEvent["outcome"],
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (outcome === "rejected") {
    return AuditEventOutcomes.rejected;
  }
  if (outcome === "failed") {
    return AuditEventOutcomes.failed;
  }
  return AuditEventOutcomes.succeeded;
}

function resolveProtectedResource(
  event: ExecutionNodeManagementAuditEvent,
  workspaceId: string | undefined,
): {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly sensitivityClass: "standard" | "sensitive" | "protected";
  readonly workspaceId?: string;
} | undefined {
  const runId = normalizeOptional(event.runId);
  if (runId) {
    return Object.freeze({
      resourceType: "run",
      resourceId: stripTypedPrefix(runId, "run"),
      resourceRef: runId.startsWith("run:") ? runId : `run:${runId}`,
      sensitivityClass: "sensitive",
      workspaceId,
    });
  }

  const nodeId = normalizeOptional(event.nodeId);
  if (nodeId) {
    return Object.freeze({
      resourceType: "node",
      resourceId: stripTypedPrefix(nodeId, "node"),
      resourceRef: nodeId.startsWith("node:") ? nodeId : `node:${nodeId}`,
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
