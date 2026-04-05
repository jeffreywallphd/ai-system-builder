import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AuthorizationManagementBackendApi } from "../AuthorizationManagementBackendApi";
import { GrantAuthorizationSharingAccessUseCase } from "../../../../src/application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "../../../../src/application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "../../../../src/application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "../../../../src/application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import { AuthorizationPolicyMutationService } from "../../../../src/application/authorization/use-cases/AuthorizationPolicyMutationService";
import { AuthorizationPolicyDecisionEvaluator } from "../../../../src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { AuthorizationResourceFamilies } from "../../../../src/domain/authorization/AuthorizationPermissionCatalog";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
} from "../../../../src/domain/authorization/AuthorizationDomain";
import { WorkspaceAuthorizationRoleKeys } from "../../../../src/domain/authorization/AuthorizationRoleDefinitions";
import { SqliteAuthorizationPersistenceAdapter } from "../../../../src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "../../../../src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("AuthorizationManagementBackendApi", () => {
  it("updates visibility, grants/revokes sharing, and reads effective access", async () => {
    const { api } = await createHarness();

    const visibility = await api.updateVisibility({
      actorUserIdentityId: "user-owner",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      },
      workspaceId: "workspace-1",
      visibility: "shared",
      sharingPolicyMode: "explicit",
      allowResharing: false,
      sharingGrants: [
        {
          id: "share-1",
          target: {
            kind: "user",
            userId: "user-viewer",
          },
          permissionKeys: ["asset.read"],
        },
      ],
      isPublishedCapable: false,
    });
    expect(visibility.ok).toBeTrue();

    const grant = await api.grantSharingAccess({
      actorUserIdentityId: "user-owner",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      },
      grant: {
        id: "share-2",
        target: {
          kind: "workspace-role",
          workspaceId: "workspace-1",
          roleKey: "member",
        },
        permissionKeys: ["asset.read"],
      },
    });
    expect(grant.ok).toBeTrue();

    const revoke = await api.revokeSharingAccess({
      actorUserIdentityId: "user-owner",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      },
      grantId: "share-2",
    });
    expect(revoke.ok).toBeTrue();
    if (revoke.ok) {
      expect(revoke.data.grant.revokedAt).toBeDefined();
    }

    const access = await api.readAccessState({
      actorUserIdentityId: "user-owner",
      inspectedActorUserIdentityId: "user-viewer",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      },
      includeDenied: true,
      includeRevokedSharingGrants: true,
    });

    expect(access.ok).toBeTrue();
    if (!access.ok) {
      return;
    }

    expect(access.data.inspectorActorUserIdentityId).toBe("user-owner");
    expect(access.data.inspectedActorUserIdentityId).toBe("user-viewer");
    expect(access.data.resourcePolicyMetadata.visibility).toBe("shared");
    expect(access.data.sharingGrants.some((grantItem) => grantItem.grantId === "share-1")).toBeTrue();
    expect(access.data.permissions.length).toBeGreaterThan(0);
    const readDecision = access.data.permissions.find((entry) => entry.permissionKey === "asset.read");
    expect(readDecision).toBeDefined();
    if (readDecision) {
      expect(
        readDecision.explanation.roleBasedGrants.contributedToDecision
        || readDecision.explanation.sharingBasedGrants.contributedToDecision
        || readDecision.explanation.visibilityContribution.contributedToDecision,
      ).toBeTrue();
      expect(readDecision.explanation.visibilityContribution.resourceVisibility).toBe("shared");
    }
  });

  it("denies sharing management and access-state reads for unauthorized actor", async () => {
    const { api } = await createHarness();

    const deniedGrant = await api.grantSharingAccess({
      actorUserIdentityId: "user-viewer",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      },
      grant: {
        id: "share-denied",
        target: {
          kind: "user",
          userId: "user-target",
        },
        permissionKeys: ["asset.read"],
      },
    });

    expect(deniedGrant.ok).toBeFalse();
    if (!deniedGrant.ok) {
      expect(deniedGrant.error?.code).toBe("forbidden");
    }

    const deniedAccessRead = await api.readAccessState({
      actorUserIdentityId: "user-viewer",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
      },
    });

    expect(deniedAccessRead.ok).toBeFalse();
    if (!deniedAccessRead.ok) {
      expect(deniedAccessRead.error?.code).toBe("forbidden");
    }
  });
});

