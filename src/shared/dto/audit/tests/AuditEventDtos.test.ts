import { describe, expect, it } from "bun:test";
import { AuditActorKinds, AuditEventCategories } from "@domain/audit/AuditDomain";
import {
  toAuditLedgerAppendResponseDto,
  toAuditLedgerGetDetailResponseDto,
  toAuditLedgerListResponseDto,
  type AuditLedgerListQueryDto,
} from "../AuditEventDtos";

describe("AuditEventDtos", () => {
  const event = Object.freeze({
    contractVersion: "1.0",
    eventId: "audit:event:dto:1",
    eventType: "run-submission-accepted",
    category: AuditEventCategories.orchestration,
    action: "run.submission.accepted",
    outcome: "succeeded",
    occurredAt: "2026-04-07T15:10:00.000Z",
    recordedAt: "2026-04-07T15:10:00.100Z",
    actor: {
      actorId: "service:run-orchestrator",
      actorKind: AuditActorKinds.service,
      actorServiceId: "service:run-orchestrator",
    },
    scope: {
      kind: "workspace",
      workspaceId: "workspace:ops",
    },
    payload: {
      categoryPayload: {
        category: AuditEventCategories.orchestration,
        runId: "run:1",
      },
      userSafeDetails: {
        runId: "run:1",
      },
      hasProtectedData: false,
      redactionReasons: [],
    },
    retention: "governance",
    immutability: "append-only",
    schemaVersion: "1.0",
    hashAlgorithm: "sha-256",
  } as const);

  it("maps append responses to summary views", () => {
    const response = toAuditLedgerAppendResponseDto({
      changed: true,
      wasReplay: false,
      sequence: 10,
      event,
    });

    expect(response.sequence).toBe(10);
    expect(response.event.eventId).toBe("audit:event:dto:1");
    expect(response.event.actorId).toBe("service:run-orchestrator");
  });

  it("builds normalized list responses with total fallback", () => {
    const query: AuditLedgerListQueryDto = {
      workspaceId: "  workspace:ops  ",
      filters: {
        outcomes: ["succeeded", "succeeded"],
      },
    };

    const response = toAuditLedgerListResponseDto({
      events: [event],
      query,
    });

    expect(response.totalCount).toBe(1);
    expect(response.query.workspaceId).toBe("workspace:ops");
    expect(response.query.filters?.outcomes).toEqual(["succeeded"]);
  });

  it("supports user-safe and admin detail response projections", () => {
    const userSafe = toAuditLedgerGetDetailResponseDto({ event });
    const admin = toAuditLedgerGetDetailResponseDto({ event, visibility: "admin" });

    expect(userSafe.event.visibility).toBe("user-safe");
    expect(admin.event.visibility).toBe("admin");
  });
});
