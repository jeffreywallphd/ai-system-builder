import { describe, expect, it } from "bun:test";
import {
  PermissionEffects,
  PermissionGrantScopes,
  PolicyDecisionOutcomes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  createPermissionGrant,
  createRoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import type {
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
  AuthorizationPolicyRecordedEvent,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationPersistenceResourceLocator,
  AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  AuthorizationResourcePolicyMetadataPersistenceRecord,
  AuthorizationRoleAssignmentPersistenceLookupQuery,
  AuthorizationRoleAssignmentPersistenceRecord,
  AuthorizationSharingGrantPersistenceLookupQuery,
  AuthorizationSharingGrantPersistenceRecord,
  RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  RevokeAuthorizationSharingGrantPersistenceRecordInput,
  SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  UpsertAuthorizationSharingGrantPersistenceRecordInput,
} from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { toAuthorizationResourceLookupKey } from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyEventRecorder } from "../ports/IAuthorizationPolicyEventRecorder";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";
import { AuthorizationPolicyMutationService } from "../use-cases/AuthorizationPolicyMutationService";
import { AssignAuthorizationRoleUseCase } from "../use-cases/AssignAuthorizationRoleUseCase";
import { RemoveAuthorizationRoleUseCase } from "../use-cases/RemoveAuthorizationRoleUseCase";
import { GrantAuthorizationSharingAccessUseCase } from "../use-cases/GrantAuthorizationSharingAccessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "../use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "../use-cases/UpdateAuthorizationVisibilityUseCase";
import { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "../use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import { EvaluateAuthorizationPermissionUseCase } from "../use-cases/EvaluateAuthorizationPermissionUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "../use-cases/ListAuthorizationEffectiveAccessUseCase";
import { AuthorizationAdministrationErrorCodes } from "../use-cases/AuthorizationAdministrationUseCaseShared";
import { AuthorizationPolicyDecisionEvaluator } from "../use-cases/AuthorizationPolicyDecisionEvaluator";
import { AuthorizationHighRiskChangeCodes } from "../use-cases/AuthorizationHighRiskChangeSafeguards";

class PersistenceHarness
  implements
    AuthorizationPolicyPersistencePorts["roleAssignmentPersistenceRepository"],
    AuthorizationPolicyPersistencePorts["sharingGrantPersistenceRepository"],
    AuthorizationPolicyPersistencePorts["resourcePolicyMetadataPersistenceRepository"],
    IAuthorizationPolicyEventRecorder {
  public readonly roleAssignments = new Map<string, AuthorizationRoleAssignmentPersistenceRecord>();
  public readonly sharingGrants = new Map<string, AuthorizationSharingGrantPersistenceRecord>();
  public readonly resourceMetadata = new Map<string, AuthorizationResourcePolicyMetadataPersistenceRecord>();
  public readonly events: AuthorizationPolicyRecordedEvent[] = [];
  public readonly directPermissionGrants = new Map<string, ReturnType<typeof createPermissionGrant>>();

  async recordPolicyEvaluationEvent(event: AuthorizationPolicyRecordedEvent): Promise<void> {
    this.events.push(event);
  }

  async findRoleAssignmentById(roleAssignmentId: string): Promise<AuthorizationRoleAssignmentPersistenceRecord | undefined> {
    return this.roleAssignments.get(roleAssignmentId);
  }

  async listRoleAssignments(
    query: AuthorizationRoleAssignmentPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationRoleAssignmentPersistenceRecord>> {
    return [...this.roleAssignments.values()].filter((record) => {
      if (query.workspaceId && record.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.actorUserIdentityId && record.actorUserIdentityId !== query.actorUserIdentityId) {
        return false;
      }
      if (query.roleKey && record.roleKey !== query.roleKey) {
        return false;
      }
      if (query.scope && record.scope !== query.scope) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(record.status)) {
        return false;
      }
      if (!query.includeRevoked && record.status === RoleAssignmentStatuses.revoked) {
        return false;
      }
      return true;
    });
  }

  async upsertRoleAssignment(
    input: UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const existing = this.roleAssignments.get(input.record.id);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.roleAssignments.set(next.id, next);
    return Object.freeze({ record: next, changed: true, wasReplay: false });
  }

  async revokeRoleAssignment(
    input: RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const existing = this.roleAssignments.get(input.roleAssignmentId);
    if (!existing) {
      throw new Error("Role assignment not found.");
    }
    return this.upsertRoleAssignment({
      record: {
        ...existing,
        status: RoleAssignmentStatuses.revoked,
        revokedAt: input.revokedAt ?? input.mutation.context.occurredAt,
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
      mutation: input.mutation,
    });
  }

  async findSharingGrantById(sharingGrantId: string): Promise<AuthorizationSharingGrantPersistenceRecord | undefined> {
    return this.sharingGrants.get(sharingGrantId);
  }

  async listSharingGrants(
    query: AuthorizationSharingGrantPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantPersistenceRecord>> {
    return [...this.sharingGrants.values()].filter((record) => {
      if (query.resource && toAuthorizationResourceLookupKey(query.resource) !== toAuthorizationResourceLookupKey(record)) {
        return false;
      }
      if (!query.includeRevoked && !!record.revokedAt) {
        return false;
      }
      return true;
    });
  }

  async upsertSharingGrant(
    input: UpsertAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const existing = this.sharingGrants.get(input.record.id);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.sharingGrants.set(next.id, next);
    return Object.freeze({ record: next, changed: true, wasReplay: false });
  }

  async revokeSharingGrant(
    input: RevokeAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const existing = this.sharingGrants.get(input.sharingGrantId);
    if (!existing) {
      throw new Error("Sharing grant not found.");
    }
    return this.upsertSharingGrant({
      record: {
        ...existing,
        revokedAt: input.revokedAt ?? input.mutation.context.occurredAt,
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
      mutation: input.mutation,
    });
  }

  async findResourcePolicyMetadata(
    resource: AuthorizationPersistenceResourceLocator,
  ): Promise<AuthorizationResourcePolicyMetadataPersistenceRecord | undefined> {
    return this.resourceMetadata.get(toAuthorizationResourceLookupKey(resource));
  }

  async listResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    return [...this.resourceMetadata.values()].filter((record) => {
      if (query.resource && toAuthorizationResourceLookupKey(query.resource) !== toAuthorizationResourceLookupKey(record)) {
        return false;
      }
      if (query.workspaceId && record.workspaceId !== query.workspaceId) {
        return false;
      }
      if (!query.includeDeleted && !!record.deletedAt) {
        return false;
      }
      return true;
    });
  }

  async upsertResourcePolicyMetadata(
    input: UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const existing = this.resourceMetadata.get(toAuthorizationResourceLookupKey(input.record));
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });
    this.resourceMetadata.set(toAuthorizationResourceLookupKey(next), next);
    return Object.freeze({ record: next, changed: true, wasReplay: false });
  }

  async softDeleteResourcePolicyMetadata(
    input: SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const existing = await this.findResourcePolicyMetadata(input.resource);
    if (!existing) {
      throw new Error("Resource metadata not found.");
    }
    return this.upsertResourcePolicyMetadata({
      record: {
        ...existing,
        deletedAt: input.deletedAt ?? input.mutation.context.occurredAt,
        deletedByUserIdentityId: input.deletedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
      mutation: input.mutation,
    });
  }
}

class StubDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public constructor(private readonly predicate: (request: AuthorizationPolicyDecisionEvaluationRequest) => boolean) {}

  async evaluateDecision(request: AuthorizationPolicyDecisionEvaluationRequest): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    const allowed = this.predicate(request);
    return {
      decision: Object.freeze({
        isAllowed: allowed,
        outcome: allowed ? PolicyDecisionOutcomes.allow : PolicyDecisionOutcomes.deny,
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: allowed ? "allowed" : "denied",
        reason: allowed ? "allowed" : "denied",
        denialReason: allowed ? undefined : "insufficient-permissions",
        evaluatedAt: "2026-04-05T12:00:00.000Z",
        matchedRoleAssignmentIds: Object.freeze([]),
        matchedPermissionGrantIds: Object.freeze([]),
        matchedSharingGrantIds: Object.freeze([]),
      }),
    };
  }
}

