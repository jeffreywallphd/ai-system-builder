import { SharedApiSortDirections } from "@shared/contracts/api/SharedApiContractPrimitives";
import { GovernanceAuditEventOutcomes, GovernanceAuditEventTypes, normalizeGovernanceAuditQuery, type GovernanceAuditEventRecord, type GovernanceAuditReviewListQuery, type GovernanceAuditReviewListResult } from "@ui/shared/admin/GovernanceAuditReviewModel";
import { AuthorizationManagementService } from "./AuthorizationManagementService";
import { IdentityAuthService } from "./IdentityAuthService";
import { NodeInventoryService } from "./NodeInventoryService";
import { RuntimeOperationsService } from "./RuntimeOperationsService";

const ThinSafeEventTypes = new Set([
  GovernanceAuditEventTypes.deviceRevocation,
  GovernanceAuditEventTypes.nodeApproval,
  GovernanceAuditEventTypes.runGovernance,
]);

interface GovernanceAuditReviewServiceDependencies {
  readonly identityService: Pick<
    IdentityAuthService,
    "listIdentityAdminAccounts" | "listIdentityAdminSessions" | "listIdentityAdminTrustedDevices"
  >;
  readonly nodeService: Pick<NodeInventoryService, "listNodeInventory">;
  readonly authorizationService: Pick<AuthorizationManagementService, "readWorkspaceSharingReport">;
  readonly runtimeService: Pick<RuntimeOperationsService, "listQueueItems">;
}

export class GovernanceAuditReviewService {
  private readonly dependencies: GovernanceAuditReviewServiceDependencies;

  public constructor(dependencies?: Partial<GovernanceAuditReviewServiceDependencies>) {
    this.dependencies = Object.freeze({
      identityService: dependencies?.identityService ?? new IdentityAuthService(),
      nodeService: dependencies?.nodeService ?? new NodeInventoryService(),
      authorizationService: dependencies?.authorizationService ?? new AuthorizationManagementService(),
      runtimeService: dependencies?.runtimeService ?? new RuntimeOperationsService(),
    });
  }

