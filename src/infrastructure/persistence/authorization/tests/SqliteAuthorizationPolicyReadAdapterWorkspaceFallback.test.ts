import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { SqliteAuthorizationPersistenceAdapter } from "../SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "../SqliteAuthorizationPolicyReadAdapter";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses, WorkspaceRoles, WorkspaceStatuses, createWorkspace, createWorkspaceMembership } from "@domain/workspaces/WorkspaceDomain";

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

const createdRoots: string[] = [];

class StubWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    return Object.freeze({
      workspace: createWorkspace({
        workspaceId: query.workspaceId,
        slug: "workspace-alpha",
        displayName: "Workspace Alpha",
        status: WorkspaceStatuses.active,
        createdBy: "user:owner",
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }),
      membership: createWorkspaceMembership({
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        role: WorkspaceRoles.owner,
        status: WorkspaceMembershipStatuses.active,
        joinedAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }),
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: Object.freeze([WorkspaceRoles.owner]),
      isWorkspaceOwner: true,
    });
  }
}

describe("SqliteAuthorizationPolicyReadAdapter workspace membership fallback", () => {
  it("allows workspace-capability asset.create decisions for active workspace owners without persisted role rows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-auth-policy-read-fallback-"));
    createdRoots.push(root);
    const authorizationPersistenceAdapter = new SqliteAuthorizationPersistenceAdapter(path.join(root, "authorization.sqlite"));
    const workspaceAuthorizationReadRepository = new StubWorkspaceAuthorizationReadRepository();
    const readAdapter = new SqliteAuthorizationPolicyReadAdapter({
      authorizationPersistenceAdapter,
      workspaceAuthorizationReadRepository,
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: readAdapter,
      sharingGrantReadRepository: readAdapter,
      resourcePolicyMetadataReadRepository: readAdapter,
    });

    const decision = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace:alpha",
      },
      requiredPermissionKey: "asset.create",
      target: {
        kind: "workspace-capability",
        workspaceId: "workspace:alpha",
        capabilityResourceType: AuthorizationResourceFamilies.asset,
      },
      asOf: "2026-04-10T00:05:00.000Z",
    });

    expect(decision.decision.isAllowed).toBeTrue();
    expect(decision.decision.reasonCode).toBe("matched-role-grant");

    authorizationPersistenceAdapter.dispose();
  });
});
