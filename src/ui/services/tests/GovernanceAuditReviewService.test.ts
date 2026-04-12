import { describe, expect, it, mock } from "bun:test";
import { GovernanceAuditReviewService } from "../GovernanceAuditReviewService";

describe("GovernanceAuditReviewService", () => {
  it("maps authoritative governance projection responses for UI consumption", async () => {
    const service = new GovernanceAuditReviewService({
      client: {
        listGovernanceAuditEvents: mock(async () => Object.freeze({
          ok: true,
          data: Object.freeze({
            events: Object.freeze([
              Object.freeze({
                eventId: "audit:event:1",
                eventType: "workspace-member-removed",
                category: "administrative",
                action: "workspace.member.removed",
                outcome: "rejected",
                occurredAt: "2026-04-07T10:00:00.000Z",
                recordedAt: "2026-04-07T10:00:10.000Z",
                summary: "workspace.member.removed (rejected)",
                actorId: "user:admin",
                actorKind: "user",
                workspaceId: "workspace-alpha",
                targetRef: "workspace-member:user:member",
                details: Object.freeze({
                  reason: "policy",
                }),
                hasProtectedData: false,
                redactionReasons: Object.freeze([]),
              }),
            ]),
            facets: Object.freeze([
              Object.freeze({
                key: "eventType",
                options: Object.freeze([
                  Object.freeze({ value: "workspace-member-removed", count: 1 }),
                ]),
              }),
            ]),
            totalCount: 1,
            query: Object.freeze({
              workspaceId: "workspace-alpha",
            }),
            pagination: Object.freeze({
              limit: 25,
              offset: 0,
              returned: 1,
              hasMore: false,
            }),
            explanatory: Object.freeze({
              detailVisibility: "user-safe",
              facetCoverage: "page",
              notes: Object.freeze([
                "Summary rows are user-safe by default and never include admin-only detail payloads.",
              ]),
            }),
          }),
        })),
      },
    });

    const response = await service.listGovernanceAuditEvents({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      query: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
    });

    expect(response.ok).toBeTrue();
    if (!response.ok) {
      return;
    }

    expect(response.data.totalCount).toBe(1);
    expect(response.data.events[0]?.eventType).toBe("workspace-member-removed");
    expect(response.data.events[0]?.details).toEqual({ reason: "policy" });
    expect(response.data.facets?.[0]?.key).toBe("eventType");
  });

  it("returns stable errors when the projection client fails", async () => {
    const service = new GovernanceAuditReviewService({
      client: {
        listGovernanceAuditEvents: mock(async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "forbidden",
            message: "Requester is not authorized.",
          }),
        })),
      },
    });

    const response = await service.listGovernanceAuditEvents({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      query: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
    });

    expect(response.ok).toBeFalse();
    if (response.ok) {
      return;
    }
    expect(response.error.message).toBe("Requester is not authorized.");
  });
});