  public async listGovernanceAuditEvents(input: {
    readonly actorUserIdentityId: string;
    readonly sessionToken: string;
    readonly query: GovernanceAuditReviewListQuery;
  }): Promise<{ readonly ok: true; readonly data: GovernanceAuditReviewListResult } | {
    readonly ok: false;
    readonly error: { readonly message: string };
  }> {
    try {
      const normalizedQuery = normalizeGovernanceAuditQuery(input.query);
      const workspaceId = normalizedQuery.workspaceId;
      const events: GovernanceAuditEventRecord[] = [];

      const accountsResponse = await this.dependencies.identityService.listIdentityAdminAccounts({
        context: { actorUserIdentityId: input.actorUserIdentityId },
        limit: 8,
        offset: 0,
      }, input.sessionToken);

      if (accountsResponse.ok && accountsResponse.data) {
        const accountIds = accountsResponse.data.accounts.map((account) => account.userIdentityId);
        const sessionAndDeviceResults = await Promise.all(accountIds.map(async (userIdentityId) => (
          Promise.all([
            this.dependencies.identityService.listIdentityAdminSessions({
              context: { actorUserIdentityId: input.actorUserIdentityId },
              userIdentityId,
              includeStatuses: Object.freeze(["active", "revoked", "expired", "rotated"]),
              limit: 20,
              offset: 0,
            }, input.sessionToken),
            this.dependencies.identityService.listIdentityAdminTrustedDevices({
              context: { actorUserIdentityId: input.actorUserIdentityId },
              userIdentityId,
              workspaceId,
              includeStatuses: Object.freeze(["trusted", "revoked", "expired", "pending-pairing"]),
              limit: 20,
              offset: 0,
            }, input.sessionToken),
          ])
        )));

        for (const [sessionResponse, deviceResponse] of sessionAndDeviceResults) {
          if (sessionResponse.ok && sessionResponse.data) {
            for (const session of sessionResponse.data.sessions) {
              events.push(Object.freeze({
                eventId: `login:${session.userIdentityId}:${session.sessionId}:${session.issuedAt}`,
                eventType: GovernanceAuditEventTypes.login,
                occurredAt: session.issuedAt,
                outcome: mapLoginOutcome(session.status),
                summary: `Login session ${session.status}`,
                actorId: session.userIdentityId,
                workspaceId,
                targetRef: session.sessionId,
                details: Object.freeze({
                  status: session.status,
                  accessChannel: session.accessChannel,
                  issuedAt: session.issuedAt,
                  expiresAt: session.expiresAt,
                  sessionId: session.sessionId,
                  deviceId: session.deviceId,
                  assurance: session.trust?.sessionAssuranceLevel,
                  trustState: session.trust?.trustState,
                }),
              }));
            }
          }

          if (deviceResponse.ok && deviceResponse.data) {
            for (const device of deviceResponse.data.devices) {
              if (!device.revocation?.revokedAt) {
                continue;
              }
              events.push(Object.freeze({
                eventId: `device-revoked:${device.trustedDeviceId}:${device.revocation.revokedAt}`,
                eventType: GovernanceAuditEventTypes.deviceRevocation,
                occurredAt: device.revocation.revokedAt,
                outcome: GovernanceAuditEventOutcomes.succeeded,
                summary: `Trusted device revoked (${device.revocation.reason ?? "unspecified"})`,
                actorId: device.revocation.revokedByUserIdentityId,
                workspaceId: device.workspaceId ?? workspaceId,
                targetRef: device.trustedDeviceId,
                details: Object.freeze({
                  trustedDeviceId: device.trustedDeviceId,
                  displayName: device.displayName,
                  trustStatus: device.trustStatus,
                  revocationReason: device.revocation.reason,
                  revokedAt: device.revocation.revokedAt,
                  revokedByUserIdentityId: device.revocation.revokedByUserIdentityId,
                }),
              }));
            }
          }
        }
      }

      const [nodeResponse, permissionResponse, queueResponse] = await Promise.all([
        this.dependencies.nodeService.listNodeInventory({
          approvalStatuses: Object.freeze(["approved"]),
          limit: 200,
          offset: 0,
        }, input.sessionToken),
        workspaceId
          ? this.dependencies.authorizationService.readWorkspaceSharingReport({
            workspaceId,
            includeRevokedRoleAssignments: true,
            includeRevokedSharingGrants: true,
            recentSharingMutationsLimit: 100,
          }, input.sessionToken)
          : Promise.resolve(undefined),
        this.dependencies.runtimeService.listQueueItems({
          statuses: Object.freeze(["failed", "cancelled", "completed", "running"]),
          limit: 200,
          offset: 0,
        }),
      ]);

      if (nodeResponse.ok && nodeResponse.data) {
        for (const node of nodeResponse.data.nodes) {
          if (!node.approvedAt) {
            continue;
          }
          events.push(Object.freeze({
            eventId: `node-approved:${node.nodeId}:${node.approvedAt}`,
            eventType: GovernanceAuditEventTypes.nodeApproval,
            occurredAt: node.approvedAt,
            outcome: GovernanceAuditEventOutcomes.succeeded,
            summary: `Node approved (${node.nodeType})`,
            workspaceId,
            targetRef: node.nodeId,
            details: Object.freeze({
              nodeId: node.nodeId,
              nodeType: node.nodeType,
              approvalStatus: node.approvalStatus,
              trustState: node.trustState,
              approvedAt: node.approvedAt,
              enrolledAt: node.enrolledAt,
            }),
          }));
        }
      }

      if (permissionResponse && permissionResponse.ok && permissionResponse.data) {
        for (const mutation of permissionResponse.data.recentSharingMutations) {
          events.push(Object.freeze({
            eventId: `permission-change:${mutation.grantId}:${mutation.mutationType}:${mutation.occurredAt}`,
            eventType: GovernanceAuditEventTypes.permissionChange,
            occurredAt: mutation.occurredAt,
            outcome: mutation.mutationType === "granted"
              ? GovernanceAuditEventOutcomes.succeeded
              : GovernanceAuditEventOutcomes.rejected,
            summary: `Permission ${mutation.mutationType}`,
            actorId: mutation.actorUserIdentityId,
            workspaceId,
            targetRef: `${mutation.resource.resourceType}:${mutation.resource.resourceId}`,
            details: Object.freeze({
              mutationType: mutation.mutationType,
              permissionKeys: mutation.permissionKeys,
              resourceFamily: mutation.resource.resourceFamily,
              resourceType: mutation.resource.resourceType,
              resourceId: mutation.resource.resourceId,
              target: mutation.target,
            }),
          }));
        }
      }

      if (queueResponse.ok && queueResponse.data) {
        for (const item of queueResponse.data.items) {
          const occurredAt = item.completedAt ?? item.startedAt ?? item.enqueuedAt;
          events.push(Object.freeze({
            eventId: `run:${item.executionId}:${item.status}:${occurredAt}`,
            eventType: GovernanceAuditEventTypes.runGovernance,
            occurredAt,
            outcome: mapRunOutcome(item.status),
            summary: `Run ${item.status} (${item.systemId})`,
            workspaceId,
            targetRef: item.executionId,
            details: Object.freeze({
              executionId: item.executionId,
              queueItemId: item.queueItemId,
              systemId: item.systemId,
              status: item.status,
              enqueuedAt: item.enqueuedAt,
              startedAt: item.startedAt,
              completedAt: item.completedAt,
            }),
          }));
        }
      }

      const filtered = applyFilters(events, normalizedQuery);
      const totalCount = filtered.length;
      const offset = normalizedQuery.pagination?.offset ?? 0;
      const limit = normalizedQuery.pagination?.limit ?? 25;
      const paged = filtered.slice(offset, offset + limit);

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          events: Object.freeze(paged),
          totalCount,
        }),
      });
    } catch {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          message: "Unable to load governance audit events.",
        }),
      });
    }
  }
}

