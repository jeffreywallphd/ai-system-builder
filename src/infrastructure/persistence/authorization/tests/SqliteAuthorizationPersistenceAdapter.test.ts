import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
  SharingSubjectKinds,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteAuthorizationPersistenceAdapter } from "../SqliteAuthorizationPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteAuthorizationPersistenceAdapter", () => {
  it("applies migrations and creates authorization persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-authorization-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "authorization.sqlite");

    const adapter = new SqliteAuthorizationPersistenceAdapter(databasePath);
    await adapter.upsertRoleAssignment({
      record: {
        id: "role-assignment:alpha",
        actorUserIdentityId: "user:member",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace:alpha",
        status: RoleAssignmentStatuses.active,
        assignedAt: "2026-04-05T12:00:00.000Z",
        assignedByUserIdentityId: "user:owner",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:role-assignment:alpha:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM authorization_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'authorization_role_assignments',
          'authorization_sharing_grants',
          'authorization_resource_policy_metadata',
          'authorization_mutation_replays'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "authorization_mutation_replays",
      "authorization_resource_policy_metadata",
      "authorization_role_assignments",
      "authorization_sharing_grants",
    ]);

    database.close();
  });

  it("supports authorization read and write paths with replay and revision checks", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-authorization-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteAuthorizationPersistenceAdapter(path.join(root, "authorization.sqlite"));

    const roleResult = await adapter.upsertRoleAssignment({
      record: {
        id: "role-assignment:alpha",
        actorUserIdentityId: "user:member",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace:alpha",
        status: RoleAssignmentStatuses.active,
        assignedAt: "2026-04-05T12:00:00.000Z",
        assignedByUserIdentityId: "user:owner",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:role-assignment:alpha:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const roleReplay = await adapter.upsertRoleAssignment({
      record: roleResult.record,
      mutation: {
        operationKey: "op:role-assignment:alpha:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    expect(roleReplay.wasReplay).toBeTrue();
    expect(roleReplay.changed).toBeFalse();

    const sharingResult = await adapter.upsertSharingGrant({
      record: {
        id: "sharing-grant:alpha",
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:001",
        workspaceId: "workspace:alpha",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user:viewer",
        },
        permissionKeys: ["asset.read", "asset.read"],
        grantedAt: "2026-04-05T12:05:00.000Z",
        grantedByUserIdentityId: "user:owner",
        expiresAt: "2026-04-05T13:05:00.000Z",
        createdAt: "2026-04-05T12:05:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:05:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:sharing-grant:alpha:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:05:00.000Z",
        },
      },
    });

    const sharingList = await adapter.listSharingGrants({
      workspaceId: "workspace:alpha",
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:001",
      },
      subjectUserIdentityId: "user:viewer",
      asOf: "2026-04-05T12:10:00.000Z",
    });
    expect(sharingList).toHaveLength(1);
    expect(sharingList[0]?.permissionKeys).toEqual(["asset.read"]);

    const sharingRevoked = await adapter.revokeSharingGrant({
      sharingGrantId: sharingResult.record.id,
      revokedAt: "2026-04-05T12:30:00.000Z",
      mutation: {
        operationKey: "op:sharing-grant:alpha:revoke",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:30:00.000Z",
        },
      },
    });
    expect(sharingRevoked.record.revokedAt).toBe("2026-04-05T12:30:00.000Z");

    const activeSharingAfterRevoke = await adapter.listSharingGrants({
      workspaceId: "workspace:alpha",
      asOf: "2026-04-05T12:45:00.000Z",
      includeRevoked: false,
    });
    expect(activeSharingAfterRevoke).toHaveLength(0);

    const policyResult = await adapter.upsertResourcePolicyMetadata({
      record: {
        resourceFamily: AuthorizationResourceFamilies.workflow,
        resourceType: "workflow",
        resourceId: "workflow:alpha",
        ownerUserIdentityId: "user:owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace:alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: true,
        isPublishedCapable: true,
        createdAt: "2026-04-05T12:10:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:10:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:resource-policy:alpha:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:10:00.000Z",
        },
      },
    });

    expect((await adapter.findResourcePolicyMetadata({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: "workflow",
      resourceId: "workflow:alpha",
    }))?.resourceId).toBe("workflow:alpha");

    await adapter.softDeleteResourcePolicyMetadata({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.workflow,
        resourceType: "workflow",
        resourceId: "workflow:alpha",
      },
      mutation: {
        operationKey: "op:resource-policy:alpha:soft-delete",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:20:00.000Z",
        },
      },
    });

    expect(await adapter.findResourcePolicyMetadata({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: "workflow",
      resourceId: "workflow:alpha",
    })).toBeUndefined();

    expect((await adapter.listResourcePolicyMetadata({
      workspaceId: "workspace:alpha",
      includeDeleted: false,
    })).length).toBe(0);

    expect((await adapter.listResourcePolicyMetadata({
      workspaceId: "workspace:alpha",
      includeDeleted: true,
    })).length).toBe(1);

    await expect(adapter.upsertResourcePolicyMetadata({
      record: {
        ...policyResult.record,
        visibility: ResourceVisibilities.workspace,
      },
      mutation: {
        operationKey: "op:resource-policy:alpha:stale",
        expectedRevision: 0,
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:40:00.000Z",
        },
      },
    })).rejects.toThrow("expectedRevision");

    adapter.dispose();
  });

  it("memoizes hot-path authorization reads when cache is enabled and invalidates on mutations", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-authorization-cache-enabled-"));
    createdRoots.push(root);
    const adapter = new SqliteAuthorizationPersistenceAdapter(path.join(root, "authorization.sqlite"), {
      cache: {
        enabled: true,
      },
    });

    await adapter.upsertRoleAssignment({
      record: {
        id: "role-assignment:cache-1",
        actorUserIdentityId: "user:cache-member",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace:cache",
        status: RoleAssignmentStatuses.active,
        assignedAt: "2026-04-05T12:00:00.000Z",
        assignedByUserIdentityId: "user:owner",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:role-assignment:cache-1:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const roleListA = await adapter.listRoleAssignments({
      workspaceId: "workspace:cache",
      includeRevoked: false,
    });
    const roleListB = await adapter.listRoleAssignments({
      workspaceId: "workspace:cache",
      includeRevoked: false,
    });
    expect(roleListA).toBe(roleListB);

    await adapter.upsertSharingGrant({
      record: {
        id: "sharing-grant:cache-1",
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:cache",
        workspaceId: "workspace:cache",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user:viewer",
        },
        permissionKeys: ["asset.read"],
        grantedAt: "2026-04-05T12:05:00.000Z",
        grantedByUserIdentityId: "user:owner",
        createdAt: "2026-04-05T12:05:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:05:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:sharing-grant:cache-1:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:05:00.000Z",
        },
      },
    });

    const sharingListA = await adapter.listSharingGrants({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:cache",
      },
      includeRevoked: false,
      asOf: "2026-04-05T12:10:00.000Z",
    });
    const sharingListB = await adapter.listSharingGrants({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:cache",
      },
      includeRevoked: false,
      asOf: "2026-04-05T12:10:00.000Z",
    });
    expect(sharingListA).toBe(sharingListB);

    await adapter.revokeSharingGrant({
      sharingGrantId: "sharing-grant:cache-1",
      revokedAt: "2026-04-05T12:20:00.000Z",
      mutation: {
        operationKey: "op:sharing-grant:cache-1:revoke",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:20:00.000Z",
        },
      },
    });

    const sharingListAfterRevoke = await adapter.listSharingGrants({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset:cache",
      },
      includeRevoked: false,
      asOf: "2026-04-05T12:21:00.000Z",
    });
    expect(sharingListAfterRevoke).toHaveLength(0);

    await adapter.upsertResourcePolicyMetadata({
      record: {
        resourceFamily: AuthorizationResourceFamilies.workflow,
        resourceType: "workflow",
        resourceId: "workflow:cache",
        ownerUserIdentityId: "user:owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace:cache",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
        createdAt: "2026-04-05T12:15:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:15:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:resource-policy:cache-1:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:15:00.000Z",
        },
      },
    });

    const policyA = await adapter.findResourcePolicyMetadata({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: "workflow",
      resourceId: "workflow:cache",
    });
    const policyB = await adapter.findResourcePolicyMetadata({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: "workflow",
      resourceId: "workflow:cache",
    });
    expect(policyA).toBe(policyB);
    expect(policyA?.visibility).toBe(ResourceVisibilities.shared);

    await adapter.upsertResourcePolicyMetadata({
      record: {
        ...(policyA as NonNullable<typeof policyA>),
        visibility: ResourceVisibilities.workspace,
      },
      mutation: {
        operationKey: "op:resource-policy:cache-1:update",
        expectedRevision: policyA?.revision,
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:25:00.000Z",
        },
      },
    });

    const policyAfterUpdate = await adapter.findResourcePolicyMetadata({
      resourceFamily: AuthorizationResourceFamilies.workflow,
      resourceType: "workflow",
      resourceId: "workflow:cache",
    });
    expect(policyAfterUpdate?.visibility).toBe(ResourceVisibilities.workspace);

    adapter.dispose();
  });

  it("allows disabling authorization read caching", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-authorization-cache-disabled-"));
    createdRoots.push(root);
    const adapter = new SqliteAuthorizationPersistenceAdapter(path.join(root, "authorization.sqlite"), {
      cache: {
        enabled: false,
      },
    });

    await adapter.upsertRoleAssignment({
      record: {
        id: "role-assignment:no-cache-1",
        actorUserIdentityId: "user:no-cache",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace:no-cache",
        status: RoleAssignmentStatuses.active,
        assignedAt: "2026-04-05T12:00:00.000Z",
        assignedByUserIdentityId: "user:owner",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user:owner",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user:owner",
        revision: 0,
      },
      mutation: {
        operationKey: "op:role-assignment:no-cache-1:create",
        context: {
          actorUserIdentityId: "user:owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    const roleListA = await adapter.listRoleAssignments({
      workspaceId: "workspace:no-cache",
      includeRevoked: false,
    });
    const roleListB = await adapter.listRoleAssignments({
      workspaceId: "workspace:no-cache",
      includeRevoked: false,
    });

    expect(roleListA).not.toBe(roleListB);
    expect(roleListA).toEqual(roleListB);

    adapter.dispose();
  });
});

