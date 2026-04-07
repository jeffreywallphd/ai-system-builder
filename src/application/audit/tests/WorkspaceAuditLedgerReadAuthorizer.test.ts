import { describe, expect, it } from "bun:test";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceAuditLedgerReadAuthorizer } from "../use-cases/WorkspaceAuditLedgerReadAuthorizer";

class InMemoryWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public snapshot?: WorkspaceAuthorizationSnapshot;

  public lastQuery?: WorkspaceAuthorizationSnapshotQuery;

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    this.lastQuery = query;
    return this.snapshot;
  }
}

describe("WorkspaceAuditLedgerReadAuthorizer", () => {
  it("denies reads without a single workspace scope", async () => {
    const repository = new InMemoryWorkspaceAuthorizationReadRepository();
    const authorizer = new WorkspaceAuditLedgerReadAuthorizer({
      workspaceAuthorizationReadRepository: repository,
    });

    const noWorkspace = await authorizer.authorizeAuditLedgerRead({
      requesterId: "user:auditor",
      query: {},
    });
    const twoWorkspaces = await authorizer.authorizeAuditLedgerRead({
      requesterId: "user:auditor",
      query: {
        filters: {
          workspaceIds: ["workspace:one", "workspace:two"],
        },
      },
    });

    expect(noWorkspace.allowed).toBeFalse();
    expect(twoWorkspaces.allowed).toBeFalse();
  });

  it("grants admin scope for owner/admin workspace actors", async () => {
    const repository = new InMemoryWorkspaceAuthorizationReadRepository();
    repository.snapshot = createSnapshot({
      effectiveRoles: [WorkspaceRoles.admin],
      isWorkspaceOwner: false,
      membershipStatus: WorkspaceMembershipStatuses.active,
    });
    const authorizer = new WorkspaceAuditLedgerReadAuthorizer({
      workspaceAuthorizationReadRepository: repository,
      clock: {
        now: () => new Date("2026-04-07T20:30:00.000Z"),
      },
    });

    const decision = await authorizer.authorizeAuditLedgerRead({
      requesterId: "user:admin",
      query: {
        workspaceId: "workspace:alpha",
      },
    });

    expect(decision.allowed).toBeTrue();
    if (!decision.allowed) {
      return;
    }
    expect(decision.scope?.workspaceIds).toEqual(["workspace:alpha"]);
    expect(decision.scope?.canReadProtectedData).toBeTrue();
    expect(decision.scope?.enforceThinSafeOnly).toBeUndefined();
    expect(decision.scope?.detailVisibility).toBe("admin");
    expect(repository.lastQuery?.asOf).toBe("2026-04-07T20:30:00.000Z");
  });

  it("grants thin-safe user-safe scope for non-admin active members", async () => {
    const repository = new InMemoryWorkspaceAuthorizationReadRepository();
    repository.snapshot = createSnapshot({
      effectiveRoles: [WorkspaceRoles.member],
      isWorkspaceOwner: false,
      membershipStatus: WorkspaceMembershipStatuses.active,
    });
    const authorizer = new WorkspaceAuditLedgerReadAuthorizer({
      workspaceAuthorizationReadRepository: repository,
    });

    const decision = await authorizer.authorizeAuditLedgerRead({
      requesterId: "user:member",
      query: {
        workspaceId: "workspace:alpha",
      },
    });

    expect(decision.allowed).toBeTrue();
    if (!decision.allowed) {
      return;
    }
    expect(decision.scope?.workspaceIds).toEqual(["workspace:alpha"]);
    expect(decision.scope?.enforceThinSafeOnly).toBeTrue();
    expect(decision.scope?.canReadProtectedData).toBeFalse();
    expect(decision.scope?.allowedCategories).toEqual([
      "administrative",
      "orchestration",
      "sharing",
    ]);
    expect(decision.scope?.detailVisibility).toBe("user-safe");
  });

  it("denies suspended memberships", async () => {
    const repository = new InMemoryWorkspaceAuthorizationReadRepository();
    repository.snapshot = createSnapshot({
      effectiveRoles: [WorkspaceRoles.member],
      isWorkspaceOwner: false,
      membershipStatus: WorkspaceMembershipStatuses.suspended,
    });
    const authorizer = new WorkspaceAuditLedgerReadAuthorizer({
      workspaceAuthorizationReadRepository: repository,
    });

    const decision = await authorizer.authorizeAuditLedgerRead({
      requesterId: "user:suspended",
      query: {
        workspaceId: "workspace:alpha",
      },
    });

    expect(decision.allowed).toBeFalse();
  });
});

function createSnapshot(input: {
  readonly effectiveRoles: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
  readonly isWorkspaceOwner: boolean;
  readonly membershipStatus: "pending" | "active" | "suspended" | "removed";
}): WorkspaceAuthorizationSnapshot {
  return Object.freeze({
    workspace: Object.freeze({
      id: "workspace:alpha",
      slug: "workspace-alpha",
      displayName: "Workspace Alpha",
      status: "active",
      description: undefined,
      ownership: Object.freeze({
        workspaceId: "workspace:alpha",
        ownerUserId: "user:owner",
        visibility: "private",
        createdBy: "user:owner",
        createdAt: "2026-04-07T20:00:00.000Z",
        lastModifiedBy: "user:owner",
        lastModifiedAt: "2026-04-07T20:00:00.000Z",
      }),
      encryptionPolicy: Object.freeze({
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
      }),
    }),
    membership: Object.freeze({
      id: "workspace-membership:alpha:user",
      workspaceId: "workspace:alpha",
      userIdentityId: "user:actor",
      status: input.membershipStatus,
      createdAt: "2026-04-07T20:00:00.000Z",
      updatedAt: "2026-04-07T20:00:00.000Z",
      createdBy: "user:owner",
      lastModifiedBy: "user:owner",
    }),
    activeRoleAssignments: Object.freeze([]),
    effectiveRoles: Object.freeze(input.effectiveRoles),
    isWorkspaceOwner: input.isWorkspaceOwner,
  });
}