class SequenceIdGenerator {
  private index = 0;

  public nextId(namespace: string): string {
    this.index += 1;
    return `${namespace}:${this.index}`;
  }
}

function createMutationService(harness: PersistenceHarness): AuthorizationPolicyMutationService {
  return new AuthorizationPolicyMutationService({
    ports: {
      roleAssignmentPersistenceRepository: harness,
      sharingGrantPersistenceRepository: harness,
      resourcePolicyMetadataPersistenceRepository: harness,
    } satisfies AuthorizationPolicyPersistencePorts,
    policyEventRecorder: harness,
    clock: {
      now: () => new Date("2026-04-05T12:00:00.000Z"),
    },
  });
}

function createReadRepositories(harness: PersistenceHarness): {
  roleGrantReadRepository: IAuthorizationRoleGrantReadRepository;
  sharingGrantReadRepository: IAuthorizationSharingGrantReadRepository;
  resourcePolicyMetadataReadRepository: IAuthorizationResourcePolicyMetadataReadRepository;
} {
  const roleGrantReadRepository: IAuthorizationRoleGrantReadRepository = {
    async getActorRoleGrantSnapshot(query: AuthorizationActorRoleGrantSnapshotQuery) {
      const actorUserIdentityId = query.actor.actorUserIdentityId;
      const roleAssignments = [...harness.roleAssignments.values()]
        .filter((record) => record.status === RoleAssignmentStatuses.active)
        .filter((record) => !actorUserIdentityId || record.actorUserIdentityId === actorUserIdentityId)
        .map((record) => createRoleAssignment({
          id: record.id,
          actorUserIdentityId: record.actorUserIdentityId,
          roleKey: record.roleKey,
          scope: record.scope,
          workspaceId: record.workspaceId,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          status: record.status,
          assignedByUserIdentityId: record.assignedByUserIdentityId,
          assignedAt: record.assignedAt,
        }));

      return Object.freeze({
        roleAssignments: Object.freeze(roleAssignments),
        permissionGrants: Object.freeze([...harness.directPermissionGrants.values()]),
      });
    },
  };

  const sharingGrantReadRepository: IAuthorizationSharingGrantReadRepository = {
    async listSharingGrants(query: AuthorizationSharingGrantLookupQuery) {
      const grants = [...harness.sharingGrants.values()]
        .filter((record) => toAuthorizationResourceLookupKey(record) === toAuthorizationResourceLookupKey(query.resource))
        .filter((record) => !record.revokedAt)
        .map((record) => Object.freeze({
          id: record.id,
          subject: record.subject,
          permissionKeys: record.permissionKeys,
          grantedByUserIdentityId: record.grantedByUserIdentityId,
          grantedAt: record.grantedAt,
          expiresAt: record.expiresAt,
          revokedAt: record.revokedAt,
        }));
      return Object.freeze(grants);
    },
  };

  const resourcePolicyMetadataReadRepository: IAuthorizationResourcePolicyMetadataReadRepository = {
    async findResourcePolicyMetadata(query: AuthorizationResourcePolicyMetadataLookupQuery) {
      const record = harness.resourceMetadata.get(toAuthorizationResourceLookupKey(query.resource));
      if (!record || record.deletedAt) {
        return undefined;
      }
      return Object.freeze({
        resourceFamily: record.resourceFamily,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        ownerUserIdentityId: record.ownerUserIdentityId,
        ownershipScope: record.ownershipScope,
        workspaceId: record.workspaceId,
        visibility: record.visibility,
        sharingPolicyMode: record.sharingPolicyMode,
        allowResharing: record.allowResharing,
        isPublishedCapable: record.isPublishedCapable,
        publishedAt: record.publishedAt,
      } satisfies AuthorizationResourcePolicyMetadata);
    },

    async listResourcePolicyMetadata(query: AuthorizationResourcePolicyMetadataListQuery) {
      const records = [...harness.resourceMetadata.values()]
        .filter((record) => !query.workspaceId || record.workspaceId === query.workspaceId)
        .filter((record) => !record.deletedAt)
        .map((record) => Object.freeze({
          resourceFamily: record.resourceFamily,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          ownerUserIdentityId: record.ownerUserIdentityId,
          ownershipScope: record.ownershipScope,
          workspaceId: record.workspaceId,
          visibility: record.visibility,
          sharingPolicyMode: record.sharingPolicyMode,
          allowResharing: record.allowResharing,
          isPublishedCapable: record.isPublishedCapable,
          publishedAt: record.publishedAt,
        }));
      return Object.freeze(records);
    },
  };

  return {
    roleGrantReadRepository,
    sharingGrantReadRepository,
    resourcePolicyMetadataReadRepository,
  };
}