async function createHarness(): Promise<{ readonly api: AuthorizationManagementBackendApi }> {
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-authorization-management-api-"));
  createdRoots.push(root);

  const adapter = new SqliteAuthorizationPersistenceAdapter(path.join(root, "authorization.sqlite"));
  const readAdapter = new SqliteAuthorizationPolicyReadAdapter({
    authorizationPersistenceAdapter: adapter,
  });

  const mutationService = new AuthorizationPolicyMutationService({
    ports: {
      roleAssignmentPersistenceRepository: adapter,
      sharingGrantPersistenceRepository: adapter,
      resourcePolicyMetadataPersistenceRepository: adapter,
    },
    clock: {
      now: () => new Date("2026-04-05T12:00:00.000Z"),
    },
  });

  const decisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
    roleGrantReadRepository: readAdapter,
    sharingGrantReadRepository: readAdapter,
    resourcePolicyMetadataReadRepository: readAdapter,
    clock: {
      now: () => new Date("2026-04-05T12:00:00.000Z"),
    },
  });

  await adapter.upsertResourcePolicyMetadata({
    record: {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-1",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: SharingPolicyModes.explicit,
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 0,
    },
    mutation: {
      operationKey: "seed-resource-policy",
      context: {
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-05T11:00:00.000Z",
      },
    },
  });

  await adapter.upsertRoleAssignment({
    record: {
      id: "role-owner",
      actorUserIdentityId: "user-owner",
      roleKey: WorkspaceAuthorizationRoleKeys.owner,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T11:00:00.000Z",
      assignedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 0,
    },
    mutation: {
      operationKey: "seed-owner-role",
      context: {
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-05T11:00:00.000Z",
      },
    },
  });

  await adapter.upsertRoleAssignment({
    record: {
      id: "role-viewer",
      actorUserIdentityId: "user-viewer",
      roleKey: WorkspaceAuthorizationRoleKeys.viewer,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T11:00:00.000Z",
      assignedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 0,
    },
    mutation: {
      operationKey: "seed-viewer-role",
      context: {
        actorUserIdentityId: "user-owner",
        occurredAt: "2026-04-05T11:00:00.000Z",
      },
    },
  });

  const api = new AuthorizationManagementBackendApi({
    grantSharingAccessUseCase: new GrantAuthorizationSharingAccessUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: adapter,
        sharingGrantPersistenceRepository: adapter,
        resourcePolicyMetadataPersistenceRepository: adapter,
      },
    }),
    revokeSharingAccessUseCase: new RevokeAuthorizationSharingAccessUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: adapter,
        sharingGrantPersistenceRepository: adapter,
        resourcePolicyMetadataPersistenceRepository: adapter,
      },
    }),
    updateVisibilityUseCase: new UpdateAuthorizationVisibilityUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: adapter,
        sharingGrantPersistenceRepository: adapter,
        resourcePolicyMetadataPersistenceRepository: adapter,
      },
    }),
    listEffectiveAccessUseCase: new ListAuthorizationEffectiveAccessUseCase({
      decisionEvaluator,
      roleGrantReadRepository: readAdapter,
      sharingGrantReadRepository: readAdapter,
      resourcePolicyMetadataReadRepository: readAdapter,
    }),
    decisionEvaluator,
    sharingGrantPersistenceRepository: adapter,
    resourcePolicyMetadataPersistenceRepository: adapter,
  });

  return Object.freeze({ api });
}
