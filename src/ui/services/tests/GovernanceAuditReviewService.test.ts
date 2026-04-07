import { describe, expect, it, mock } from "bun:test";
import { GovernanceAuditReviewService } from "../GovernanceAuditReviewService";
import {
  GovernanceAuditEventTypes,
  type GovernanceAuditReviewListQuery,
} from "@ui/shared/admin/GovernanceAuditReviewModel";

describe("GovernanceAuditReviewService", () => {
  it("aggregates prioritized governance events and applies filters", async () => {
    const service = new GovernanceAuditReviewService({
      identityService: {
        listIdentityAdminAccounts: mock(async () => ({
          ok: true,
          data: Object.freeze({
            accounts: Object.freeze([
              Object.freeze({ userIdentityId: "user-1" }),
            ]),
          }),
        })),
        listIdentityAdminSessions: mock(async () => ({
          ok: true,
          data: Object.freeze({
            sessions: Object.freeze([
              Object.freeze({
                userIdentityId: "user-1",
                sessionId: "identity-session:1",
                issuedAt: "2026-04-07T10:00:00.000Z",
                expiresAt: "2026-04-07T18:00:00.000Z",
                status: "active",
                accessChannel: "desktop",
                deviceId: "device:1",
                trust: Object.freeze({
                  sessionAssuranceLevel: "authenticated-trusted",
                  trustState: "trusted",
                }),
              }),
            ]),
          }),
        })),
        listIdentityAdminTrustedDevices: mock(async () => ({
          ok: true,
          data: Object.freeze({
            devices: Object.freeze([
              Object.freeze({
                trustedDeviceId: "trusted-device:1",
                workspaceId: "workspace-alpha",
                displayName: "Alice Laptop",
                trustStatus: "revoked",
                revocation: Object.freeze({
                  revokedAt: "2026-04-07T09:00:00.000Z",
                  reason: "policy",
                  revokedByUserIdentityId: "user-admin",
                }),
              }),
            ]),
          }),
        })),
      } as any,
      nodeService: {
        listNodeInventory: mock(async () => ({
          ok: true,
          data: Object.freeze({
            nodes: Object.freeze([
              Object.freeze({
                nodeId: "node:1",
                nodeType: "gpu",
                approvalStatus: "approved",
                trustState: "trusted",
                approvedAt: "2026-04-07T08:00:00.000Z",
                enrolledAt: "2026-04-07T07:00:00.000Z",
              }),
            ]),
          }),
        })),
      } as any,
      authorizationService: {
        readWorkspaceSharingReport: mock(async () => ({
          ok: true,
          data: Object.freeze({
            recentSharingMutations: Object.freeze([
              Object.freeze({
                grantId: "grant-1",
                mutationType: "granted",
                occurredAt: "2026-04-07T06:00:00.000Z",
                actorUserIdentityId: "user-admin",
                permissionKeys: Object.freeze(["workflow.share"]),
                resource: Object.freeze({
                  resourceFamily: "workflow",
                  resourceType: "workflow-definition",
                  resourceId: "workflow:1",
                }),
                target: Object.freeze({
                  principalType: "workspace-role",
                  principalId: "member",
                }),
              }),
            ]),
          }),
        })),
      } as any,
      runtimeService: {
        listQueueItems: mock(async () => ({
          ok: true,
          data: Object.freeze({
            items: Object.freeze([
              Object.freeze({
                queueItemId: "queue:1",
                executionId: "execution:1",
                systemId: "system:alpha",
                status: "failed",
                enqueuedAt: "2026-04-07T04:00:00.000Z",
                startedAt: "2026-04-07T04:10:00.000Z",
                completedAt: "2026-04-07T04:30:00.000Z",
              }),
            ]),
            totalCount: 1,
          }),
        })),
      } as any,
    });

    const query: GovernanceAuditReviewListQuery = Object.freeze({
      workspaceId: "workspace-alpha",
      search: "policy",
      eventTypes: Object.freeze([GovernanceAuditEventTypes.deviceRevocation]),
      pagination: Object.freeze({ limit: 25, offset: 0 }),
      sorting: Object.freeze({ sortBy: "occurredAt", sortDirection: "desc" }),
    });
    const response = await service.listGovernanceAuditEvents({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      query,
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.totalCount).toBe(1);
    expect(response.data?.events.map((event) => event.eventType)).toEqual(["device-revocation"]);
  });

  it("enforces thin-safe filtering for admin-lite views", async () => {
    const service = new GovernanceAuditReviewService({
      identityService: {
        listIdentityAdminAccounts: mock(async () => ({
          ok: true,
          data: Object.freeze({ accounts: Object.freeze([]) }),
        })),
      } as any,
      nodeService: {
        listNodeInventory: mock(async () => ({
          ok: true,
          data: Object.freeze({
            nodes: Object.freeze([
              Object.freeze({
                nodeId: "node:1",
                nodeType: "gpu",
                approvalStatus: "approved",
                trustState: "trusted",
                approvedAt: "2026-04-07T08:00:00.000Z",
                enrolledAt: "2026-04-07T07:00:00.000Z",
              }),
            ]),
          }),
        })),
      } as any,
      authorizationService: {
        readWorkspaceSharingReport: mock(async () => ({
          ok: true,
          data: Object.freeze({
            recentSharingMutations: Object.freeze([
              Object.freeze({
                grantId: "grant-1",
                mutationType: "revoked",
                occurredAt: "2026-04-07T06:00:00.000Z",
                actorUserIdentityId: "user-admin",
                permissionKeys: Object.freeze(["workflow.share"]),
                resource: Object.freeze({
                  resourceFamily: "workflow",
                  resourceType: "workflow-definition",
                  resourceId: "workflow:1",
                }),
                target: Object.freeze({
                  principalType: "workspace-role",
                  principalId: "member",
                }),
              }),
            ]),
          }),
        })),
      } as any,
      runtimeService: {
        listQueueItems: mock(async () => ({
          ok: true,
          data: Object.freeze({
            items: Object.freeze([
              Object.freeze({
                queueItemId: "queue:1",
                executionId: "execution:1",
                systemId: "system:alpha",
                status: "completed",
                enqueuedAt: "2026-04-07T04:00:00.000Z",
              }),
            ]),
            totalCount: 1,
          }),
        })),
      } as any,
    });

    const response = await service.listGovernanceAuditEvents({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      query: Object.freeze({
        workspaceId: "workspace-alpha",
        includeThinSafeOnly: true,
        pagination: Object.freeze({ limit: 25, offset: 0 }),
      }),
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.events.every((event) => (
      event.eventType === GovernanceAuditEventTypes.nodeApproval
      || event.eventType === GovernanceAuditEventTypes.deviceRevocation
      || event.eventType === GovernanceAuditEventTypes.runGovernance
    ))).toBeTrue();
    expect(response.data?.events.some((event) => event.eventType === GovernanceAuditEventTypes.permissionChange)).toBeFalse();
  });

  it("returns a stable error result when aggregation fails", async () => {
    const service = new GovernanceAuditReviewService({
      identityService: {
        listIdentityAdminAccounts: mock(async () => {
          throw new Error("boom");
        }),
      } as any,
    });

    const response = await service.listGovernanceAuditEvents({
      actorUserIdentityId: "user-admin",
      sessionToken: "token-1",
      query: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.message).toBe("Unable to load governance audit events.");
  });
});
