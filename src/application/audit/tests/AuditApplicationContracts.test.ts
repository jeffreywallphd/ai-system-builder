import { describe, expect, it } from "bun:test";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditScopeKinds,
  createCanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import {
  appendAuditEventBestEffort,
  isAuditRecordEvent,
  isOperationalLogEvent,
  resolveAuditCategoryForAction,
  type AuditLedgerAppendContext,
  type AuditLedgerQuery,
  type IAuditLedgerRepository,
} from "../AuditApplicationContracts";

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public readonly events: ReturnType<typeof createCanonicalAuditEvent>[] = [];

  async appendAuditEvent(
    event: ReturnType<typeof createCanonicalAuditEvent>,
    _context: AuditLedgerAppendContext,
  ): Promise<{
    changed: boolean;
    wasReplay: boolean;
    sequence: number;
    event: ReturnType<typeof createCanonicalAuditEvent>;
  }> {
    this.events.push(event);
    return {
      changed: true,
      wasReplay: false,
      sequence: this.events.length,
      event,
    };
  }

  async listAuditEvents(_query: AuditLedgerQuery): Promise<readonly ReturnType<typeof createCanonicalAuditEvent>[]> {
    return this.events;
  }

  async countAuditEvents(_query: AuditLedgerQuery): Promise<number> {
    return this.events.length;
  }

  async getAuditEventById(eventId: string): Promise<ReturnType<typeof createCanonicalAuditEvent> | undefined> {
    return this.events.find((event) => event.eventId === eventId);
  }
}

describe("AuditApplicationContracts", () => {
  it("maps action namespaces to canonical categories", () => {
    expect(resolveAuditCategoryForAction("auth.login.succeeded")).toBe(AuditEventCategories.securitySensitive);
    expect(resolveAuditCategoryForAction("workspace.role.reassigned")).toBe(AuditEventCategories.administrative);
    expect(resolveAuditCategoryForAction("share.grant.created")).toBe(AuditEventCategories.sharing);
    expect(resolveAuditCategoryForAction("policy.retention.updated")).toBe(AuditEventCategories.policy);
    expect(resolveAuditCategoryForAction("run.submission.accepted")).toBe(AuditEventCategories.orchestration);
    expect(resolveAuditCategoryForAction("secret.rotation.completed")).toBe(AuditEventCategories.protectedData);
    expect(resolveAuditCategoryForAction("unknown.action")).toBe(AuditEventCategories.administrative);
  });

  it("distinguishes canonical audit records from operational logs", () => {
    expect(isAuditRecordEvent({ recordKind: "audit-record" })).toBeTrue();
    expect(isOperationalLogEvent({ recordKind: "operational-log" })).toBeTrue();
    expect(isOperationalLogEvent({ recordKind: "audit-record" })).toBeFalse();
  });

  it("supports best-effort append without throwing on sink failures", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const event = createCanonicalAuditEvent({
      eventId: "audit:event:application:1",
      eventType: "run-submission-accepted",
      category: AuditEventCategories.orchestration,
      action: "run.submission.accepted",
      outcome: "succeeded",
      occurredAt: "2026-04-07T15:00:00.000Z",
      actor: {
        actorId: "service:run-orchestrator",
        actorKind: AuditActorKinds.service,
        actorServiceId: "service:run-orchestrator",
      },
      scope: {
        kind: AuditScopeKinds.workspace,
        workspaceId: "workspace:1",
      },
      payload: {
        userSafeDetails: {
          runId: "run:1",
        },
      },
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
      },
    });

    await appendAuditEventBestEffort(repository, event, {
      operationKey: "audit:append:1",
      actorId: "service:run-orchestrator",
      occurredAt: event.recordedAt,
    });

    expect(repository.events).toHaveLength(1);

    const failingRepository: IAuditLedgerRepository = {
      appendAuditEvent: async () => {
        throw new Error("unavailable");
      },
      listAuditEvents: async () => [],
      countAuditEvents: async () => 0,
      getAuditEventById: async () => undefined,
    };

    await expect(appendAuditEventBestEffort(failingRepository, event, {
      operationKey: "audit:append:2",
      actorId: "service:run-orchestrator",
      occurredAt: event.recordedAt,
    })).resolves.toBeUndefined();
  });
});
