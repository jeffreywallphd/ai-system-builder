import { describe, expect, it } from "bun:test";
import { AuditEventCategories } from "@domain/audit/AuditDomain";
import {
  AuditEventSchemaValidationError,
  parseAuditEventEnvelopeDto,
  parseAuditEventListQueryFromSearchParams,
  parseAuditLedgerAppendRequestDto,
} from "../AuditEventSchemaContracts";

describe("AuditEventSchemaContracts", () => {
  it("parses canonical audit event envelopes for write/read paths", () => {
    const event = parseAuditEventEnvelopeDto({
      contractVersion: "1.0",
      eventId: "audit:event:schema:1",
      eventType: "workspace-role-reassigned",
      category: "administrative",
      action: "workspace.role.reassigned",
      outcome: "succeeded",
      occurredAt: "2026-04-07T15:20:00.000Z",
      recordedAt: "2026-04-07T15:20:00.050Z",
      actor: {
        actorId: "user:admin:1",
        actorKind: "user",
        actorUserIdentityId: "user:admin:1",
      },
      scope: {
        kind: "workspace",
        workspaceId: "workspace:1",
      },
      payload: {
        categoryPayload: {
          category: "administrative",
          mutationKind: "reassign",
        },
        userSafeDetails: {
          roleKey: "admin",
        },
        adminOnlyDetails: {
          previousRoleKey: "member",
        },
        hasProtectedData: true,
        redactionReasons: ["personal-data"],
      },
      retention: "governance",
      immutability: "append-only",
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
      linkage: {
        eventGroupId: "group:workflow:1",
        runId: "run:1",
        relatedResources: [
          {
            resourceType: "run",
            resourceId: "run:1",
            resourceRef: "run:1",
            relationship: "subject",
          },
        ],
      },
    });

    const append = parseAuditLedgerAppendRequestDto({
      event,
      mutation: {
        operationKey: "audit:append:1",
        actorId: "user:admin:1",
      },
    });

    expect(append.event.eventId).toBe("audit:event:schema:1");
    expect(append.mutation.operationKey).toBe("audit:append:1");
  });

  it("rejects mismatched category payloads and protected-data redaction gaps", () => {
    expect(() => parseAuditEventEnvelopeDto({
      contractVersion: "1.0",
      eventId: "audit:event:schema:2",
      eventType: "run-submission-accepted",
      category: "orchestration",
      action: "run.submission.accepted",
      outcome: "succeeded",
      occurredAt: "2026-04-07T15:30:00.000Z",
      recordedAt: "2026-04-07T15:30:00.100Z",
      actor: {
        actorId: "service:run-orchestrator",
        actorKind: "service",
        actorServiceId: "service:run-orchestrator",
      },
      scope: {
        kind: "workspace",
        workspaceId: "workspace:1",
      },
      payload: {
        categoryPayload: {
          category: "administrative",
          mutationKind: "unexpected",
        },
        hasProtectedData: true,
        redactionReasons: [],
      },
      retention: "governance",
      immutability: "append-only",
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
    })).toThrow(AuditEventSchemaValidationError);
  });

  it("parses repeated-key query filters and validates thin-safe category constraints", () => {
    const parsed = parseAuditEventListQueryFromSearchParams(new URLSearchParams(
      "workspaceId=workspace%3A1"
      + "&search=governance"
      + "&limit=20"
      + "&offset=0"
      + "&sortBy=occurredAt"
      + "&sortDirection=desc"
      + "&category=administrative"
      + "&category=sharing"
      + "&outcome=succeeded"
      + "&eventType=workspace-role-reassigned"
      + "&correlationId=corr%3Aworkflow%3A1"
      + "&eventGroupId=group%3Aworkflow%3A1"
      + "&runId=run%3A1"
      + "&includeThinSafeOnly=true",
    ));

    expect(parsed.filters?.categories).toEqual([
      AuditEventCategories.administrative,
      AuditEventCategories.sharing,
    ]);
    expect(parsed.filters?.correlationIds).toEqual(["corr:workflow:1"]);
    expect(parsed.filters?.eventGroupIds).toEqual(["group:workflow:1"]);
    expect(parsed.filters?.runIds).toEqual(["run:1"]);

    expect(() => parseAuditEventListQueryFromSearchParams(new URLSearchParams(
      "category=protected-data&includeThinSafeOnly=true",
    ))).toThrow(AuditEventSchemaValidationError);
  });
});
