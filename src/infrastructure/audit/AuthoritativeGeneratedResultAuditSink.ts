import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  GeneratedResultAuditEventTypes,
  type GeneratedResultAuditEvent,
  type GeneratedResultAuditSink,
} from "@application/generated-results/ports/GeneratedResultAuditPort";
import { AuditActorKinds, AuditEventOutcomes, AuditRedactionReasons, AuditScopeKinds } from "@domain/audit/AuditDomain";

const GeneratedResultAuditActionByType = Object.freeze({
  [GeneratedResultAuditEventTypes.resultPersisted]: "run.result.persistence.recorded",
  [GeneratedResultAuditEventTypes.previewGenerationRecorded]: "run.result.preview.generation.recorded",
  [GeneratedResultAuditEventTypes.originalContentAccessed]: "asset.protected.generated-result.original.accessed",
  [GeneratedResultAuditEventTypes.previewAccessRequested]: "asset.protected.generated-result.preview.requested",
  [GeneratedResultAuditEventTypes.previewContentOpened]: "asset.protected.generated-result.preview.opened",
} as const satisfies Readonly<Record<string, string>>);

export class AuthoritativeGeneratedResultAuditSink implements GeneratedResultAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordGeneratedResultEvent(event: GeneratedResultAuditEvent): Promise<void> {
    const action = GeneratedResultAuditActionByType[event.type];
    if (!action) {
      return;
    }

    const isProtectedAction = action.startsWith("asset.protected.");
    const operationKey = normalizeOptional(event.operationKey)
      ?? `generated-result-audit:${event.type}:${event.result.resultAssetId}:${event.occurredAt}`;
    const actorUserId = normalizeRequired(event.actorUserId, "unknown-user");
    const workspaceId = normalizeRequired(event.workspaceId, "unknown-workspace");
    const resultAssetId = normalizeRequired(event.result.resultAssetId, "unknown-generated-result");

    const input = {
      operationKey,
      eventType: event.type,
      action,
      outcome: resolveOutcome(event.outcome),
      occurredAt: event.occurredAt,
      actor: Object.freeze({
        actorId: actorUserId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId: actorUserId,
      }),
      scope: Object.freeze({
        kind: AuditScopeKinds.workspace,
        workspaceId,
      }),
      protectedResource: Object.freeze({
        resourceType: "generated-result-record",
        resourceId: resultAssetId,
        resourceRef: `generated-result-record:${resultAssetId}`,
        sensitivityClass: isProtectedAction ? "protected" : "sensitive",
        workspaceId,
      }),
      correlationId: normalizeOptional(event.correlationId),
      payload: Object.freeze({
        hasProtectedData: isProtectedAction,
        redactionReasons: isProtectedAction
          ? Object.freeze([AuditRedactionReasons.internalOnlyDiagnostic])
          : Object.freeze([]),
        userSafeDetails: Object.freeze({
          resultAssetId,
          runId: normalizeOptional(event.result.runId),
          workflowId: normalizeOptional(event.result.workflowId),
          systemId: normalizeOptional(event.result.systemId),
          executionNodeId: normalizeOptional(event.result.executionNodeId),
          storageInstanceId: normalizeOptional(event.result.storageInstanceId),
          visibility: event.result.visibility,
          lifecycleStatus: event.result.lifecycleStatus,
          mediaType: normalizeOptional(event.result.mediaType),
          details: event.details,
        }),
        adminOnlyDetails: isProtectedAction
          ? Object.freeze({
            operationKey,
            correlationId: normalizeOptional(event.correlationId),
          })
          : undefined,
      }),
      actionContext: Object.freeze({
        targetResourceId: resultAssetId,
      }),
      linkage: Object.freeze({
        runId: normalizeOptional(event.result.runId),
        workflowId: normalizeOptional(event.result.workflowId),
        systemId: normalizeOptional(event.result.systemId),
        executionNodeId: normalizeOptional(event.result.executionNodeId),
      }),
    } as const;

    if (isProtectedAction) {
      await this.recorder.recordSecretsEvent(input);
      return;
    }

    await this.recorder.recordRunsEvent(input);
  }
}

function resolveOutcome(
  outcome: GeneratedResultAuditEvent["outcome"],
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (outcome === "rejected") {
    return AuditEventOutcomes.rejected;
  }
  if (outcome === "failed") {
    return AuditEventOutcomes.failed;
  }
  return AuditEventOutcomes.succeeded;
}

function normalizeRequired(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
