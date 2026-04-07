import { describe, expect, it } from "bun:test";
import { AuditActorKinds, AuditEventCategories } from "@domain/audit/AuditDomain";
import {
  AuditEventDetailVisibilities,
  normalizeAuditEventListQuery,
  toAuditEventDetailView,
  toAuditEventSummaryView,
  type AuditEventEnvelopeDto,
} from "../AuditEventContracts";

describe("AuditEventContracts", () => {
  const event: AuditEventEnvelopeDto = Object.freeze({
    contractVersion: "1.0",
    eventId: "audit:event:shared:1",
    eventType: "workspace-role-reassigned",
    category: AuditEventCategories.administrative,
    action: "workspace.role.reassigned",
    outcome: "succeeded",
    occurredAt: "2026-04-07T15:00:00.000Z",
    recordedAt: "2026-04-07T15:00:00.250Z",
    actor: {
      actorId: "user:admin:1",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:admin:1",
    },
    scope: {
      kind: "workspace",
      workspaceId: "workspace:1",
    },
    payload: {
      categoryPayload: {
        category: AuditEventCategories.administrative,
        mutationKind: "reassign",
        targetType: "workspace-role-assignment",
        targetRef: "workspace-role-assignment:1",
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
    retentionMetadata: {
      policyKey: "retention-policy:workspace-default",
      policyVersion: "2026-04-07",
      retentionAnchor: "occurred-at",
      retainUntil: "2027-04-07T00:00:00.000Z",
      lifecycleState: "active",
      lifecycleUpdatedAt: "2026-04-07T15:01:00.000Z",
    },
    immutability: "append-only",
    schemaVersion: "1.0",
    hashAlgorithm: "sha-256",
    correlationId: "corr:trust:1",
    requestId: "req:trust:1",
    linkage: {
      eventGroupId: "group:trust:1",
      workflowId: "workflow:node-trust",
      relatedResources: [
        {
          resourceType: "node",
          resourceId: "node:1",
          resourceRef: "node:1",
          relationship: "subject",
        },
      ],
    },
  });

  it("projects redacted summary and admin detail views", () => {
    const summary = toAuditEventSummaryView(event);
    const userSafeDetail = toAuditEventDetailView(event);
    const adminDetail = toAuditEventDetailView(event, AuditEventDetailVisibilities.admin);

    expect(summary.details).toEqual({ roleKey: "admin" });
    expect(summary.correlationId).toBe("corr:trust:1");
    expect(summary.linkage?.eventGroupId).toBe("group:trust:1");
    expect(summary.redactionReasons).toEqual(["personal-data"]);
    expect(summary.retention).toBe("governance");
    expect(summary.retentionMetadata?.policyKey).toBe("retention-policy:workspace-default");
    expect(userSafeDetail.adminOnlyDetails).toBeUndefined();
    expect(adminDetail.adminOnlyDetails).toEqual({ previousRoleKey: "member" });
  });

  it("normalizes query filters, timestamps and optional values", () => {
    const query = normalizeAuditEventListQuery({
      workspaceId: "  workspace:1  ",
      search: "   role  ",
      filters: {
        categories: ["administrative", "administrative"],
        outcomes: ["succeeded", "succeeded"],
        actionPrefix: "   workspace.  ",
        eventGroupIds: [" group:trust:1 ", "group:trust:1"],
        runIds: [" run:1 "],
        retentionPostures: ["governance", "governance"],
        lifecycleStates: ["active"],
        retentionPolicyKeys: [" retention-policy:workspace-default "],
        retainUntilAfter: "2027-04-01T00:00:00.000Z",
        occurredAfter: "2026-04-07T15:00:00.000Z",
      },
    });

    expect(query.workspaceId).toBe("workspace:1");
    expect(query.search).toBe("role");
    expect(query.filters?.categories).toEqual(["administrative"]);
    expect(query.filters?.outcomes).toEqual(["succeeded"]);
    expect(query.filters?.actionPrefix).toBe("workspace.");
    expect(query.filters?.eventGroupIds).toEqual(["group:trust:1"]);
    expect(query.filters?.runIds).toEqual(["run:1"]);
    expect(query.filters?.retentionPostures).toEqual(["governance"]);
    expect(query.filters?.lifecycleStates).toEqual(["active"]);
    expect(query.filters?.retentionPolicyKeys).toEqual(["retention-policy:workspace-default"]);
    expect(query.filters?.retainUntilAfter).toBe("2027-04-01T00:00:00.000Z");
    expect(query.filters?.occurredAfter).toBe("2026-04-07T15:00:00.000Z");
  });
});
