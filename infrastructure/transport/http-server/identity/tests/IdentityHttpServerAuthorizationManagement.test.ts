import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { AuthorizationManagementBackendApi } from "../../../../api/authorization/AuthorizationManagementBackendApi";
import { SqliteAuthorizationPersistenceAdapter } from "../../../../../src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "../../../../../src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";
import { AuthorizationPolicyMutationService } from "../../../../../src/application/authorization/use-cases/AuthorizationPolicyMutationService";
import { AuthorizationPolicyDecisionEvaluator } from "../../../../../src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { GrantAuthorizationSharingAccessUseCase } from "../../../../../src/application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "../../../../../src/application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "../../../../../src/application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "../../../../../src/application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "../../../../../src/application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import { AuthorizationResourceFamilies } from "../../../../../src/domain/authorization/AuthorizationPermissionCatalog";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
} from "../../../../../src/domain/authorization/AuthorizationDomain";
import { WorkspaceAuthorizationRoleKeys } from "../../../../../src/domain/authorization/AuthorizationRoleDefinitions";

const servers: Server[] = [];
const cleanup: Array<() => void> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
  while (cleanup.length > 0) {
    cleanup.pop()?.();
  }
});

describe("IdentityHttpServer authorization management routes", () => {
  it("supports visibility updates, sharing grant lifecycle, and access-state inspection", async () => {
    const harness = await startServer();
    const owner = await registerAndLogin(harness.baseUrl, "auth.mgmt.owner", "auth-owner@example.com");
    await seedAuthorizationResource(harness.adapter, owner.userIdentityId, "user-viewer");

    const updateResponse = await fetch(`${harness.baseUrl}/api/v1/authorization/resources/asset/asset/asset-1/visibility`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
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
      }),
    });
    expect(updateResponse.status).toBe(200);

    const grantResponse = await fetch(`${harness.baseUrl}/api/v1/authorization/resources/asset/asset/asset-1/sharing-grants`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        grant: {
          id: "share-2",
          target: {
            kind: "workspace-role",
            workspaceId: "workspace-1",
            roleKey: "member",
          },
          permissionKeys: ["asset.read"],
        },
      }),
    });
    expect(grantResponse.status).toBe(200);

    const revokeResponse = await fetch(`${harness.baseUrl}/api/v1/authorization/resources/asset/asset/asset-1/sharing-grants/share-2`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(revokeResponse.status).toBe(200);

    const accessStateResponse = await fetch(`${harness.baseUrl}/api/v1/authorization/resources/asset/asset/asset-1/access-state?includeDenied=true&includeRevokedSharingGrants=true&inspectedActorUserIdentityId=user-viewer`, {
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
      },
    });
    expect(accessStateResponse.status).toBe(200);
    const accessStateBody = await accessStateResponse.json();
    expect(accessStateBody.ok).toBe(true);
    expect(accessStateBody.data.inspectorActorUserIdentityId).toBe(owner.userIdentityId);
    expect(accessStateBody.data.inspectedActorUserIdentityId).toBe("user-viewer");
    expect(accessStateBody.data.resourcePolicyMetadata.visibility).toBe("shared");
    expect(accessStateBody.data.sharingGrants.some((grant: { grantId: string }) => grant.grantId === "share-1")).toBe(true);
  });

  it("denies unauthorized caller and enforces validation", async () => {
    const harness = await startServer();
    const owner = await registerAndLogin(harness.baseUrl, "auth.mgmt.owner.2", "auth-owner2@example.com");
    const viewer = await registerAndLogin(harness.baseUrl, "auth.mgmt.viewer", "auth-viewer@example.com");
    await seedAuthorizationResource(harness.adapter, owner.userIdentityId, viewer.userIdentityId);

    const deniedGrant = await fetch(`${harness.baseUrl}/api/v1/authorization/resources/asset/asset/asset-1/sharing-grants`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${viewer.sessionToken}`,
      },
      body: JSON.stringify({
        grant: {
          id: "share-denied",
          target: {
            kind: "user",
            userId: "user-target",
          },
          permissionKeys: ["asset.read"],
        },
      }),
    });
    expect(deniedGrant.status).toBe(403);

    const invalidVisibility = await fetch(`${harness.baseUrl}/api/v1/authorization/resources/asset/asset/asset-1/visibility`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        visibility: "shared",
        sharingPolicyMode: "workspace-members",
        sharingGrants: [],
      }),
    });

    expect(invalidVisibility.status).toBe(400);
    const invalidBody = await invalidVisibility.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
    expect(Array.isArray(invalidBody.error.validationErrors)).toBe(true);
  });

  it("supports bulk workspace-role sharing grant operations with partial failures", async () => {
    const harness = await startServer();
    const owner = await registerAndLogin(harness.baseUrl, "auth.mgmt.owner.bulk", "auth-owner-bulk@example.com");
    await seedAuthorizationResource(harness.adapter, owner.userIdentityId, "user-viewer");
    await harness.adapter.upsertResourcePolicyMetadata({
      record: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-private",
        ownerUserIdentityId: owner.userIdentityId,
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-1",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
        createdAt: "2026-04-05T11:00:00.000Z",
        createdBy: owner.userIdentityId,
        lastModifiedAt: "2026-04-05T11:00:00.000Z",
        lastModifiedBy: owner.userIdentityId,
        revision: 0,
      },
      mutation: {
        operationKey: "seed-private-resource",
        context: {
          actorUserIdentityId: owner.userIdentityId,
          occurredAt: "2026-04-05T11:00:00.000Z",
        },
      },
    });

    const bulkResponse = await fetch(`${harness.baseUrl}/api/v1/authorization/sharing-grants/workspace-role/bulk-upsert`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        roleKey: "viewer",
        resources: [
          {
            resourceFamily: "asset",
            resourceType: "asset",
            resourceId: "asset-1",
          },
          {
            resourceFamily: "asset",
            resourceType: "asset",
            resourceId: "asset-private",
          },
        ],
        permissionKeys: ["asset.read"],
      }),
    });
    expect(bulkResponse.status).toBe(200);
    const bulkBody = await bulkResponse.json();
    expect(bulkBody.ok).toBe(true);
    expect(bulkBody.data.succeededResources).toBe(1);
    expect(bulkBody.data.failedResources).toBe(1);
  });
});

async function startServer(): Promise<{
  readonly baseUrl: string;
  readonly adapter: SqliteAuthorizationPersistenceAdapter;
}> {
  const identityHarness = await createIdentityAuthTestHarness();
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-identity-http-auth-mgmt-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));

  const adapter = new SqliteAuthorizationPersistenceAdapter(path.join(root, "authorization.sqlite"));
  cleanup.push(() => adapter.dispose());

  const readAdapter = new SqliteAuthorizationPolicyReadAdapter({ authorizationPersistenceAdapter: adapter });
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

  const authorizationManagementBackendApi = new AuthorizationManagementBackendApi({
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
    bulkGrantWorkspaceRoleAccessUseCase: new BulkGrantAuthorizationWorkspaceRoleAccessUseCase({
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

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authorizationManagementBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);

  const address = server.address() as AddressInfo;
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    adapter,
  });
}

async function registerAndLogin(
  baseUrl: string,
  username: string,
  email: string,
): Promise<{ readonly userIdentityId: string; readonly sessionToken: string }> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      email,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  const registerBody = await registerResponse.json();

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  const loginBody = await loginResponse.json();

  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId,
    sessionToken: loginBody.data.sessionToken,
  });
}

async function seedAuthorizationResource(
  adapter: SqliteAuthorizationPersistenceAdapter,
  ownerUserIdentityId: string,
  viewerUserIdentityId: string,
): Promise<void> {
  await adapter.upsertResourcePolicyMetadata({
    record: {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-1",
      ownerUserIdentityId,
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: SharingPolicyModes.explicit,
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: ownerUserIdentityId,
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: ownerUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-resource",
      context: {
        actorUserIdentityId: ownerUserIdentityId,
        occurredAt: "2026-04-05T11:00:00.000Z",
      },
    },
  });

  await adapter.upsertRoleAssignment({
    record: {
      id: "seed-owner-role",
      actorUserIdentityId: ownerUserIdentityId,
      roleKey: WorkspaceAuthorizationRoleKeys.owner,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T11:00:00.000Z",
      assignedByUserIdentityId: ownerUserIdentityId,
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: ownerUserIdentityId,
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: ownerUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-owner-role-op",
      context: {
        actorUserIdentityId: ownerUserIdentityId,
        occurredAt: "2026-04-05T11:00:00.000Z",
      },
    },
  });

  await adapter.upsertRoleAssignment({
    record: {
      id: "seed-viewer-role",
      actorUserIdentityId: viewerUserIdentityId,
      roleKey: WorkspaceAuthorizationRoleKeys.viewer,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T11:00:00.000Z",
      assignedByUserIdentityId: ownerUserIdentityId,
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: ownerUserIdentityId,
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: ownerUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-viewer-role-op",
      context: {
        actorUserIdentityId: ownerUserIdentityId,
        occurredAt: "2026-04-05T11:00:00.000Z",
      },
    },
  });
}