function seedMetadata(harness: PersistenceHarness, resourceId: string, visibility: "shared" | "workspace" = "shared"): void {
  harness.resourceMetadata.set(toAuthorizationResourceLookupKey({
    resourceFamily: AuthorizationResourceFamilies.asset,
    resourceType: "asset",
    resourceId,
  }), {
    resourceFamily: AuthorizationResourceFamilies.asset,
    resourceType: "asset",
    resourceId,
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId: "workspace-1",
    visibility: visibility === "shared" ? ResourceVisibilities.shared : ResourceVisibilities.workspace,
    sharingPolicyMode: visibility === "shared" ? "explicit" : "workspace-members",
    allowResharing: false,
    isPublishedCapable: false,
    createdAt: "2026-04-05T10:00:00.000Z",
    createdBy: "user-owner",
    lastModifiedAt: "2026-04-05T10:00:00.000Z",
    lastModifiedBy: "user-owner",
    revision: 1,
  });
}

function seedMetadataWithWorkspace(
  harness: PersistenceHarness,
  resourceId: string,
  workspaceId: string,
  visibility: "shared" | "workspace" = "shared",
): void {
  harness.resourceMetadata.set(toAuthorizationResourceLookupKey({
    resourceFamily: AuthorizationResourceFamilies.asset,
    resourceType: "asset",
    resourceId,
  }), {
    resourceFamily: AuthorizationResourceFamilies.asset,
    resourceType: "asset",
    resourceId,
    ownerUserIdentityId: "user-owner",
    ownershipScope: ResourceOwnershipScopes.workspace,
    workspaceId,
    visibility: visibility === "shared" ? ResourceVisibilities.shared : ResourceVisibilities.workspace,
    sharingPolicyMode: visibility === "shared" ? "explicit" : "workspace-members",
    allowResharing: false,
    isPublishedCapable: false,
    createdAt: "2026-04-05T10:00:00.000Z",
    createdBy: "user-owner",
    lastModifiedAt: "2026-04-05T10:00:00.000Z",
    lastModifiedBy: "user-owner",
    revision: 1,
  });
}

