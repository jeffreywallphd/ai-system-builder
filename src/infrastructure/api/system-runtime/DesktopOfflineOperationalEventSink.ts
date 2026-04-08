import { randomUUID } from "node:crypto";
import type { IOfflineOperationalEventSink, OfflineOperationalEvent } from "@application/common/OfflineOperationalEventPorts";
import { OfflineOperationalEventTypes } from "@application/common/OfflineOperationalEventPorts";
import {
  RuntimeRealtimeAuditGovernanceEventKinds,
  RuntimeRealtimeConnectivityStates,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import type { SystemRuntimeBackendApi } from "./SystemRuntimeBackendApi";
import type { OfflineOperationalObservability } from "./OfflineOperationalObservability";

type RuntimeEventPublisherApi = Pick<
  SystemRuntimeBackendApi,
  "publishRuntimeConnectivityState" | "publishRuntimeAuditGovernance"
>;

export class DesktopOfflineOperationalEventSink implements IOfflineOperationalEventSink {
  public constructor(
    private readonly runtimeBackendApi: RuntimeEventPublisherApi,
    private readonly observability?: OfflineOperationalObservability,
  ) {}

  public async recordOfflineOperationalEvent(event: OfflineOperationalEvent): Promise<void> {
    if (this.observability) {
      try {
        await this.observability.recordOfflineOperationalEvent(event);
      } catch {
        // Offline observability logging/metrics must not block runtime event publication.
      }
    }

    if (
      event.type === OfflineOperationalEventTypes.offlineEntered
      || event.type === OfflineOperationalEventTypes.offlineExited
    ) {
      this.runtimeBackendApi.publishRuntimeConnectivityState({
        workspaceId: event.workspaceId,
        actorUserIdentityId: event.actorUserIdentityId,
        payload: Object.freeze({
          state: event.type === OfflineOperationalEventTypes.offlineEntered
            ? RuntimeRealtimeConnectivityStates.disconnected
            : RuntimeRealtimeConnectivityStates.connected,
          reason: event.summary,
          observedAt: event.occurredAt,
        }),
      });
      return;
    }

    this.runtimeBackendApi.publishRuntimeAuditGovernance({
      workspaceId: event.workspaceId,
      actorUserIdentityId: event.actorUserIdentityId,
      payload: Object.freeze({
        eventId: `audit:offline:${event.type}:${event.operationId ?? randomUUID()}`,
        eventType: event.type,
        auditCategory: event.type === OfflineOperationalEventTypes.protectedLocalExecutionRegistered
          ? "protected-data"
          : "orchestration",
        eventKind: event.type === OfflineOperationalEventTypes.protectedLocalExecutionRegistered
          ? RuntimeRealtimeAuditGovernanceEventKinds.protectedDataActionRecorded
          : RuntimeRealtimeAuditGovernanceEventKinds.orchestrationActionRecorded,
        action: toAuditAction(event.type),
        outcome: event.outcome ?? "succeeded",
        occurredAt: event.occurredAt,
        recordedAt: new Date().toISOString(),
        actorId: event.actorUserIdentityId ?? event.actorServiceId ?? "desktop-host",
        actorKind: event.actorUserIdentityId ? "user" : "service",
        workspaceId: event.workspaceId,
        resourceType: event.resourceClass,
        resourceId: event.resourceId,
        correlationId: event.correlationId ?? event.syncAttemptId ?? event.operationId,
        details: Object.freeze({
          requestId: event.requestId,
          syncAttemptId: event.syncAttemptId,
          classification: event.classification,
          channel: event.channel,
          summary: event.summary,
          details: event.details,
          diagnostics: event.diagnostics,
        }),
        hasProtectedData: event.type === OfflineOperationalEventTypes.protectedLocalExecutionRegistered,
        redactionReasons: event.type === OfflineOperationalEventTypes.protectedLocalExecutionRegistered
          ? Object.freeze(["internal-only-diagnostic"])
          : Object.freeze([]),
      }),
    });
  }
}

function toAuditAction(type: OfflineOperationalEvent["type"]): string {
  switch (type) {
    case OfflineOperationalEventTypes.replaySucceeded:
      return "offline.resync.replay.succeeded";
    case OfflineOperationalEventTypes.replayFailed:
      return "offline.resync.replay.failed";
    case OfflineOperationalEventTypes.conflictDetected:
      return "offline.resync.conflict.detected";
    case OfflineOperationalEventTypes.protectedLocalExecutionRegistered:
      return "offline.local-execution.protected.registered";
    case OfflineOperationalEventTypes.resynchronizationAttemptStarted:
      return "offline.resync.attempt.started";
    case OfflineOperationalEventTypes.resynchronizationAttemptCompleted:
      return "offline.resync.attempt.completed";
    case OfflineOperationalEventTypes.snapshotRefreshFailed:
      return "offline.cache.snapshot.refresh.failed";
    case OfflineOperationalEventTypes.offlineEntered:
      return "offline.mode.entered";
    case OfflineOperationalEventTypes.offlineExited:
      return "offline.mode.exited";
    default:
      return "offline.event.recorded";
  }
}