function applyFilters(
  events: ReadonlyArray<GovernanceAuditEventRecord>,
  query: GovernanceAuditReviewListQuery,
): ReadonlyArray<GovernanceAuditEventRecord> {
  const filtered = events.filter((event) => {
    if (query.includeThinSafeOnly && !ThinSafeEventTypes.has(event.eventType)) {
      return false;
    }
    if (query.eventTypes && query.eventTypes.length > 0 && !query.eventTypes.includes(event.eventType)) {
      return false;
    }
    if (query.outcomes && query.outcomes.length > 0 && !query.outcomes.includes(event.outcome)) {
      return false;
    }
    if (!query.search || query.search.trim().length < 1) {
      return true;
    }
    const normalizedSearch = query.search.trim().toLowerCase();
    return event.summary.toLowerCase().includes(normalizedSearch)
      || event.eventType.toLowerCase().includes(normalizedSearch)
      || (event.actorId?.toLowerCase().includes(normalizedSearch) ?? false)
      || (event.targetRef?.toLowerCase().includes(normalizedSearch) ?? false);
  });

  const sortBy = query.sorting?.sortBy;
  const sortDirection = query.sorting?.sortDirection ?? SharedApiSortDirections.descending;
  const direction = sortDirection === SharedApiSortDirections.ascending ? 1 : -1;
  return Object.freeze(
    [...filtered].sort((left, right) => {
      if (sortBy === "eventType") {
        return direction * left.eventType.localeCompare(right.eventType);
      }
      return direction * (Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
    }),
  );
}

function mapLoginOutcome(
  status: "active" | "rotated" | "expired" | "revoked",
): GovernanceAuditEventRecord["outcome"] {
  if (status === "active") {
    return GovernanceAuditEventOutcomes.succeeded;
  }
  if (status === "revoked") {
    return GovernanceAuditEventOutcomes.rejected;
  }
  return GovernanceAuditEventOutcomes.failed;
}

function mapRunOutcome(
  status: "queued" | "running" | "completed" | "failed" | "cancelled",
): GovernanceAuditEventRecord["outcome"] {
  if (status === "completed" || status === "running" || status === "queued") {
    return GovernanceAuditEventOutcomes.succeeded;
  }
  if (status === "cancelled") {
    return GovernanceAuditEventOutcomes.rejected;
  }
  return GovernanceAuditEventOutcomes.failed;
}
