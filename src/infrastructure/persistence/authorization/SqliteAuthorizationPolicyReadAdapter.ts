import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "@application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "@application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "@application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import {
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  type PermissionGrant,
  createRoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses } from "@domain/workspaces/WorkspaceDomain";
import type { SqliteAuthorizationPersistenceAdapter } from "./SqliteAuthorizationPersistenceAdapter";
import {
  ConsolePersistenceDiagnosticsLogger,
  type IPersistenceDiagnosticsLogger,
} from "@infrastructure/logging/PersistenceDiagnosticsLogger";

export interface SqliteAuthorizationPolicyReadAdapterDependencies {
  readonly authorizationPersistenceAdapter: SqliteAuthorizationPersistenceAdapter;
  readonly workspaceAuthorizationReadRepository?: IWorkspaceAuthorizationReadRepository;
  readonly diagnosticsLogger?: IPersistenceDiagnosticsLogger;
}

export class SqliteAuthorizationPolicyReadAdapter
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  private readonly diagnosticsLogger: IPersistenceDiagnosticsLogger;

  public constructor(private readonly dependencies: SqliteAuthorizationPolicyReadAdapterDependencies) {
    this.diagnosticsLogger = dependencies.diagnosticsLogger ?? new ConsolePersistenceDiagnosticsLogger();
  }

  public async getActorRoleGrantSnapshot(
    query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    const actorUserIdentityId = normalizeOptional(query.actor.actorUserIdentityId);
    this.diagnosticsLogger.info({
      type: "persistence-diagnostic",
      level: "info",
      repository: "AuthorizationPolicy",
      operation: "getActorRoleGrantSnapshot",
      code: "auth.sqlite.role-snapshot.query",
      retryable: false,
      occurredAt: new Date().toISOString(),
      details: Object.freeze({
        actorUserIdentityId,
        actorServiceId: normalizeOptional(query.actor.actorServiceId),
        activeWorkspaceId: normalizeOptional(query.actor.activeWorkspaceId),
        asOf: query.asOf,
        resourceType: normalizeOptional(query.resource?.resourceType),
        resourceId: normalizeOptional(query.resource?.resourceId),
        resourceWorkspaceId: normalizeOptional(query.resource?.workspaceId),
      }),
    });
    if (!actorUserIdentityId) {
      this.diagnosticsLogger.info({
        type: "persistence-diagnostic",
        level: "info",
        repository: "AuthorizationPolicy",
        operation: "getActorRoleGrantSnapshot",
        code: "auth.sqlite.role-snapshot.result",
        retryable: false,
        occurredAt: new Date().toISOString(),
        details: Object.freeze({
          actorUserIdentityId,
          roleAssignmentCount: 0,
          permissionGrantCount: 0,
          roleScopes: Object.freeze([]),
          roleKeys: Object.freeze([]),
        }),
      });
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

    const synthesizedWorkspaceRoleAssignments = await this.resolveWorkspaceRoleAssignments({
      actorUserIdentityId,
      activeWorkspaceId: normalizeOptional(query.actor.activeWorkspaceId),
      asOf: query.asOf,
      existingRoleAssignments: roleAssignments,
    });
    roleAssignments.push(...synthesizedWorkspaceRoleAssignments);
    this.diagnosticsLogger.info({
      type: "persistence-diagnostic",
      level: "info",
      repository: "AuthorizationPolicy",
      operation: "getActorRoleGrantSnapshot",
      code: "auth.sqlite.role-snapshot.result",
      retryable: false,
      occurredAt: new Date().toISOString(),
      details: Object.freeze({
        actorUserIdentityId,
        roleAssignmentCount: roleAssignments.length,
        permissionGrantCount: 0,
        roleScopes: Object.freeze([...new Set(roleAssignments.map((assignment) => assignment.scope))].slice(0, 4)),
        roleKeys: Object.freeze([...new Set(roleAssignments.map((assignment) => assignment.roleKey))].slice(0, 8)),
      }),
    });

    return Object.freeze({
      roleAssignments: Object.freeze(roleAssignments),
      permissionGrants: Object.freeze([] as PermissionGrant[]),
    });
  }


  private async resolveWorkspaceRoleAssignments(input: {
    readonly actorUserIdentityId: string;
    readonly activeWorkspaceId?: string;
    readonly asOf?: string;
    readonly existingRoleAssignments: ReadonlyArray<ReturnType<typeof createRoleAssignment>>;
  }): Promise<ReadonlyArray<ReturnType<typeof createRoleAssignment>>> {
    if (!input.activeWorkspaceId || !this.dependencies.workspaceAuthorizationReadRepository) {
      return Object.freeze([]);
    }

    const workspaceSnapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId: input.activeWorkspaceId,
      userIdentityId: input.actorUserIdentityId,
      asOf: input.asOf,
    });
    const hasActiveMembership = workspaceSnapshot?.membership?.status === WorkspaceMembershipStatuses.active;
    const hasWorkspaceOwnerOverride = Boolean(workspaceSnapshot?.isWorkspaceOwner);
    if (!workspaceSnapshot || (!hasActiveMembership && !hasWorkspaceOwnerOverride)) {
      return Object.freeze([]);
    }

    const existingRoleKeys = new Set(input.existingRoleAssignments
      .filter((assignment) => assignment.scope === RoleAssignmentScopes.workspace && assignment.workspaceId === input.activeWorkspaceId)
      .map((assignment) => assignment.roleKey));

    const synthesized = workspaceSnapshot.effectiveRoles
      .filter((roleKey) => !existingRoleKeys.has(roleKey))
      .map((roleKey) => createRoleAssignment({
        id: `synthetic-role-assignment:${input.activeWorkspaceId}:${input.actorUserIdentityId}:${roleKey}`,
        actorUserIdentityId: input.actorUserIdentityId,
        roleKey,
        scope: RoleAssignmentScopes.workspace,
        workspaceId: input.activeWorkspaceId,
        status: RoleAssignmentStatuses.active,
        assignedByUserIdentityId: input.actorUserIdentityId,
        assignedAt: workspaceSnapshot.workspace.createdAt,
      }));

    return Object.freeze(synthesized);
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
