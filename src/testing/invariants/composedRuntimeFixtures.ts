import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createIdentityAuthTestHarness } from "@infrastructure/api/identity/tests/TestIdentityAuthHarness";
import { AuthorizationManagementBackendApi } from "@infrastructure/api/authorization/AuthorizationManagementBackendApi";
import { SqliteAuthorizationPersistenceAdapter } from "@infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "@infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";
import { createIdentityHttpServer } from "@infrastructure/transport/http-server/identity/IdentityHttpServer";
import { AuthorizationPolicyMutationService } from "@application/authorization/use-cases/AuthorizationPolicyMutationService";
import { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { GrantAuthorizationSharingAccessUseCase } from "@application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "@application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "@application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "@application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "@application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";

const FIXTURE_CLOCK = "2026-04-05T12:00:00.000Z";
const FIXTURE_SEED_TIME = "2026-04-05T11:00:00.000Z";
const DEFAULT_PASSWORD = "StrongPass!2026";

export interface AuthorizationInvariantRuntimeParticipants {
  readonly routeFamily: {
    readonly routeFamilyId: "authorization-management";
    readonly transport: "IdentityHttpServer";
    readonly backendApi: "AuthorizationManagementBackendApi";
  };
  readonly evaluator: {
    readonly policyDecisionEvaluator: "AuthorizationPolicyDecisionEvaluator";
    readonly mutationService: "AuthorizationPolicyMutationService";
  };
  readonly repositories: {
    readonly policyReadRepository: "SqliteAuthorizationPolicyReadAdapter";
    readonly roleAssignmentPersistenceRepository: "SqliteAuthorizationPersistenceAdapter";
    readonly sharingGrantPersistenceRepository: "SqliteAuthorizationPersistenceAdapter";
    readonly resourcePolicyMetadataPersistenceRepository: "SqliteAuthorizationPersistenceAdapter";
  };
  readonly adapters: {
    readonly identityAuthHarness: "createIdentityAuthTestHarness";
    readonly authorizationPersistence: "SqliteAuthorizationPersistenceAdapter";
  };
}

export interface RuntimeInvariantActorSession {
  readonly userIdentityId: string;
  readonly sessionToken: string;
}

export interface SeedAuthorizationResourceInput {
  readonly ownerUserIdentityId: string;
  readonly viewerUserIdentityId: string;
  readonly workspaceId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

export interface AuthorizationInvariantRuntimeFixture {
  readonly baseUrl: string;
  readonly workspaceId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly participants: AuthorizationInvariantRuntimeParticipants;
  registerAndLogin(username: string, email: string): Promise<RuntimeInvariantActorSession>;
  seedWorkspaceAssetAuthorizationResource(input: SeedAuthorizationResourceInput): Promise<void>;
  dispose(): Promise<void>;
}

interface RuntimeFixtureState {
  readonly rootDirectory: string;
  readonly server: Server;
  readonly authorizationAdapter: SqliteAuthorizationPersistenceAdapter;
}

function createRuntimeParticipants(): AuthorizationInvariantRuntimeParticipants {
  return Object.freeze({
    routeFamily: Object.freeze({
      routeFamilyId: "authorization-management",
      transport: "IdentityHttpServer",
      backendApi: "AuthorizationManagementBackendApi",
    }),
    evaluator: Object.freeze({
      policyDecisionEvaluator: "AuthorizationPolicyDecisionEvaluator",
      mutationService: "AuthorizationPolicyMutationService",
    }),
    repositories: Object.freeze({
      policyReadRepository: "SqliteAuthorizationPolicyReadAdapter",
      roleAssignmentPersistenceRepository: "SqliteAuthorizationPersistenceAdapter",
      sharingGrantPersistenceRepository: "SqliteAuthorizationPersistenceAdapter",
      resourcePolicyMetadataPersistenceRepository: "SqliteAuthorizationPersistenceAdapter",
    }),
    adapters: Object.freeze({
      identityAuthHarness: "createIdentityAuthTestHarness",
      authorizationPersistence: "SqliteAuthorizationPersistenceAdapter",
    }),
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function composeAuthorizationManagementBackendApi(
  adapter: SqliteAuthorizationPersistenceAdapter,
): AuthorizationManagementBackendApi {
  const readAdapter = new SqliteAuthorizationPolicyReadAdapter({ authorizationPersistenceAdapter: adapter });
  const mutationService = new AuthorizationPolicyMutationService({
    ports: {
      roleAssignmentPersistenceRepository: adapter,
      sharingGrantPersistenceRepository: adapter,
      resourcePolicyMetadataPersistenceRepository: adapter,
    },
    clock: {
      now: () => new Date(FIXTURE_CLOCK),
    },
  });
  const decisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
    roleGrantReadRepository: readAdapter,
    sharingGrantReadRepository: readAdapter,
    resourcePolicyMetadataReadRepository: readAdapter,
    clock: {
      now: () => new Date(FIXTURE_CLOCK),
    },
  });

  return new AuthorizationManagementBackendApi({
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
    roleAssignmentPersistenceRepository: adapter,
    sharingGrantPersistenceRepository: adapter,
    resourcePolicyMetadataPersistenceRepository: adapter,
    clock: {
      now: () => new Date(FIXTURE_CLOCK),
    },
  });
}

async function startRuntimeFixtureState(): Promise<RuntimeFixtureState & { readonly baseUrl: string }> {
  const identityHarness = await createIdentityAuthTestHarness();
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "ai-loom-runtime-invariants-"));
  const authorizationAdapter = new SqliteAuthorizationPersistenceAdapter(path.join(rootDirectory, "authorization.sqlite"));
  const authorizationManagementBackendApi = composeAuthorizationManagementBackendApi(authorizationAdapter);

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

  const address = server.address() as AddressInfo;
  return Object.freeze({
    rootDirectory,
    server,
    authorizationAdapter,
    baseUrl: `http://127.0.0.1:${address.port}`,
  });
}

async function registerAndLoginActor(baseUrl: string, username: string, email: string): Promise<RuntimeInvariantActorSession> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      email,
      credential: {
        candidate: DEFAULT_PASSWORD,
      },
    }),
  });
  if (!registerResponse.ok) {
    throw new Error(`Identity registration failed with status ${registerResponse.status} for '${username}'.`);
  }
  const registerBody = await registerResponse.json() as {
    readonly data?: {
      readonly userIdentityId?: string;
    };
  };
  const userIdentityId = registerBody.data?.userIdentityId;
  if (!userIdentityId) {
    throw new Error(`Identity registration did not return user identity id for '${username}'.`);
  }

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: DEFAULT_PASSWORD,
      },
    }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Identity login failed with status ${loginResponse.status} for '${username}'.`);
  }
  const loginBody = await loginResponse.json() as {
    readonly data?: {
      readonly sessionToken?: string;
    };
  };
  const sessionToken = loginBody.data?.sessionToken;
  if (!sessionToken) {
    throw new Error(`Identity login did not return session token for '${username}'.`);
  }

  return Object.freeze({
    userIdentityId,
    sessionToken,
  });
}

async function seedWorkspaceAssetAuthorizationResource(
  adapter: SqliteAuthorizationPersistenceAdapter,
  input: SeedAuthorizationResourceInput,
): Promise<void> {
  const workspaceId = input.workspaceId ?? "workspace-1";
  const resourceType = input.resourceType ?? "asset";
  const resourceId = input.resourceId ?? "asset-1";

  await adapter.upsertResourcePolicyMetadata({
    record: {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType,
      resourceId,
      ownerUserIdentityId: input.ownerUserIdentityId,
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId,
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: SharingPolicyModes.explicit,
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: FIXTURE_SEED_TIME,
      createdBy: input.ownerUserIdentityId,
      lastModifiedAt: FIXTURE_SEED_TIME,
      lastModifiedBy: input.ownerUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-runtime-invariant-resource",
      context: {
        actorUserIdentityId: input.ownerUserIdentityId,
        occurredAt: FIXTURE_SEED_TIME,
      },
    },
  });

  await adapter.upsertRoleAssignment({
    record: {
      id: `seed-owner-role:${workspaceId}:${input.ownerUserIdentityId}`,
      actorUserIdentityId: input.ownerUserIdentityId,
      roleKey: WorkspaceAuthorizationRoleKeys.owner,
      scope: RoleAssignmentScopes.workspace,
      workspaceId,
      status: RoleAssignmentStatuses.active,
      assignedAt: FIXTURE_SEED_TIME,
      assignedByUserIdentityId: input.ownerUserIdentityId,
      createdAt: FIXTURE_SEED_TIME,
      createdBy: input.ownerUserIdentityId,
      lastModifiedAt: FIXTURE_SEED_TIME,
      lastModifiedBy: input.ownerUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-runtime-invariant-owner-role",
      context: {
        actorUserIdentityId: input.ownerUserIdentityId,
        occurredAt: FIXTURE_SEED_TIME,
      },
    },
  });

  await adapter.upsertRoleAssignment({
    record: {
      id: `seed-viewer-role:${workspaceId}:${input.viewerUserIdentityId}`,
      actorUserIdentityId: input.viewerUserIdentityId,
      roleKey: WorkspaceAuthorizationRoleKeys.viewer,
      scope: RoleAssignmentScopes.workspace,
      workspaceId,
      status: RoleAssignmentStatuses.active,
      assignedAt: FIXTURE_SEED_TIME,
      assignedByUserIdentityId: input.ownerUserIdentityId,
      createdAt: FIXTURE_SEED_TIME,
      createdBy: input.ownerUserIdentityId,
      lastModifiedAt: FIXTURE_SEED_TIME,
      lastModifiedBy: input.ownerUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-runtime-invariant-viewer-role",
      context: {
        actorUserIdentityId: input.ownerUserIdentityId,
        occurredAt: FIXTURE_SEED_TIME,
      },
    },
  });
}

export async function createAuthorizationInvariantRuntimeFixture(
  options: {
    readonly workspaceId?: string;
    readonly resourceType?: string;
    readonly resourceId?: string;
  } = {},
): Promise<AuthorizationInvariantRuntimeFixture> {
  const workspaceId = options.workspaceId ?? "workspace-1";
  const resourceType = options.resourceType ?? "asset";
  const resourceId = options.resourceId ?? "asset-1";
  const state = await startRuntimeFixtureState();
  const participants = createRuntimeParticipants();

  let disposed = false;
  return Object.freeze({
    baseUrl: state.baseUrl,
    workspaceId,
    resourceType,
    resourceId,
    participants,
    registerAndLogin: async (username: string, email: string) => registerAndLoginActor(state.baseUrl, username, email),
    seedWorkspaceAssetAuthorizationResource: async (input: SeedAuthorizationResourceInput) => {
      await seedWorkspaceAssetAuthorizationResource(state.authorizationAdapter, {
        ...input,
        workspaceId: input.workspaceId ?? workspaceId,
        resourceType: input.resourceType ?? resourceType,
        resourceId: input.resourceId ?? resourceId,
      });
    },
    dispose: async () => {
      if (disposed) {
        return;
      }
      disposed = true;
      await closeServer(state.server);
      state.authorizationAdapter.dispose();
      rmSync(state.rootDirectory, { recursive: true, force: true });
    },
  });
}
