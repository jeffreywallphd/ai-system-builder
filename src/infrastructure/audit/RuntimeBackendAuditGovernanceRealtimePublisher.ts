import type { AuthoritativeAuditRecordingServiceDependencies } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  AuditEventCategories,
  type AuditEventCategory,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import {
  RuntimeRealtimeAuditGovernanceEventKinds,
  type RuntimeRealtimeAuditGovernanceEventKind,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import type { SystemRuntimeBackendApi } from "@infrastructure/api/system-runtime/SystemRuntimeBackendApi";

type RuntimeAuditRealtimePublisherBackend = Pick<SystemRuntimeBackendApi, "publishRuntimeAuditGovernance">;

export class RuntimeBackendAuditGovernanceRealtimePublisher implements NonNullable<AuthoritativeAuditRecordingServiceDependencies["publicationPort"]> {
  public constructor(
    private readonly runtimeBackendApi: RuntimeAuditRealtimePublisherBackend,
  ) {}

  public publishAuthoritativeAuditEvent(input: {
    readonly source: string;
    readonly appendResult: { readonly changed: boolean };
    readonly event: CanonicalAuditEvent;
  }): void {
    void input.source;
    void input.appendResult;
    const event = input.event;
    this.runtimeBackendApi.publishRuntimeAuditGovernance({
      workspaceId: event.scope.workspaceId,
      actorUserIdentityId: event.actor.actorUserIdentityId,
      payload: Object.freeze({
        eventId: event.eventId,
        eventType: event.eventType,
        auditCategory: event.category,
        eventKind: toRuntimeAuditGovernanceEventKind(event.category),
        action: event.action,
        outcome: event.outcome,
        occurredAt: event.occurredAt,
        recordedAt: event.recordedAt,
        actorId: event.actor.actorId,
        actorKind: event.actor.actorKind,
        workspaceId: event.scope.workspaceId,
        resourceType: event.protectedResource?.resourceType,
        resourceId: event.protectedResource?.resourceId,
        correlationId: event.correlationId,
        requestId: event.requestId,
        details: event.payload.userSafeDetails,
        hasProtectedData: event.payload.hasProtectedData,
        redactionReasons: event.payload.redactionReasons,
      }),
    });
  }
}

function toRuntimeAuditGovernanceEventKind(category: AuditEventCategory): RuntimeRealtimeAuditGovernanceEventKind {
  switch (category) {
    case AuditEventCategories.securitySensitive:
      return RuntimeRealtimeAuditGovernanceEventKinds.securitySensitiveActionRecorded;
    case AuditEventCategories.administrative:
      return RuntimeRealtimeAuditGovernanceEventKinds.administrativeActionRecorded;
    case AuditEventCategories.sharing:
      return RuntimeRealtimeAuditGovernanceEventKinds.sharingActionRecorded;
    case AuditEventCategories.policy:
      return RuntimeRealtimeAuditGovernanceEventKinds.policyActionRecorded;
    case AuditEventCategories.orchestration:
      return RuntimeRealtimeAuditGovernanceEventKinds.orchestrationActionRecorded;
    case AuditEventCategories.protectedData:
    default:
      return RuntimeRealtimeAuditGovernanceEventKinds.protectedDataActionRecorded;
  }
}
