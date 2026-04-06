import { describe, expect, it } from "bun:test";
import {
  PlatformAuditEventPersistenceRecordSchema,
  PlatformRunPersistenceRecordSchema,
  parsePlatformAuditEventPersistenceRecord,
} from "../PlatformPersistenceSchemaContracts";

describe("PlatformPersistenceSchemaContracts", () => {
  it("accepts valid platform run persistence payloads", () => {
    const parsed = PlatformRunPersistenceRecordSchema.parse({
      runId: "run-1",
      runKind: "workflow",
      status: "completed",
      sourceAggregateRef: "workflow:default",
      initiatedAt: "2026-04-06T10:00:00.000Z",
      startedAt: "2026-04-06T10:00:01.000Z",
      completedAt: "2026-04-06T10:00:05.000Z",
      tenancy: {
        scope: "workspace",
        workspaceId: "workspace-1",
      },
      revision: 2,
      schemaVersion: 1,
    });

    expect(parsed.status).toBe("completed");
  });

  it("requires completedAt for terminal run statuses", () => {
    expect(() => PlatformRunPersistenceRecordSchema.parse({
      runId: "run-2",
      runKind: "workflow",
      status: "failed",
      sourceAggregateRef: "workflow:default",
      initiatedAt: "2026-04-06T10:00:00.000Z",
      tenancy: {
        scope: "workspace",
        workspaceId: "workspace-1",
      },
      revision: 1,
      schemaVersion: 1,
    })).toThrow("completedAt");
  });

  it("parses platform audit event payloads", () => {
    const parsed = parsePlatformAuditEventPersistenceRecord({
      eventId: "evt-1",
      eventKind: "security",
      action: "certificate.issue",
      actorId: "svc-ca",
      outcome: "succeeded",
      occurredAt: "2026-04-06T10:00:00.000Z",
      tenancy: {
        scope: "platform",
      },
    });

    expect(parsed.eventKind).toBe("security");
  });

  it("rejects malformed audit payloads", () => {
    expect(() => PlatformAuditEventPersistenceRecordSchema.parse({
      eventId: "evt-2",
      eventKind: "security",
      action: "certificate.issue",
      actorId: "svc-ca",
      outcome: "succeeded",
    })).toThrow("occurredAt");
  });
});