describe("Authorization administration use cases", () => {
  it("assigns and removes roles", async () => {
    const harness = new PersistenceHarness();
    const decisionEvaluator = new StubDecisionEvaluator((request) => request.requiredPermissionKey === "system.manage");
    const mutationService = createMutationService(harness);
    const idGenerator = new SequenceIdGenerator();

    const assign = await new AssignAuthorizationRoleUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator,
    }).execute({
      request: {
        operation: "assign",
        workspaceId: "workspace-1",
        actorUserIdentityId: "user-admin",
        targetUserIdentityId: "user-target",
        roleKey: "viewer",
      },
    });

    expect(assign.ok).toBeTrue();

    const revoke = await new RemoveAuthorizationRoleUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator,
    }).execute({
      request: {
        operation: "revoke",
        workspaceId: "workspace-1",
        actorUserIdentityId: "user-admin",
        targetUserIdentityId: "user-target",
        roleKey: "viewer",
      },
    });

    expect(revoke.ok).toBeTrue();
    if (!revoke.ok) {
      return;
    }

    expect(revoke.value.record.status).toBe(RoleAssignmentStatuses.revoked);
  });

  it("enforces admin authorization and schema validation for role assignment", async () => {
    const harness = new PersistenceHarness();
    const denied = await new AssignAuthorizationRoleUseCase({
      mutationService: createMutationService(harness),
      decisionEvaluator: new StubDecisionEvaluator(() => false),
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        operation: "assign",
        workspaceId: "workspace-1",
        actorUserIdentityId: "user-member",
        targetUserIdentityId: "user-target",
        roleKey: "member",
      },
    });

    expect(denied.ok).toBeFalse();
    if (!denied.ok) {
      expect(denied.error.code).toBe(AuthorizationAdministrationErrorCodes.forbidden);
    }

    const malformed = await new AssignAuthorizationRoleUseCase({
      mutationService: createMutationService(harness),
      decisionEvaluator: new StubDecisionEvaluator(() => true),
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        operation: "assign",
        workspaceId: "workspace-1",
        targetUserIdentityId: "missing-actor",
        roleKey: "member",
      },
    });

    expect(malformed.ok).toBeFalse();
    if (!malformed.ok) {
      expect(malformed.error.code).toBe(AuthorizationAdministrationErrorCodes.invalidRequest);
      expect(malformed.error.details?.schemaName).toBeDefined();
    }
  });

  it("blocks removal of the last active workspace administrator assignment", async () => {
    const harness = new PersistenceHarness();
    const mutationService = createMutationService(harness);
    const decisionEvaluator = new StubDecisionEvaluator((request) => request.requiredPermissionKey === "system.manage");

    harness.roleAssignments.set("admin-target", {
      id: "admin-target",
      actorUserIdentityId: "user-target",
      roleKey: WorkspaceAuthorizationRoleKeys.admin,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T09:00:00.000Z",
      assignedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T09:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T09:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });

    const outcome = await new RemoveAuthorizationRoleUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        operation: "revoke",
        workspaceId: "workspace-1",
        actorUserIdentityId: "user-admin",
        targetUserIdentityId: "user-target",
        roleKey: "admin",
      },
    });

    expect(outcome.ok).toBeFalse();
    if (!outcome.ok) {
      expect(outcome.error.code).toBe(AuthorizationAdministrationErrorCodes.conflict);
      expect(outcome.error.details?.reasonCode).toBe(AuthorizationHighRiskChangeCodes.lastWorkspaceAdministratorRemoval);
    }
  });

  it("grants/revokes sharing and updates visibility", async () => {
    const harness = new PersistenceHarness();
    seedMetadata(harness, "asset-1", "shared");
    const decisionEvaluator = new StubDecisionEvaluator((request) => (
      request.requiredPermissionKey === "asset.share" || request.requiredPermissionKey === "asset.manage"
    ));
    const mutationService = createMutationService(harness);

    const granted = await new GrantAuthorizationSharingAccessUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        operation: "upsert",
        actorUserIdentityId: "user-admin",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-1",
        },
        workspaceId: "workspace-1",
        visibility: "shared",
        grant: {
          id: "share-1",
          target: {
            kind: "user",
            userId: "user-target",
          },
          permissionKeys: ["asset.read"],
        },
      },
    });
    expect(granted.ok).toBeTrue();

    const revoked = await new RevokeAuthorizationSharingAccessUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        operation: "revoke",
        actorUserIdentityId: "user-admin",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-1",
        },
        workspaceId: "workspace-1",
        visibility: "shared",
        grantId: "share-1",
      },
    });
    expect(revoked.ok).toBeTrue();

    harness.sharingGrants.set("share-old", {
      id: "share-old",
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-1",
      workspaceId: "workspace-1",
      subject: {
        kind: "user",
        userIdentityId: "legacy-user",
      },
      permissionKeys: ["asset.read"],
      grantedAt: "2026-04-05T11:00:00.000Z",
      grantedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T11:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T11:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });

    const visibility = await new UpdateAuthorizationVisibilityUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        actorUserIdentityId: "user-admin",
        subject: {
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
            id: "share-new",
            target: {
              kind: "user",
              userId: "new-user",
            },
            permissionKeys: ["asset.read"],
          },
        ],
        isPublishedCapable: false,
      },
    });

    expect(visibility.ok).toBeTrue();
    if (!visibility.ok) {
      return;
    }

    expect(harness.sharingGrants.get("share-old")?.revokedAt).toBeDefined();
    expect(harness.sharingGrants.get("share-new")?.revokedAt).toBeUndefined();
    expect(visibility.value.sharingGrantMutations).toHaveLength(2);
  });

  it("requires explicit high-risk confirmation when creating broad sharing grants", async () => {
    const harness = new PersistenceHarness();
    seedMetadata(harness, "asset-high-risk-share", "shared");
    const decisionEvaluator = new StubDecisionEvaluator((request) => request.requiredPermissionKey === "asset.share");
    const mutationService = createMutationService(harness);

    const useCase = new GrantAuthorizationSharingAccessUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    });

    const blocked = await useCase.execute({
      request: {
        operation: "upsert",
        actorUserIdentityId: "user-admin",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-high-risk-share",
        },
        workspaceId: "workspace-1",
        visibility: "shared",
        grant: {
          id: "share-role-broad",
          target: {
            kind: "workspace-role",
            workspaceId: "workspace-1",
            roleKey: "viewer",
          },
          permissionKeys: ["asset.read"],
        },
      },
    });
    expect(blocked.ok).toBeFalse();
    if (!blocked.ok) {
      expect(blocked.error.code).toBe(AuthorizationAdministrationErrorCodes.highRiskConfirmationRequired);
    }

    const confirmed = await useCase.execute({
      request: {
        operation: "upsert",
        actorUserIdentityId: "user-admin",
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-high-risk-share",
        },
        workspaceId: "workspace-1",
        visibility: "shared",
        grant: {
          id: "share-role-broad",
          target: {
            kind: "workspace-role",
            workspaceId: "workspace-1",
            roleKey: "viewer",
          },
          permissionKeys: ["asset.read"],
        },
      },
      metadata: {
        authorizationHighRiskConfirmation: {
          confirmedRiskCodes: [AuthorizationHighRiskChangeCodes.broadSubjectShare],
        },
      },
    });
    expect(confirmed.ok).toBeTrue();
  });

  it("requires explicit high-risk confirmation when broadening visibility to published", async () => {
    const harness = new PersistenceHarness();
    seedMetadata(harness, "asset-high-risk-visibility", "workspace");
    const decisionEvaluator = new StubDecisionEvaluator((request) => request.requiredPermissionKey === "asset.manage");
    const mutationService = createMutationService(harness);
    const useCase = new UpdateAuthorizationVisibilityUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    });

    const blocked = await useCase.execute({
      request: {
        actorUserIdentityId: "user-admin",
        subject: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-high-risk-visibility",
        },
        workspaceId: "workspace-1",
        visibility: "published",
        sharingPolicyMode: "published",
        allowResharing: false,
        sharingGrants: [],
        isPublishedCapable: true,
        publishedAt: "2026-04-05T12:00:00.000Z",
      },
    });
    expect(blocked.ok).toBeFalse();
    if (!blocked.ok) {
      expect(blocked.error.code).toBe(AuthorizationAdministrationErrorCodes.highRiskConfirmationRequired);
    }

    const confirmed = await useCase.execute({
      request: {
        actorUserIdentityId: "user-admin",
        subject: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-high-risk-visibility",
        },
        workspaceId: "workspace-1",
        visibility: "published",
        sharingPolicyMode: "published",
        allowResharing: false,
        sharingGrants: [],
        isPublishedCapable: true,
        publishedAt: "2026-04-05T12:00:00.000Z",
      },
      metadata: {
        authorizationHighRiskConfirmation: {
          confirmedRiskCodes: [
            AuthorizationHighRiskChangeCodes.visibilityBroadened,
            AuthorizationHighRiskChangeCodes.resourcePublished,
          ],
        },
      },
    });

    expect(confirmed.ok).toBeTrue();
  });

  it("bulk-grants workspace-role sharing with deterministic mixed-authority results", async () => {
    const harness = new PersistenceHarness();
    seedMetadataWithWorkspace(harness, "asset-allow", "workspace-1", "shared");
    seedMetadataWithWorkspace(harness, "asset-deny", "workspace-1", "shared");
    const decisionEvaluator = new StubDecisionEvaluator((request) => (
      request.requiredPermissionKey === "asset.share"
      && request.target.kind === "resource-instance"
      && request.target.resource.resourceId === "asset-allow"
    ));
    const mutationService = createMutationService(harness);

    const outcome = await new BulkGrantAuthorizationWorkspaceRoleAccessUseCase({
      mutationService,
      decisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: harness,
        sharingGrantPersistenceRepository: harness,
        resourcePolicyMetadataPersistenceRepository: harness,
      },
      idGenerator: new SequenceIdGenerator(),
    }).execute({
      request: {
        actorUserIdentityId: "user-admin",
        workspaceId: "workspace-1",
        roleKey: "viewer",
        resources: [
          {
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: "asset",
            resourceId: "asset-allow",
          },
          {
            resourceFamily: AuthorizationResourceFamilies.asset,
            resourceType: "asset",
            resourceId: "asset-deny",
          },
        ],
        permissionKeys: ["asset.read"],
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(outcome.value.totalResources).toBe(2);
    expect(outcome.value.succeededResources).toBe(1);
    expect(outcome.value.failedResources).toBe(1);
    const [first, second] = outcome.value.results;
    expect(first?.status).toBe("created");
    expect(second?.status).toBe("failed");
    if (second?.status === "failed") {
      expect(second.error.code).toBe(AuthorizationAdministrationErrorCodes.forbidden);
    }

    const allowGrants = [...harness.sharingGrants.values()]
      .filter((grant) => grant.resourceId === "asset-allow" && !grant.revokedAt);
    const denyGrants = [...harness.sharingGrants.values()]
      .filter((grant) => grant.resourceId === "asset-deny" && !grant.revokedAt);
    expect(allowGrants).toHaveLength(1);
    expect(denyGrants).toHaveLength(0);
  });

  it("evaluates permission and lists effective access", async () => {
    const harness = new PersistenceHarness();
    seedMetadata(harness, "asset-2", "workspace");

    harness.roleAssignments.set("role-1", {
      id: "role-1",
      actorUserIdentityId: "user-admin",
      roleKey: "admin",
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T09:00:00.000Z",
      assignedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T09:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T09:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });
    harness.directPermissionGrants.set("grant-1", createPermissionGrant({
      id: "grant-1",
      permissionKey: "asset.read",
      effect: PermissionEffects.allow,
      scope: PermissionGrantScopes.workspace,
      workspaceId: "workspace-1",
      grantedByUserIdentityId: "user-owner",
      grantedAt: "2026-04-05T09:00:00.000Z",
    }));

    const decisionEvaluator = new StubDecisionEvaluator((request) => request.requiredPermissionKey.endsWith(".read"));

    const evaluated = await new EvaluateAuthorizationPermissionUseCase({ decisionEvaluator }).execute({
      request: {
        actor: {
          actorUserIdentityId: "user-admin",
          activeWorkspaceId: "workspace-1",
        },
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-2",
        },
        requiredPermissionKey: "asset.read",
      },
    });
    expect(evaluated.ok).toBeTrue();

    const reads = createReadRepositories(harness);
    const listed = await new ListAuthorizationEffectiveAccessUseCase({
      decisionEvaluator,
      roleGrantReadRepository: reads.roleGrantReadRepository,
      sharingGrantReadRepository: reads.sharingGrantReadRepository,
      resourcePolicyMetadataReadRepository: reads.resourcePolicyMetadataReadRepository,
    }).execute({
      actor: {
        actorUserIdentityId: "user-admin",
        activeWorkspaceId: "workspace-1",
      },
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-2",
      },
    });

    expect(listed.ok).toBeTrue();
    if (!listed.ok) {
      return;
    }

    expect(listed.value.permissions.length).toBeGreaterThan(0);
    expect(listed.value.permissions.every((entry) => entry.permissionKey.endsWith(".read"))).toBeTrue();
  });

  it("returns redaction-safe effective-access explanations for owner, sharing, visibility, and deny", async () => {
    const harness = new PersistenceHarness();

    harness.resourceMetadata.set(toAuthorizationResourceLookupKey({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-owner",
    }), {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-owner",
      ownerUserIdentityId: "user-target",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: "owner-only",
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: "2026-04-05T10:00:00.000Z",
      createdBy: "user-target",
      lastModifiedAt: "2026-04-05T10:00:00.000Z",
      lastModifiedBy: "user-target",
      revision: 1,
    });

    harness.resourceMetadata.set(toAuthorizationResourceLookupKey({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-shared",
    }), {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-shared",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: "explicit",
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: "2026-04-05T10:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T10:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });

    harness.sharingGrants.set("share-user-target", {
      id: "share-user-target",
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-shared",
      workspaceId: "workspace-1",
      subject: {
        kind: "user",
        userIdentityId: "user-target",
      },
      permissionKeys: ["asset.read"],
      grantedAt: "2026-04-05T10:05:00.000Z",
      grantedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T10:05:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T10:05:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });

    harness.resourceMetadata.set(toAuthorizationResourceLookupKey({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-published",
    }), {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-published",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.published,
      sharingPolicyMode: "published",
      allowResharing: false,
      isPublishedCapable: true,
      publishedAt: "2026-04-05T10:10:00.000Z",
      createdAt: "2026-04-05T10:10:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T10:10:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });

    harness.resourceMetadata.set(toAuthorizationResourceLookupKey({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-denied",
    }), {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-denied",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: "owner-only",
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: "2026-04-05T10:15:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T10:15:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
    });

    const reads = createReadRepositories(harness);
    const decisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: reads.roleGrantReadRepository,
      sharingGrantReadRepository: reads.sharingGrantReadRepository,
      resourcePolicyMetadataReadRepository: reads.resourcePolicyMetadataReadRepository,
      clock: {
        now: () => new Date("2026-04-05T12:00:00.000Z"),
      },
    });

    const useCase = new ListAuthorizationEffectiveAccessUseCase({
      decisionEvaluator,
      roleGrantReadRepository: reads.roleGrantReadRepository,
      sharingGrantReadRepository: reads.sharingGrantReadRepository,
      resourcePolicyMetadataReadRepository: reads.resourcePolicyMetadataReadRepository,
    });

    const owner = await useCase.execute({
      actor: { actorUserIdentityId: "user-target", activeWorkspaceId: "workspace-1" },
      resource: { resourceFamily: AuthorizationResourceFamilies.asset, resourceType: "asset", resourceId: "asset-owner" },
      includeDenied: true,
    });
    expect(owner.ok).toBeTrue();
    if (owner.ok) {
      const read = owner.value.permissions.find((entry) => entry.permissionKey === "asset.read");
      expect(read?.explanation.ownershipContext.contributedToDecision).toBeTrue();
    }

    const shared = await useCase.execute({
      actor: { actorUserIdentityId: "user-target", activeWorkspaceId: "workspace-1" },
      resource: { resourceFamily: AuthorizationResourceFamilies.asset, resourceType: "asset", resourceId: "asset-shared" },
      includeDenied: true,
    });
    expect(shared.ok).toBeTrue();
    if (shared.ok) {
      const read = shared.value.permissions.find((entry) => entry.permissionKey === "asset.read");
      expect(read?.explanation.sharingBasedGrants.contributedToDecision).toBeTrue();
    }

    const published = await useCase.execute({
      actor: { actorUserIdentityId: "user-target", activeWorkspaceId: "workspace-1" },
      resource: { resourceFamily: AuthorizationResourceFamilies.asset, resourceType: "asset", resourceId: "asset-published" },
      includeDenied: true,
    });
    expect(published.ok).toBeTrue();
    if (published.ok) {
      const read = published.value.permissions.find((entry) => entry.permissionKey === "asset.read");
      expect(read?.explanation.visibilityContribution.contributedToDecision).toBeTrue();
      expect(read?.explanation.visibilityContribution.contributionReasonCode).toBe("visibility-published");
    }

    const denied = await useCase.execute({
      actor: { actorUserIdentityId: "user-target", activeWorkspaceId: "workspace-1" },
      resource: { resourceFamily: AuthorizationResourceFamilies.asset, resourceType: "asset", resourceId: "asset-denied" },
      includeDenied: true,
    });
    expect(denied.ok).toBeTrue();
    if (denied.ok) {
      const read = denied.value.permissions.find((entry) => entry.permissionKey === "asset.read");
      expect(read?.decision.isAllowed).toBeFalse();
      expect(read?.explanation.ownershipContext.contributedToDecision).toBeFalse();
      expect(read?.explanation.roleBasedGrants.contributedToDecision).toBeFalse();
      expect(read?.explanation.directPermissionGrants.contributedToDecision).toBeFalse();
      expect(read?.explanation.sharingBasedGrants.contributedToDecision).toBeFalse();
      expect(read?.explanation.visibilityContribution.contributedToDecision).toBeFalse();
    }
  });
});

