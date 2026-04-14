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
  type AuthorizationRoleKey,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type WorkspaceMembershipStatus,
  type WorkspaceRole,
} from "@domain/workspaces/WorkspaceDomain";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";

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

export interface SeedWorkspaceRoleAssignmentInput {
  readonly actorUserIdentityId: string;
  readonly assignedByUserIdentityId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly workspaceId: string;
}

export interface SeedWorkspaceAuthorizationSnapshotInput {
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly ownerUserIdentityId?: string;
  readonly effectiveRoles: ReadonlyArray<WorkspaceRole>;
  readonly membershipStatus?: WorkspaceMembershipStatus;
  readonly isWorkspaceOwner?: boolean;
}

export interface AuthorizationInvariantRuntimeFixture {
  readonly baseUrl: string;
  readonly workspaceId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly participants: AuthorizationInvariantRuntimeParticipants;
  registerAndLogin(username: string, email: string): Promise<RuntimeInvariantActorSession>;
  seedWorkspaceAssetAuthorizationResource(input: SeedAuthorizationResourceInput): Promise<void>;
  seedWorkspaceRoleAssignment(input: SeedWorkspaceRoleAssignmentInput): Promise<void>;
  seedWorkspaceAuthorizationSnapshot(input: SeedWorkspaceAuthorizationSnapshotInput): Promise<void>;
  dispose(): Promise<void>;
}

interface RuntimeFixtureState {
  readonly rootDirectory: string;
  readonly server: Server;
  readonly authorizationAdapter: SqliteAuthorizationPersistenceAdapter;
  readonly workspaceAuthorizationReadRepository: InMemoryWorkspaceAuthorizationReadRepository;
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

class InMemoryWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  private readonly snapshots = new Map<string, WorkspaceAuthorizationSnapshot>();

  public upsertSnapshot(input: SeedWorkspaceAuthorizationSnapshotInput): void {
    const workspace = createWorkspace({
      id: input.workspaceId,
      slug: this.toWorkspaceSlug(input.workspaceId),
      displayName: `Runtime Fixture ${input.workspaceId}`,
      ownerUserId: input.ownerUserIdentityId ?? input.userIdentityId,
      createdBy: input.ownerUserIdentityId ?? input.userIdentityId,
      status: "active",
      now: new Date(FIXTURE_SEED_TIME),
    });

    const membershipStatus = input.membershipStatus ?? WorkspaceMembershipStatuses.active;
    const membership = createWorkspaceMembership({
      id: `seed-membership:${input.workspaceId}:${input.userIdentityId}`,
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
      status: membershipStatus,
      invitedByUserId: input.ownerUserIdentityId ?? input.userIdentityId,
      joinedAt: membershipStatus === WorkspaceMembershipStatuses.active ? FIXTURE_SEED_TIME : undefined,
      createdBy: input.ownerUserIdentityId ?? input.userIdentityId,
      now: new Date(FIXTURE_SEED_TIME),
    });

    const effectiveRoles = [...new Set(input.effectiveRoles)];
    const activeRoleAssignments = effectiveRoles.map((role) => createWorkspaceRoleAssignment({
      id: `seed-workspace-role:${input.workspaceId}:${input.userIdentityId}:${role}`,
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
      role,
      status: "active",
      assignedBy: input.ownerUserIdentityId ?? input.userIdentityId,
      assignedAt: FIXTURE_SEED_TIME,
    }));

    const isWorkspaceOwner = input.isWorkspaceOwner ?? effectiveRoles.includes(WorkspaceRoles.owner);

    const snapshot: WorkspaceAuthorizationSnapshot = Object.freeze({
      workspace,
      membership,
      activeRoleAssignments: Object.freeze(activeRoleAssignments),
      effectiveRoles: Object.freeze(effectiveRoles),
      isWorkspaceOwner,
    });

    this.snapshots.set(this.toSnapshotKey(input.workspaceId, input.userIdentityId), snapshot);
  }

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    return this.snapshots.get(this.toSnapshotKey(query.workspaceId, query.userIdentityId));
  }

  private toSnapshotKey(workspaceId: string, userIdentityId: string): string {
    return `${workspaceId}:${userIdentityId}`;
  }

  private toWorkspaceSlug(workspaceId: string): string {
    return workspaceId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "fixture-workspace";
  }
}

function composeAuthorizationManagementBackendApi(
  adapter: SqliteAuthorizationPersistenceAdapter,
  workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository,
): AuthorizationManagementBackendApi {
  const readAdapter = new SqliteAuthorizationPolicyReadAdapter({
    authorizationPersistenceAdapter: adapter,
    workspaceAuthorizationReadRepository,
  });
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
  const workspaceAuthorizationReadRepository = new InMemoryWorkspaceAuthorizationReadRepository();
  const authorizationManagementBackendApi = composeAuthorizationManagementBackendApi(
    authorizationAdapter,
    workspaceAuthorizationReadRepository,
  );

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
    workspaceAuthorizationReadRepository,
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

async function seedWorkspaceRoleAssignment(
  adapter: SqliteAuthorizationPersistenceAdapter,
  input: SeedWorkspaceRoleAssignmentInput,
): Promise<void> {
  await adapter.upsertRoleAssignment({
    record: {
      id: `seed-runtime-role:${input.workspaceId}:${input.actorUserIdentityId}:${input.roleKey}`,
      actorUserIdentityId: input.actorUserIdentityId,
      roleKey: input.roleKey,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: input.workspaceId,
      status: RoleAssignmentStatuses.active,
      assignedAt: FIXTURE_SEED_TIME,
      assignedByUserIdentityId: input.assignedByUserIdentityId,
      createdAt: FIXTURE_SEED_TIME,
      createdBy: input.assignedByUserIdentityId,
      lastModifiedAt: FIXTURE_SEED_TIME,
      lastModifiedBy: input.assignedByUserIdentityId,
      revision: 0,
    },
    mutation: {
      operationKey: "seed-runtime-invariant-workspace-role",
      context: {
        actorUserIdentityId: input.assignedByUserIdentityId,
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
    seedWorkspaceRoleAssignment: async (input: SeedWorkspaceRoleAssignmentInput) => {
      await seedWorkspaceRoleAssignment(state.authorizationAdapter, input);
    },
    seedWorkspaceAuthorizationSnapshot: async (input: SeedWorkspaceAuthorizationSnapshotInput) => {
      state.workspaceAuthorizationReadRepository.upsertSnapshot(input);
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
