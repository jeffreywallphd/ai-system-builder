import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../../../application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../../../application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../../../application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../../../application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import {
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  type PermissionGrant,
  createRoleAssignment,
} from "../../../domain/authorization/AuthorizationDomain";
import type { SqliteAuthorizationPersistenceAdapter } from "./SqliteAuthorizationPersistenceAdapter";

export interface SqliteAuthorizationPolicyReadAdapterDependencies {
  readonly authorizationPersistenceAdapter: SqliteAuthorizationPersistenceAdapter;
}

export class SqliteAuthorizationPolicyReadAdapter
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public constructor(private readonly dependencies: SqliteAuthorizationPolicyReadAdapterDependencies) {}

  public async getActorRoleGrantSnapshot(
    query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    const actorUserIdentityId = normalizeOptional(query.actor.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return emptyRoleGrantSnapshot();
    }

    const records = await this.dependencies.authorizationPersistenceAdapter.listRoleAssignments({
      actorUserIdentityId,
      includeRevoked: false,
      asOf: query.asOf,
    });

    const roleAssignments = records.map((record) => createRoleAssignment({
      id: record.id,
      actorUserIdentityId: record.actorUserIdentityId,
      roleKey: record.roleKey,
      scope: record.scope,
      workspaceId: record.scope === RoleAssignmentScopes.workspace ? record.workspaceId : undefined,
      resourceType: record.scope === RoleAssignmentScopes.resource ? record.resourceType : undefined,
      resourceId: record.scope === RoleAssignmentScopes.resource ? record.resourceId : undefined,
      status: record.status === RoleAssignmentStatuses.revoked ? RoleAssignmentStatuses.revoked : RoleAssignmentStatuses.active,
      assignedByUserIdentityId: record.assignedByUserIdentityId,
      assignedAt: record.assignedAt,
      revokedAt: record.revokedAt,
    }));

    return Object.freeze({
      roleAssignments: Object.freeze(roleAssignments),
      permissionGrants: Object.freeze([] as PermissionGrant[]),
    });
  }

  public async listSharingGrants(
    query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    const records = await this.dependencies.authorizationPersistenceAdapter.listSharingGrants({
      resource: query.resource,
      includeRevoked: false,
      includeExpired: false,
      asOf: query.asOf,
    });

    return Object.freeze(records.map((record) => Object.freeze({
      id: record.id,
      subject: record.subject,
      permissionKeys: record.permissionKeys,
      grantedByUserIdentityId: record.grantedByUserIdentityId,
      grantedAt: record.grantedAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
    })));
  }

  public async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    const records = await this.dependencies.authorizationPersistenceAdapter.listResourcePolicyMetadata({
      resource: query.resource,
      includeDeleted: false,
      asOf: query.asOf,
      limit: 1,
      offset: 0,
    });

    const record = records[0];
    if (!record) {
      return undefined;
    }

    return toReadModelMetadata(record);
  }

  public async listResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    const records = await this.dependencies.authorizationPersistenceAdapter.listResourcePolicyMetadata({
      workspaceId: query.workspaceId,
      ownerUserIdentityId: query.ownerUserIdentityId,
      visibility: query.visibility,
      includeDeleted: false,
      asOf: query.asOf,
      limit: query.limit,
      offset: query.offset,
    });

    return Object.freeze(records.map((record) => toReadModelMetadata(record)));
  }
}

function toReadModelMetadata(record: {
  readonly resourceFamily: AuthorizationResourcePolicyMetadata["resourceFamily"];
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerUserIdentityId: string;
  readonly ownershipScope: AuthorizationResourcePolicyMetadata["ownershipScope"];
  readonly workspaceId?: string;
  readonly visibility: AuthorizationResourcePolicyMetadata["visibility"];
  readonly sharingPolicyMode: AuthorizationResourcePolicyMetadata["sharingPolicyMode"];
  readonly allowResharing: boolean;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
}): AuthorizationResourcePolicyMetadata {
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
  });
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function emptyRoleGrantSnapshot(): AuthorizationActorRoleGrantSnapshot {
  return Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
}
