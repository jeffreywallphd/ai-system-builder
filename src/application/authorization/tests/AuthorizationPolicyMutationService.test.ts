import { describe, expect, it } from "bun:test";
import { ResourceOwnershipScopes, ResourceVisibilities, RoleAssignmentScopes, RoleAssignmentStatuses } from "../../../domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "../../../domain/authorization/AuthorizationPermissionCatalog";
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
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import type { AuthorizationPolicyRecordedEvent } from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationPolicyEvaluationEventTypes } from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyEventRecorder } from "../ports/IAuthorizationPolicyEventRecorder";
import type { IAuthorizationResourcePolicyMetadataPersistenceRepository } from "../ports/IAuthorizationResourcePolicyMetadataPersistenceRepository";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "../ports/IAuthorizationRoleAssignmentPersistenceRepository";
import type { IAuthorizationSharingGrantPersistenceRepository } from "../ports/IAuthorizationSharingGrantPersistenceRepository";
import { AuthorizationPolicyMutationService } from "../use-cases/AuthorizationPolicyMutationService";

class InMemoryMutationRepositories
  implements
    IAuthorizationRoleAssignmentPersistenceRepository,
    IAuthorizationSharingGrantPersistenceRepository,
    IAuthorizationResourcePolicyMetadataPersistenceRepository {
  async findRoleAssignmentById(_roleAssignmentId: string): Promise<AuthorizationRoleAssignmentPersistenceRecord | undefined> {
    return undefined;
  }

  async listRoleAssignments(
    _query: AuthorizationRoleAssignmentPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationRoleAssignmentPersistenceRecord>> {
    return Object.freeze([]);
  }

  async upsertRoleAssignment(
    input: UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    return Object.freeze({
      record: {
        ...input.record,
        revision: 1,
      },
      changed: true,
      wasReplay: false,
    });
  }

  async revokeRoleAssignment(
    input: RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    return Object.freeze({
      record: Object.freeze({
        id: input.roleAssignmentId,
        actorUserIdentityId: "user-target",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace-1",
        status: RoleAssignmentStatuses.revoked,
        assignedAt: "2026-04-01T00:00:00.000Z",
        assignedByUserIdentityId: "user-admin",
        revokedAt: input.revokedAt ?? "2026-04-05T12:00:00.000Z",
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? "user-admin",
        createdAt: "2026-04-01T00:00:00.000Z",
        createdBy: "user-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user-admin",
        revision: 2,
      }),
      changed: true,
      wasReplay: false,
    });
  }

  async findSharingGrantById(_sharingGrantId: string): Promise<AuthorizationSharingGrantPersistenceRecord | undefined> {
    return undefined;
  }

  async listSharingGrants(
    _query: AuthorizationSharingGrantPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantPersistenceRecord>> {
    return Object.freeze([]);
  }

  async upsertSharingGrant(
    input: UpsertAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    return Object.freeze({
      record: {
        ...input.record,
        revision: 1,
      },
      changed: true,
      wasReplay: false,
    });
  }

  async revokeSharingGrant(
    input: RevokeAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    return Object.freeze({
      record: Object.freeze({
        id: input.sharingGrantId,
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
        workspaceId: "workspace-1",
        subject: {
          kind: "user",
          userIdentityId: "user-target",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedAt: "2026-04-01T00:00:00.000Z",
        grantedByUserIdentityId: "user-admin",
        revokedAt: "2026-04-05T12:00:00.000Z",
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? "user-admin",
        createdAt: "2026-04-01T00:00:00.000Z",
        createdBy: "user-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user-admin",
        revision: 2,
      }),
      changed: true,
      wasReplay: false,
    });
  }

  async findResourcePolicyMetadata(
    _resource: AuthorizationPersistenceResourceLocator,
  ): Promise<AuthorizationResourcePolicyMetadataPersistenceRecord | undefined> {
    return undefined;
  }

  async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    return Object.freeze([]);
  }

  async upsertResourcePolicyMetadata(
    input: UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    return Object.freeze({
      record: {
        ...input.record,
        revision: 1,
      },
      changed: true,
      wasReplay: false,
    });
  }

  async softDeleteResourcePolicyMetadata(
    input: SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    return Object.freeze({
      record: Object.freeze({
        resourceFamily: input.resource.resourceFamily,
        resourceType: input.resource.resourceType,
        resourceId: input.resource.resourceId,
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-1",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: "explicit",
        allowResharing: false,
        isPublishedCapable: false,
        deletedAt: input.deletedAt ?? "2026-04-05T12:00:00.000Z",
        deletedByUserIdentityId: input.deletedByUserIdentityId ?? "user-admin",
        createdAt: "2026-04-01T00:00:00.000Z",
        createdBy: "user-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user-admin",
        revision: 2,
      }),
      changed: true,
      wasReplay: false,
    });
  }
}

class InMemoryPolicyEventRecorder implements IAuthorizationPolicyEventRecorder {
  public readonly events: AuthorizationPolicyRecordedEvent[] = [];

  async recordPolicyEvaluationEvent(event: AuthorizationPolicyRecordedEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("AuthorizationPolicyMutationService", () => {
  it("emits structured mutation events for role, sharing, and visibility policy changes", async () => {
    const repositories = new InMemoryMutationRepositories();
    const recorder = new InMemoryPolicyEventRecorder();
    const service = new AuthorizationPolicyMutationService({
      ports: {
        roleAssignmentPersistenceRepository: repositories,
        sharingGrantPersistenceRepository: repositories,
        resourcePolicyMetadataPersistenceRepository: repositories,
      } satisfies AuthorizationPolicyPersistencePorts,
      policyEventRecorder: recorder,
      clock: {
        now: () => new Date("2026-04-05T12:34:56.000Z"),
      },
    });

    await service.upsertRoleAssignment({
      record: {
        id: "role-1",
        actorUserIdentityId: "user-target",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace-1",
        status: RoleAssignmentStatuses.active,
        assignedAt: "2026-04-05T12:00:00.000Z",
        assignedByUserIdentityId: "user-admin",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user-admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-role-upsert-1",
        context: {
          actorUserIdentityId: "user-admin",
        },
      },
    });

    await service.revokeSharingGrant({
      sharingGrantId: "share-1",
      mutation: {
        operationKey: "op-share-revoke-1",
        context: {
          actorUserIdentityId: "user-admin",
        },
      },
    });

    await service.upsertResourcePolicyMetadata({
      record: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-1",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: "explicit",
        allowResharing: false,
        isPublishedCapable: false,
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user-admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-policy-upsert-1",
        context: {
          actorUserIdentityId: "user-admin",
        },
      },
    });

    expect(recorder.events.map((event) => event.type)).toEqual([
      AuthorizationPolicyEvaluationEventTypes.roleAssignmentUpserted,
      AuthorizationPolicyEvaluationEventTypes.sharingGrantRevoked,
      AuthorizationPolicyEvaluationEventTypes.resourcePolicyUpserted,
    ]);

    const firstEvent = recorder.events[0];
    if (!firstEvent || !("mutation" in firstEvent)) {
      throw new Error("Expected first authorization mutation event.");
    }

    expect(firstEvent.actor.actorUserIdentityId).toBe("user-admin");
    expect(firstEvent.workspaceId).toBe("workspace-1");
    expect(firstEvent.resource?.resourceType).toBeUndefined();
    expect(firstEvent.mutation.operationKey).toBe("op-role-upsert-1");
    expect(firstEvent.mutation.entityKind).toBe("role-assignment");
    expect(firstEvent.mutation.mutationKind).toBe("upsert");
  });

  it("redacts sensitive metadata keys and truncates long reasons", async () => {
    const repositories = new InMemoryMutationRepositories();
    const recorder = new InMemoryPolicyEventRecorder();
    const service = new AuthorizationPolicyMutationService({
      ports: {
        roleAssignmentPersistenceRepository: repositories,
        sharingGrantPersistenceRepository: repositories,
        resourcePolicyMetadataPersistenceRepository: repositories,
      } satisfies AuthorizationPolicyPersistencePorts,
      policyEventRecorder: recorder,
    });

    await service.upsertSharingGrant({
      record: {
        id: "share-1",
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-1",
        workspaceId: "workspace-1",
        subject: {
          kind: "user",
          userIdentityId: "user-target",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedAt: "2026-04-05T12:00:00.000Z",
        grantedByUserIdentityId: "user-admin",
        createdAt: "2026-04-05T12:00:00.000Z",
        createdBy: "user-admin",
        lastModifiedAt: "2026-04-05T12:00:00.000Z",
        lastModifiedBy: "user-admin",
        revision: 0,
      },
      mutation: {
        operationKey: "op-share-upsert-1",
        context: {
          actorUserIdentityId: "user-admin",
          reason: "x".repeat(600),
          metadata: {
            token: "live-token-value",
            passwordHint: "my-password",
            nested: {
              apiKey: "abc",
              safe: "ok",
            },
          },
        },
      },
    });

    const event = recorder.events[0];
    if (!event || !("details" in event)) {
      throw new Error("Expected mutation event details.");
    }

    const details = event.details as Record<string, unknown>;
    expect(typeof details.reason).toBe("string");
    expect((details.reason as string).length).toBeLessThanOrEqual(259);

    const metadata = details.metadata as Record<string, unknown>;
    expect(metadata.token).toBe("[REDACTED]");
    expect(metadata.passwordHint).toBe("[REDACTED]");
    expect((metadata.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect((metadata.nested as Record<string, unknown>).safe).toBe("ok");
  });
});
