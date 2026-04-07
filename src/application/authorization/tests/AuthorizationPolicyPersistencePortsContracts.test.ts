import { describe, expect, it } from "bun:test";
import { ResourceOwnershipScopes, ResourceVisibilities, RoleAssignmentScopes, RoleAssignmentStatuses } from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
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
import {
  normalizeAuthorizationMutationOperationKey,
  toAuthorizationResourceLookupKey,
  toAuthorizationSharingSubjectLookupKey,
} from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationResourcePolicyMetadataPersistenceRepository } from "../ports/IAuthorizationResourcePolicyMetadataPersistenceRepository";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "../ports/IAuthorizationRoleAssignmentPersistenceRepository";
import type { IAuthorizationSharingGrantPersistenceRepository } from "../ports/IAuthorizationSharingGrantPersistenceRepository";

class InMemoryAuthorizationPolicyPersistenceAdapter
  implements
    IAuthorizationRoleAssignmentPersistenceRepository,
    IAuthorizationSharingGrantPersistenceRepository,
    IAuthorizationResourcePolicyMetadataPersistenceRepository {
  private readonly roleAssignmentsById = new Map<string, AuthorizationRoleAssignmentPersistenceRecord>();
  private readonly sharingGrantsById = new Map<string, AuthorizationSharingGrantPersistenceRecord>();
  private readonly resourcePolicyByKey = new Map<string, AuthorizationResourcePolicyMetadataPersistenceRecord>();
  private readonly mutationReplayByOperationKey = new Map<string, unknown>();

  async findRoleAssignmentById(roleAssignmentId: string): Promise<AuthorizationRoleAssignmentPersistenceRecord | undefined> {
    return this.roleAssignmentsById.get(roleAssignmentId);
  }

  async listRoleAssignments(
    query: AuthorizationRoleAssignmentPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationRoleAssignmentPersistenceRecord>> {
    return [...this.roleAssignmentsById.values()].filter((record) => {
      if (query.workspaceId && record.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.actorUserIdentityId && record.actorUserIdentityId !== query.actorUserIdentityId) {
        return false;
      }
      if (query.scope && record.scope !== query.scope) {
        return false;
      }
      if (query.resourceFamily && record.resourceFamily !== query.resourceFamily) {
        return false;
      }
      if (query.resourceType && record.resourceType !== query.resourceType) {
        return false;
      }
      if (query.resourceId && record.resourceId !== query.resourceId) {
        return false;
      }
      if (query.statuses && query.statuses.length > 0 && !query.statuses.includes(record.status)) {
        return false;
      }
      if (!query.includeRevoked && (record.status === RoleAssignmentStatuses.revoked || !!record.revokedAt)) {
        return false;
      }
      return true;
    });
  }

  async upsertRoleAssignment(
    input: UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const operationKey = normalizeAuthorizationMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      const replayRecord = replay as AuthorizationRoleAssignmentPersistenceRecord;
      return Object.freeze({
        record: replayRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.roleAssignmentsById.get(input.record.id);
    if (typeof input.mutation.expectedRevision === "number" && existing && existing.revision !== input.mutation.expectedRevision) {
      throw new Error("Role assignment expectedRevision did not match persisted revision.");
    }

    const next: AuthorizationRoleAssignmentPersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.roleAssignmentsById.set(next.id, next);
    const result = Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
    this.mutationReplayByOperationKey.set(operationKey, next);
    return result;
  }

  async revokeRoleAssignment(
    input: RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const existing = this.roleAssignmentsById.get(input.roleAssignmentId);
    if (!existing) {
      throw new Error("Role assignment not found.");
    }

    return this.upsertRoleAssignment({
      mutation: input.mutation,
      record: {
        ...existing,
        status: RoleAssignmentStatuses.revoked,
        revokedAt: input.revokedAt ?? input.mutation.context.occurredAt ?? existing.lastModifiedAt,
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
    });
  }

  async findSharingGrantById(sharingGrantId: string): Promise<AuthorizationSharingGrantPersistenceRecord | undefined> {
    return this.sharingGrantsById.get(sharingGrantId);
  }

  async listSharingGrants(
    query: AuthorizationSharingGrantPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantPersistenceRecord>> {
    const asOfEpoch = query.asOf ? Date.parse(query.asOf) : undefined;
    return [...this.sharingGrantsById.values()].filter((record) => {
      if (query.resource) {
        if (toAuthorizationResourceLookupKey(record) !== toAuthorizationResourceLookupKey(query.resource)) {
          return false;
        }
      }
      if (query.workspaceId && record.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.subjectUserIdentityId && toAuthorizationSharingSubjectLookupKey(record.subject) !== `user:${query.subjectUserIdentityId}`) {
        return false;
      }
      if (
        query.subjectWorkspaceId
        && record.subject.kind !== "workspace"
        && record.subject.kind !== "workspace-role"
      ) {
        return false;
      }
      if (
        query.subjectWorkspaceId
        && record.subject.kind !== "public"
        && record.subject.kind !== "user"
        && record.subject.workspaceId !== query.subjectWorkspaceId
      ) {
        return false;
      }
      if (query.subjectRoleKey && (record.subject.kind !== "workspace-role" || record.subject.roleKey !== query.subjectRoleKey)) {
        return false;
      }
      if (!query.includeRevoked && !!record.revokedAt) {
        return false;
      }
      if (!query.includeExpired && record.expiresAt && asOfEpoch && Date.parse(record.expiresAt) <= asOfEpoch) {
        return false;
      }
      return true;
    });
  }

  async upsertSharingGrant(
    input: UpsertAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const operationKey = normalizeAuthorizationMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      const replayRecord = replay as AuthorizationSharingGrantPersistenceRecord;
      return Object.freeze({
        record: replayRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const existing = this.sharingGrantsById.get(input.record.id);
    if (typeof input.mutation.expectedRevision === "number" && existing && existing.revision !== input.mutation.expectedRevision) {
      throw new Error("Sharing grant expectedRevision did not match persisted revision.");
    }

    const next: AuthorizationSharingGrantPersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.sharingGrantsById.set(next.id, next);
    const result = Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
    this.mutationReplayByOperationKey.set(operationKey, next);
    return result;
  }

  async revokeSharingGrant(
    input: RevokeAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const existing = this.sharingGrantsById.get(input.sharingGrantId);
    if (!existing) {
      throw new Error("Sharing grant not found.");
    }
    return this.upsertSharingGrant({
      mutation: input.mutation,
      record: {
        ...existing,
        revokedAt: input.revokedAt ?? input.mutation.context.occurredAt ?? existing.lastModifiedAt,
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
    });
  }

  async findResourcePolicyMetadata(
    resource: AuthorizationPersistenceResourceLocator,
  ): Promise<AuthorizationResourcePolicyMetadataPersistenceRecord | undefined> {
    return this.resourcePolicyByKey.get(toAuthorizationResourceLookupKey(resource));
  }

  async listResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    return [...this.resourcePolicyByKey.values()].filter((record) => {
      if (query.resource && toAuthorizationResourceLookupKey(record) !== toAuthorizationResourceLookupKey(query.resource)) {
        return false;
      }
      if (query.workspaceId && record.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.ownerUserIdentityId && record.ownerUserIdentityId !== query.ownerUserIdentityId) {
        return false;
      }
      if (query.visibility && record.visibility !== query.visibility) {
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
    const operationKey = normalizeAuthorizationMutationOperationKey(input.mutation.operationKey);
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      const replayRecord = replay as AuthorizationResourcePolicyMetadataPersistenceRecord;
      return Object.freeze({
        record: replayRecord,
        changed: false,
        wasReplay: true,
      });
    }

    const key = toAuthorizationResourceLookupKey(input.record);
    const existing = this.resourcePolicyByKey.get(key);
    if (typeof input.mutation.expectedRevision === "number" && existing && existing.revision !== input.mutation.expectedRevision) {
      throw new Error("Resource policy metadata expectedRevision did not match persisted revision.");
    }

    const next: AuthorizationResourcePolicyMetadataPersistenceRecord = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
      lastModifiedAt: input.mutation.context.occurredAt ?? input.record.lastModifiedAt,
      lastModifiedBy: input.mutation.context.actorUserIdentityId,
    });

    this.resourcePolicyByKey.set(key, next);
    const result = Object.freeze({
      record: next,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(next),
      wasReplay: false,
    });
    this.mutationReplayByOperationKey.set(operationKey, next);
    return result;
  }

  async softDeleteResourcePolicyMetadata(
    input: SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const key = toAuthorizationResourceLookupKey(input.resource);
    const existing = this.resourcePolicyByKey.get(key);
    if (!existing) {
      throw new Error("Resource policy metadata not found.");
    }
    return this.upsertResourcePolicyMetadata({
      mutation: input.mutation,
      record: {
        ...existing,
        deletedAt: input.deletedAt ?? input.mutation.context.occurredAt ?? existing.lastModifiedAt,
        deletedByUserIdentityId: input.deletedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
    });
  }
}

describe("authorization persistence repository contract assumptions", () => {
  it("supports idempotent role-assignment upsert and workspace-aware lookups", async () => {
    const adapter = new InMemoryAuthorizationPolicyPersistenceAdapter();
    const ports: AuthorizationPolicyPersistencePorts = {
      roleAssignmentPersistenceRepository: adapter,
      sharingGrantPersistenceRepository: adapter,
      resourcePolicyMetadataPersistenceRepository: adapter,
    };

    const initialRecord: AuthorizationRoleAssignmentPersistenceRecord = Object.freeze({
      id: "role-assignment-1",
      actorUserIdentityId: "user-1",
      roleKey: "admin",
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace-1",
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-05T12:00:00.000Z",
      assignedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 0,
    });

    const firstWrite = await ports.roleAssignmentPersistenceRepository.upsertRoleAssignment({
      record: initialRecord,
      mutation: {
        operationKey: "op-role-upsert-1",
        context: {
          actorUserIdentityId: "user-owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    const replayWrite = await ports.roleAssignmentPersistenceRepository.upsertRoleAssignment({
      record: initialRecord,
      mutation: {
        operationKey: "op-role-upsert-1",
        context: {
          actorUserIdentityId: "user-owner",
          occurredAt: "2026-04-05T12:00:01.000Z",
        },
      },
    });
    const listed = await ports.roleAssignmentPersistenceRepository.listRoleAssignments({
      workspaceId: "workspace-1",
      actorUserIdentityId: "user-1",
      includeRevoked: false,
    });

    expect(firstWrite.changed).toBeTrue();
    expect(firstWrite.wasReplay).toBeFalse();
    expect(firstWrite.record.revision).toBe(1);
    expect(replayWrite.changed).toBeFalse();
    expect(replayWrite.wasReplay).toBeTrue();
    expect(replayWrite.record.revision).toBe(1);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.workspaceId).toBe("workspace-1");
  });

  it("supports sharing-grant resolution by resource and subject with revocation filtering", async () => {
    const adapter = new InMemoryAuthorizationPolicyPersistenceAdapter();
    const ports: AuthorizationPolicyPersistencePorts = {
      roleAssignmentPersistenceRepository: adapter,
      sharingGrantPersistenceRepository: adapter,
      resourcePolicyMetadataPersistenceRepository: adapter,
    };

    const sharingRecord: AuthorizationSharingGrantPersistenceRecord = Object.freeze({
      id: "sharing-grant-1",
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-001",
      workspaceId: "workspace-1",
      subject: {
        kind: "user",
        userIdentityId: "user-2",
      },
      permissionKeys: Object.freeze(["asset.read"]),
      grantedAt: "2026-04-05T12:00:00.000Z",
      grantedByUserIdentityId: "user-owner",
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 0,
    });

    await ports.sharingGrantPersistenceRepository.upsertSharingGrant({
      record: sharingRecord,
      mutation: {
        operationKey: "op-sharing-upsert-1",
        context: {
          actorUserIdentityId: "user-owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });
    await ports.sharingGrantPersistenceRepository.revokeSharingGrant({
      sharingGrantId: "sharing-grant-1",
      mutation: {
        operationKey: "op-sharing-revoke-1",
        context: {
          actorUserIdentityId: "user-owner",
          occurredAt: "2026-04-05T12:01:00.000Z",
        },
      },
    });

    const activeGrants = await ports.sharingGrantPersistenceRepository.listSharingGrants({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-001",
      },
      subjectUserIdentityId: "user-2",
      includeRevoked: false,
    });
    const allGrants = await ports.sharingGrantPersistenceRepository.listSharingGrants({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-001",
      },
      subjectUserIdentityId: "user-2",
      includeRevoked: true,
    });

    expect(activeGrants).toHaveLength(0);
    expect(allGrants).toHaveLength(1);
    expect(allGrants[0]?.revokedAt).toBe("2026-04-05T12:01:00.000Z");
  });

  it("supports resource-policy metadata persistence with soft-delete semantics", async () => {
    const adapter = new InMemoryAuthorizationPolicyPersistenceAdapter();
    const ports: AuthorizationPolicyPersistencePorts = {
      roleAssignmentPersistenceRepository: adapter,
      sharingGrantPersistenceRepository: adapter,
      resourcePolicyMetadataPersistenceRepository: adapter,
    };

    const metadata: AuthorizationResourcePolicyMetadataPersistenceRecord = Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset-001",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-1",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: "explicit",
      allowResharing: false,
      isPublishedCapable: false,
      createdAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 0,
    });

    await ports.resourcePolicyMetadataPersistenceRepository.upsertResourcePolicyMetadata({
      record: metadata,
      mutation: {
        operationKey: "op-policy-upsert-1",
        context: {
          actorUserIdentityId: "user-owner",
          occurredAt: "2026-04-05T12:00:00.000Z",
        },
      },
    });

    await ports.resourcePolicyMetadataPersistenceRepository.softDeleteResourcePolicyMetadata({
      resource: {
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-001",
      },
      mutation: {
        operationKey: "op-policy-delete-1",
        context: {
          actorUserIdentityId: "user-owner",
          occurredAt: "2026-04-05T12:05:00.000Z",
        },
      },
    });

    const visibleMetadata = await ports.resourcePolicyMetadataPersistenceRepository.listResourcePolicyMetadata({
      workspaceId: "workspace-1",
      includeDeleted: false,
    });
    const deletedMetadata = await ports.resourcePolicyMetadataPersistenceRepository.listResourcePolicyMetadata({
      workspaceId: "workspace-1",
      includeDeleted: true,
    });

    expect(visibleMetadata).toHaveLength(0);
    expect(deletedMetadata).toHaveLength(1);
    expect(deletedMetadata[0]?.deletedAt).toBe("2026-04-05T12:05:00.000Z");
  });
});

