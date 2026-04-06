import fs from "node:fs";
import path from "node:path";
import type { IAuthorizationResourcePolicyMetadataPersistenceRepository } from "../../../application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "../../../application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository";
import type { IAuthorizationSharingGrantPersistenceRepository } from "../../../application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository";
import { RoleAssignmentStatuses } from "../../../domain/authorization/AuthorizationDomain";
import {
  normalizeAuthorizationMutationOperationKey,
  toAuthorizationResourceLookupKey,
  type AuthorizationPersistenceMutationResult,
  type AuthorizationPersistenceResourceLocator,
  type AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  type AuthorizationResourcePolicyMetadataPersistenceRecord,
  type AuthorizationRoleAssignmentPersistenceLookupQuery,
  type AuthorizationRoleAssignmentPersistenceRecord,
  type AuthorizationSharingGrantPersistenceLookupQuery,
  type AuthorizationSharingGrantPersistenceRecord,
  type RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  type RevokeAuthorizationSharingGrantPersistenceRecordInput,
  type SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  type UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  type UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  type UpsertAuthorizationSharingGrantPersistenceRecordInput,
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import {
  mapResourcePolicyMetadataRecordToRowValues,
  mapResourcePolicyMetadataRowToRecord,
  mapRoleAssignmentRecordToRowValues,
  mapRoleAssignmentRowToRecord,
  mapSharingGrantRecordToRowValues,
  mapSharingGrantRowToRecord,
  normalizeAuthorizationLookup,
  parseMutationReplayRecord,
  type AuthorizationMutationReplayRow,
  type AuthorizationResourcePolicyMetadataRow,
  type AuthorizationRoleAssignmentRow,
  type AuthorizationSharingGrantRow,
} from "./AuthorizationPersistenceMapper";
import {
  AUTHORIZATION_PERSISTENCE_MIGRATIONS,
  AUTHORIZATION_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteAuthorizationPersistenceMigrations";
import {
  resolvePersistenceMutationCreatedAt,
  resolvePersistenceMutationMetadata,
} from "../common/PersistenceMutationMetadata";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";

export interface SqliteAuthorizationPersistenceAdapterCacheOptions {
  readonly enabled?: boolean;
  readonly maxEntriesPerStore?: number;
}

export interface SqliteAuthorizationPersistenceAdapterOptions {
  readonly cache?: SqliteAuthorizationPersistenceAdapterCacheOptions;
}

const DefaultCacheMaxEntriesPerStore = 512;

export class SqliteAuthorizationPersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements
    IAuthorizationRoleAssignmentPersistenceRepository,
    IAuthorizationSharingGrantPersistenceRepository,
    IAuthorizationResourcePolicyMetadataPersistenceRepository {
  private database?: SqliteCompatDatabase;
  private initialized = false;
  private readonly cacheEnabled: boolean;
  private readonly maxCacheEntriesPerStore: number;
  private readonly roleAssignmentsListCache = new Map<string, ReadonlyArray<AuthorizationRoleAssignmentPersistenceRecord>>();
  private readonly sharingGrantsListCache = new Map<string, ReadonlyArray<AuthorizationSharingGrantPersistenceRecord>>();
  private readonly resourcePolicyFindCache = new Map<string, AuthorizationResourcePolicyMetadataPersistenceRecord | null>();
  private readonly resourcePolicyListCache = new Map<string, ReadonlyArray<AuthorizationResourcePolicyMetadataPersistenceRecord>>();

  public constructor(
    private readonly databasePath: string,
    options?: SqliteAuthorizationPersistenceAdapterOptions,
  ) {
    super("Authorization");
    this.cacheEnabled = options?.cache?.enabled ?? true;
    const requestedMaxEntries = options?.cache?.maxEntriesPerStore;
    this.maxCacheEntriesPerStore = Number.isInteger(requestedMaxEntries) && (requestedMaxEntries as number) > 0
      ? requestedMaxEntries as number
      : DefaultCacheMaxEntriesPerStore;
  }

  public async findRoleAssignmentById(roleAssignmentId: string): Promise<AuthorizationRoleAssignmentPersistenceRecord | undefined> {
    const normalizedRoleAssignmentId = normalizeAuthorizationLookup(roleAssignmentId);
    if (!normalizedRoleAssignmentId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        role_assignment_id,
        actor_user_identity_id,
        role_key,
        scope,
        workspace_id,
        resource_family,
        resource_type,
        resource_id,
        status,
        assigned_at,
        assigned_by_user_identity_id,
        revoked_at,
        revoked_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_role_assignments
      WHERE role_assignment_id = ?
      LIMIT 1
    `).get(normalizedRoleAssignmentId) as AuthorizationRoleAssignmentRow | undefined;

    return row ? mapRoleAssignmentRowToRecord(row) : undefined;
  }

  public async listRoleAssignments(
    query: AuthorizationRoleAssignmentPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationRoleAssignmentPersistenceRecord>> {
    const cacheKey = this.toRoleAssignmentListCacheKey(query);
    const cached = this.readFromCache(this.roleAssignmentsListCache, cacheKey);
    if (cached) {
      return cached;
    }

    const clauses: string[] = [];
    const params: unknown[] = [];

    const workspaceId = normalizeAuthorizationLookup(query.workspaceId ?? "");
    if (workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(workspaceId);
    }

    const actorUserIdentityId = normalizeAuthorizationLookup(query.actorUserIdentityId ?? "");
    if (actorUserIdentityId) {
      clauses.push("actor_user_identity_id = ?");
      params.push(actorUserIdentityId);
    }

    const roleKey = normalizeAuthorizationLookup(query.roleKey ?? "");
    if (roleKey) {
      clauses.push("role_key = ?");
      params.push(roleKey);
    }

    if (query.scope) {
      clauses.push("scope = ?");
      params.push(query.scope);
    }

    if (query.resourceFamily) {
      clauses.push("resource_family = ?");
      params.push(query.resourceFamily);
    }

    const resourceType = normalizeAuthorizationLookup(query.resourceType ?? "");
    if (resourceType) {
      clauses.push("resource_type = ?");
      params.push(resourceType);
    }

    const resourceId = normalizeAuthorizationLookup(query.resourceId ?? "");
    if (resourceId) {
      clauses.push("resource_id = ?");
      params.push(resourceId);
    }

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    const includeRevoked = query.includeRevoked ?? false;
    const asOf = normalizeAuthorizationLookup(query.asOf ?? "");

    if (!includeRevoked) {
      clauses.push("status != ?");
      params.push(RoleAssignmentStatuses.revoked);
      if (asOf) {
        clauses.push("(revoked_at IS NULL OR revoked_at > ?)");
        params.push(asOf);
      } else {
        clauses.push("revoked_at IS NULL");
      }
    }

    if (asOf) {
      clauses.push("assigned_at <= ?");
      params.push(asOf);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        role_assignment_id,
        actor_user_identity_id,
        role_key,
        scope,
        workspace_id,
        resource_family,
        resource_type,
        resource_id,
        status,
        assigned_at,
        assigned_by_user_identity_id,
        revoked_at,
        revoked_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_role_assignments
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY assigned_at DESC, role_assignment_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as AuthorizationRoleAssignmentRow[];

    const result = Object.freeze(rows.map((row) => mapRoleAssignmentRowToRecord(row)));
    this.writeToCache(this.roleAssignmentsListCache, cacheKey, result);
    return result;
  }

  public async upsertRoleAssignment(
    input: UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const operationKey = normalizeAuthorizationMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<AuthorizationRoleAssignmentPersistenceRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let persistedRecord: AuthorizationRoleAssignmentPersistenceRecord | undefined;

    this.getDatabase().transaction(() => {
      const existing = this.getRoleAssignmentByIdInternal(input.record.id);
      const metadata = resolvePersistenceMutationMetadata({
        existing,
        createdAt: input.record.createdAt,
        createdBy: input.record.createdBy,
        actorId: input.mutation.context.actorUserIdentityId,
        expectedRevision: input.mutation.expectedRevision,
        occurredAt: input.mutation.context.occurredAt,
        entityName: "Role assignment",
      });

      persistedRecord = Object.freeze({
        ...input.record,
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        lastModifiedAt: metadata.lastModifiedAt,
        lastModifiedBy: metadata.lastModifiedBy,
        revision: metadata.revision,
      });

      this.executeMutation("upsert role assignment", () => this.getDatabase().prepare(`
          INSERT INTO authorization_role_assignments (
            role_assignment_id,
            actor_user_identity_id,
            role_key,
            scope,
            workspace_id,
            resource_family,
            resource_type,
            resource_id,
            status,
            assigned_at,
            assigned_by_user_identity_id,
            revoked_at,
            revoked_by_user_identity_id,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(role_assignment_id) DO UPDATE SET
            actor_user_identity_id = excluded.actor_user_identity_id,
            role_key = excluded.role_key,
            scope = excluded.scope,
            workspace_id = excluded.workspace_id,
            resource_family = excluded.resource_family,
            resource_type = excluded.resource_type,
            resource_id = excluded.resource_id,
            status = excluded.status,
            assigned_at = excluded.assigned_at,
            assigned_by_user_identity_id = excluded.assigned_by_user_identity_id,
            revoked_at = excluded.revoked_at,
            revoked_by_user_identity_id = excluded.revoked_by_user_identity_id,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > authorization_role_assignments.revision
        `).run(...mapRoleAssignmentRecordToRowValues(persistedRecord as AuthorizationRoleAssignmentPersistenceRecord)));

      this.persistMutationReplayRecord(
        operationKey,
        "role-assignment",
        persistedRecord as AuthorizationRoleAssignmentPersistenceRecord,
      );
    })();

    this.invalidateRoleAssignmentCaches();

    return Object.freeze({
      record: persistedRecord as AuthorizationRoleAssignmentPersistenceRecord,
      changed: true,
      wasReplay: false,
    });
  }

  public async revokeRoleAssignment(
    input: RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const existing = await this.findRoleAssignmentById(input.roleAssignmentId);
    if (!existing) {
      throw new Error(`Role assignment '${input.roleAssignmentId}' was not found.`);
    }

    const revokedAt = resolvePersistenceMutationCreatedAt(input.revokedAt ?? input.mutation.context.occurredAt);
    return this.upsertRoleAssignment({
      mutation: input.mutation,
      record: {
        ...existing,
        status: RoleAssignmentStatuses.revoked,
        revokedAt,
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
    });
  }

  public async findSharingGrantById(sharingGrantId: string): Promise<AuthorizationSharingGrantPersistenceRecord | undefined> {
    const normalizedSharingGrantId = normalizeAuthorizationLookup(sharingGrantId);
    if (!normalizedSharingGrantId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        sharing_grant_id,
        resource_family,
        resource_type,
        resource_id,
        workspace_id,
        subject_kind,
        subject_user_identity_id,
        subject_workspace_id,
        subject_role_key,
        permission_keys_json,
        granted_at,
        granted_by_user_identity_id,
        expires_at,
        revoked_at,
        revoked_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_sharing_grants
      WHERE sharing_grant_id = ?
      LIMIT 1
    `).get(normalizedSharingGrantId) as AuthorizationSharingGrantRow | undefined;

    return row ? mapSharingGrantRowToRecord(row) : undefined;
  }

  public async listSharingGrants(
    query: AuthorizationSharingGrantPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantPersistenceRecord>> {
    const cacheKey = this.toSharingGrantListCacheKey(query);
    const cached = this.readFromCache(this.sharingGrantsListCache, cacheKey);
    if (cached) {
      return cached;
    }

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.resource) {
      clauses.push("resource_family = ? AND resource_type = ? AND resource_id = ?");
      params.push(query.resource.resourceFamily, query.resource.resourceType, query.resource.resourceId);
    }

    const workspaceId = normalizeAuthorizationLookup(query.workspaceId ?? "");
    if (workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(workspaceId);
    }

    const subjectUserIdentityId = normalizeAuthorizationLookup(query.subjectUserIdentityId ?? "");
    if (subjectUserIdentityId) {
      clauses.push("subject_kind = 'user' AND subject_user_identity_id = ?");
      params.push(subjectUserIdentityId);
    }

    const subjectWorkspaceId = normalizeAuthorizationLookup(query.subjectWorkspaceId ?? "");
    if (subjectWorkspaceId) {
      clauses.push(`(
        (subject_kind = 'workspace' AND subject_workspace_id = ?)
        OR (subject_kind = 'workspace-role' AND subject_workspace_id = ?)
      )`);
      params.push(subjectWorkspaceId, subjectWorkspaceId);
    }

    const subjectRoleKey = normalizeAuthorizationLookup(query.subjectRoleKey ?? "");
    if (subjectRoleKey) {
      clauses.push("subject_kind = 'workspace-role' AND subject_role_key = ?");
      params.push(subjectRoleKey);
    }

    const includeRevoked = query.includeRevoked ?? false;
    const includeExpired = query.includeExpired ?? false;
    const asOf = normalizeAuthorizationLookup(query.asOf ?? "");

    if (!includeRevoked) {
      if (asOf) {
        clauses.push("(revoked_at IS NULL OR revoked_at > ?)");
        params.push(asOf);
      } else {
        clauses.push("revoked_at IS NULL");
      }
    }

    if (!includeExpired && asOf) {
      clauses.push("(expires_at IS NULL OR expires_at > ?)");
      params.push(asOf);
    }

    if (asOf) {
      clauses.push("granted_at <= ?");
      params.push(asOf);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        sharing_grant_id,
        resource_family,
        resource_type,
        resource_id,
        workspace_id,
        subject_kind,
        subject_user_identity_id,
        subject_workspace_id,
        subject_role_key,
        permission_keys_json,
        granted_at,
        granted_by_user_identity_id,
        expires_at,
        revoked_at,
        revoked_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_sharing_grants
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY granted_at DESC, sharing_grant_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as AuthorizationSharingGrantRow[];

    const result = Object.freeze(rows.map((row) => mapSharingGrantRowToRecord(row)));
    this.writeToCache(this.sharingGrantsListCache, cacheKey, result);
    return result;
  }

  public async upsertSharingGrant(
    input: UpsertAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const operationKey = normalizeAuthorizationMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<AuthorizationSharingGrantPersistenceRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let persistedRecord: AuthorizationSharingGrantPersistenceRecord | undefined;

    this.getDatabase().transaction(() => {
      const existing = this.getSharingGrantByIdInternal(input.record.id);
      const metadata = resolvePersistenceMutationMetadata({
        existing,
        createdAt: input.record.createdAt,
        createdBy: input.record.createdBy,
        actorId: input.mutation.context.actorUserIdentityId,
        expectedRevision: input.mutation.expectedRevision,
        occurredAt: input.mutation.context.occurredAt,
        entityName: "Sharing grant",
      });

      persistedRecord = Object.freeze({
        ...input.record,
        permissionKeys: Object.freeze([...new Set(input.record.permissionKeys)]),
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        lastModifiedAt: metadata.lastModifiedAt,
        lastModifiedBy: metadata.lastModifiedBy,
        revision: metadata.revision,
      });

      this.executeMutation("upsert sharing grant", () => this.getDatabase().prepare(`
          INSERT INTO authorization_sharing_grants (
            sharing_grant_id,
            resource_family,
            resource_type,
            resource_id,
            workspace_id,
            subject_kind,
            subject_user_identity_id,
            subject_workspace_id,
            subject_role_key,
            permission_keys_json,
            granted_at,
            granted_by_user_identity_id,
            expires_at,
            revoked_at,
            revoked_by_user_identity_id,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(sharing_grant_id) DO UPDATE SET
            resource_family = excluded.resource_family,
            resource_type = excluded.resource_type,
            resource_id = excluded.resource_id,
            workspace_id = excluded.workspace_id,
            subject_kind = excluded.subject_kind,
            subject_user_identity_id = excluded.subject_user_identity_id,
            subject_workspace_id = excluded.subject_workspace_id,
            subject_role_key = excluded.subject_role_key,
            permission_keys_json = excluded.permission_keys_json,
            granted_at = excluded.granted_at,
            granted_by_user_identity_id = excluded.granted_by_user_identity_id,
            expires_at = excluded.expires_at,
            revoked_at = excluded.revoked_at,
            revoked_by_user_identity_id = excluded.revoked_by_user_identity_id,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > authorization_sharing_grants.revision
        `).run(...mapSharingGrantRecordToRowValues(persistedRecord as AuthorizationSharingGrantPersistenceRecord)));

      this.persistMutationReplayRecord(
        operationKey,
        "sharing-grant",
        persistedRecord as AuthorizationSharingGrantPersistenceRecord,
      );
    })();

    this.invalidateSharingGrantCaches();

    return Object.freeze({
      record: persistedRecord as AuthorizationSharingGrantPersistenceRecord,
      changed: true,
      wasReplay: false,
    });
  }

  public async revokeSharingGrant(
    input: RevokeAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const existing = await this.findSharingGrantById(input.sharingGrantId);
    if (!existing) {
      throw new Error(`Sharing grant '${input.sharingGrantId}' was not found.`);
    }

    const revokedAt = resolvePersistenceMutationCreatedAt(input.revokedAt ?? input.mutation.context.occurredAt);
    return this.upsertSharingGrant({
      mutation: input.mutation,
      record: {
        ...existing,
        revokedAt,
        revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
    });
  }

  public async findResourcePolicyMetadata(
    resource: AuthorizationPersistenceResourceLocator,
  ): Promise<AuthorizationResourcePolicyMetadataPersistenceRecord | undefined> {
    const cacheKey = this.toResourcePolicyFindCacheKey(resource);
    const cached = this.readFromCache(this.resourcePolicyFindCache, cacheKey);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const row = this.getResourcePolicyMetadataByResourceInternal(resource);
    if (!row || row.deleted_at) {
      this.writeToCache(this.resourcePolicyFindCache, cacheKey, null);
      return undefined;
    }

    const result = mapResourcePolicyMetadataRowToRecord(row);
    this.writeToCache(this.resourcePolicyFindCache, cacheKey, result);
    return result;
  }

  public async listResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataPersistenceLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const cacheKey = this.toResourcePolicyListCacheKey(query);
    const cached = this.readFromCache(this.resourcePolicyListCache, cacheKey);
    if (cached) {
      return cached;
    }

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.resource) {
      clauses.push("resource_family = ? AND resource_type = ? AND resource_id = ?");
      params.push(query.resource.resourceFamily, query.resource.resourceType, query.resource.resourceId);
    }

    const workspaceId = normalizeAuthorizationLookup(query.workspaceId ?? "");
    if (workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(workspaceId);
    }

    const ownerUserIdentityId = normalizeAuthorizationLookup(query.ownerUserIdentityId ?? "");
    if (ownerUserIdentityId) {
      clauses.push("owner_user_identity_id = ?");
      params.push(ownerUserIdentityId);
    }

    if (query.visibility) {
      clauses.push("visibility = ?");
      params.push(query.visibility);
    }

    const includeDeleted = query.includeDeleted ?? false;
    const asOf = normalizeAuthorizationLookup(query.asOf ?? "");

    if (!includeDeleted) {
      if (asOf) {
        clauses.push("(deleted_at IS NULL OR deleted_at > ?)");
        params.push(asOf);
      } else {
        clauses.push("deleted_at IS NULL");
      }
    }

    if (asOf) {
      clauses.push("created_at <= ?");
      params.push(asOf);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        resource_family,
        resource_type,
        resource_id,
        owner_user_identity_id,
        ownership_scope,
        workspace_id,
        visibility,
        sharing_policy_mode,
        allow_resharing,
        is_published_capable,
        published_at,
        deleted_at,
        deleted_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_resource_policy_metadata
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY last_modified_at DESC, resource_family ASC, resource_type ASC, resource_id ASC
      ${paging.sql}
    `).all(...params, ...paging.params) as AuthorizationResourcePolicyMetadataRow[];

    const result = Object.freeze(rows.map((row) => mapResourcePolicyMetadataRowToRecord(row)));
    this.writeToCache(this.resourcePolicyListCache, cacheKey, result);
    return result;
  }

  public async upsertResourcePolicyMetadata(
    input: UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const operationKey = normalizeAuthorizationMutationOperationKey(input.mutation.operationKey);
    const replay = this.getMutationReplayRecord<AuthorizationResourcePolicyMetadataPersistenceRecord>(operationKey);
    if (replay) {
      return Object.freeze({
        record: replay,
        changed: false,
        wasReplay: true,
      });
    }

    let persistedRecord: AuthorizationResourcePolicyMetadataPersistenceRecord | undefined;

    this.getDatabase().transaction(() => {
      const existing = this.getResourcePolicyMetadataRecordByResourceInternal(input.record);
      const metadata = resolvePersistenceMutationMetadata({
        existing,
        createdAt: input.record.createdAt,
        createdBy: input.record.createdBy,
        actorId: input.mutation.context.actorUserIdentityId,
        expectedRevision: input.mutation.expectedRevision,
        occurredAt: input.mutation.context.occurredAt,
        entityName: "Resource policy metadata",
      });

      persistedRecord = Object.freeze({
        ...input.record,
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        lastModifiedAt: metadata.lastModifiedAt,
        lastModifiedBy: metadata.lastModifiedBy,
        revision: metadata.revision,
      });

      this.executeMutation("upsert resource policy metadata", () => this.getDatabase().prepare(`
          INSERT INTO authorization_resource_policy_metadata (
            resource_family,
            resource_type,
            resource_id,
            owner_user_identity_id,
            ownership_scope,
            workspace_id,
            visibility,
            sharing_policy_mode,
            allow_resharing,
            is_published_capable,
            published_at,
            deleted_at,
            deleted_by_user_identity_id,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by,
            revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(resource_family, resource_type, resource_id) DO UPDATE SET
            owner_user_identity_id = excluded.owner_user_identity_id,
            ownership_scope = excluded.ownership_scope,
            workspace_id = excluded.workspace_id,
            visibility = excluded.visibility,
            sharing_policy_mode = excluded.sharing_policy_mode,
            allow_resharing = excluded.allow_resharing,
            is_published_capable = excluded.is_published_capable,
            published_at = excluded.published_at,
            deleted_at = excluded.deleted_at,
            deleted_by_user_identity_id = excluded.deleted_by_user_identity_id,
            created_at = excluded.created_at,
            created_by = excluded.created_by,
            last_modified_at = excluded.last_modified_at,
            last_modified_by = excluded.last_modified_by,
            revision = excluded.revision
          WHERE excluded.revision > authorization_resource_policy_metadata.revision
        `).run(...mapResourcePolicyMetadataRecordToRowValues(
          persistedRecord as AuthorizationResourcePolicyMetadataPersistenceRecord,
        )));

      this.persistMutationReplayRecord(
        operationKey,
        "resource-policy",
        persistedRecord as AuthorizationResourcePolicyMetadataPersistenceRecord,
      );
    })();

    this.invalidateResourcePolicyCaches(input.record);

    return Object.freeze({
      record: persistedRecord as AuthorizationResourcePolicyMetadataPersistenceRecord,
      changed: true,
      wasReplay: false,
    });
  }

  public async softDeleteResourcePolicyMetadata(
    input: SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const existing = this.getResourcePolicyMetadataRecordByResourceInternal(input.resource);
    if (!existing) {
      throw new Error(`Resource policy metadata '${toAuthorizationResourceLookupKey(input.resource)}' was not found.`);
    }

    const deletedAt = resolvePersistenceMutationCreatedAt(input.deletedAt ?? input.mutation.context.occurredAt);
    return this.upsertResourcePolicyMetadata({
      mutation: input.mutation,
      record: {
        ...existing,
        deletedAt,
        deletedByUserIdentityId: input.deletedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
      },
    });
  }

  public dispose(): void {
    this.clearCaches();
    this.database?.close();
    this.database = undefined;
    this.initialized = false;
  }

  private getDatabase(): SqliteCompatDatabase {
    if (!this.database) {
      fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
      this.database = openSqliteCompatDatabase(this.databasePath);
      this.database.pragma("journal_mode = WAL");
      this.database.pragma("foreign_keys = ON");
    }

    if (!this.initialized) {
      this.initialize(this.database);
      this.initialized = true;
    }

    return this.database;
  }

  private initialize(database: SqliteCompatDatabase): void {
    const currentVersion = this.getSchemaVersion(database);
    if (currentVersion > AUTHORIZATION_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Authorization schema version ${currentVersion} is newer than supported version ${AUTHORIZATION_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of AUTHORIZATION_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO authorization_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS authorization_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM authorization_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private getRoleAssignmentByIdInternal(
    roleAssignmentId: string,
  ): AuthorizationRoleAssignmentPersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        role_assignment_id,
        actor_user_identity_id,
        role_key,
        scope,
        workspace_id,
        resource_family,
        resource_type,
        resource_id,
        status,
        assigned_at,
        assigned_by_user_identity_id,
        revoked_at,
        revoked_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_role_assignments
      WHERE role_assignment_id = ?
      LIMIT 1
    `).get(roleAssignmentId) as AuthorizationRoleAssignmentRow | undefined;

    return row ? mapRoleAssignmentRowToRecord(row) : undefined;
  }

  private getSharingGrantByIdInternal(
    sharingGrantId: string,
  ): AuthorizationSharingGrantPersistenceRecord | undefined {
    const row = this.getDatabase().prepare(`
      SELECT
        sharing_grant_id,
        resource_family,
        resource_type,
        resource_id,
        workspace_id,
        subject_kind,
        subject_user_identity_id,
        subject_workspace_id,
        subject_role_key,
        permission_keys_json,
        granted_at,
        granted_by_user_identity_id,
        expires_at,
        revoked_at,
        revoked_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_sharing_grants
      WHERE sharing_grant_id = ?
      LIMIT 1
    `).get(sharingGrantId) as AuthorizationSharingGrantRow | undefined;

    return row ? mapSharingGrantRowToRecord(row) : undefined;
  }

  private getResourcePolicyMetadataByResourceInternal(
    resource: AuthorizationPersistenceResourceLocator,
  ): AuthorizationResourcePolicyMetadataRow | undefined {
    return this.getDatabase().prepare(`
      SELECT
        resource_family,
        resource_type,
        resource_id,
        owner_user_identity_id,
        ownership_scope,
        workspace_id,
        visibility,
        sharing_policy_mode,
        allow_resharing,
        is_published_capable,
        published_at,
        deleted_at,
        deleted_by_user_identity_id,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by,
        revision
      FROM authorization_resource_policy_metadata
      WHERE resource_family = ?
        AND resource_type = ?
        AND resource_id = ?
      LIMIT 1
    `).get(resource.resourceFamily, resource.resourceType, resource.resourceId) as
      | AuthorizationResourcePolicyMetadataRow
      | undefined;
  }

  private getResourcePolicyMetadataRecordByResourceInternal(
    resource: AuthorizationPersistenceResourceLocator,
  ): AuthorizationResourcePolicyMetadataPersistenceRecord | undefined {
    const row = this.getResourcePolicyMetadataByResourceInternal(resource);
    return row ? mapResourcePolicyMetadataRowToRecord(row) : undefined;
  }

  private getMutationReplayRecord<TRecord>(operationKey: string): TRecord | undefined {
    const replayRow = this.getDatabase().prepare(`
      SELECT
        operation_key,
        mutation_kind,
        record_snapshot_json,
        created_at
      FROM authorization_mutation_replays
      WHERE operation_key = ?
      LIMIT 1
    `).get(operationKey) as AuthorizationMutationReplayRow | undefined;

    return replayRow ? parseMutationReplayRecord<TRecord>(replayRow) : undefined;
  }

  private persistMutationReplayRecord<TRecord>(
    operationKey: string,
    mutationKind: "role-assignment" | "sharing-grant" | "resource-policy",
    record: TRecord,
  ): void {
    this.executeMutation("persist mutation replay", () => this.getDatabase().prepare(`
        INSERT INTO authorization_mutation_replays (
          operation_key,
          mutation_kind,
          record_snapshot_json,
          created_at
        ) VALUES (?, ?, ?, ?)
      `).run(
      operationKey,
      mutationKind,
      JSON.stringify(record),
      resolvePersistenceMutationCreatedAt(undefined),
    ));
  }

  private readFromCache<T>(cache: Map<string, T>, key: string): T | undefined {
    if (!this.cacheEnabled) {
      return undefined;
    }
    return cache.get(key);
  }

  private writeToCache<T>(cache: Map<string, T>, key: string, value: T): void {
    if (!this.cacheEnabled) {
      return;
    }

    if (cache.has(key)) {
      cache.delete(key);
    }
    cache.set(key, value);

    if (cache.size > this.maxCacheEntriesPerStore) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
  }

  private invalidateRoleAssignmentCaches(): void {
    this.roleAssignmentsListCache.clear();
  }

  private invalidateSharingGrantCaches(): void {
    this.sharingGrantsListCache.clear();
  }

  private invalidateResourcePolicyCaches(resource: AuthorizationPersistenceResourceLocator): void {
    this.resourcePolicyFindCache.delete(this.toResourcePolicyFindCacheKey(resource));
    this.resourcePolicyListCache.clear();
  }

  private clearCaches(): void {
    this.roleAssignmentsListCache.clear();
    this.sharingGrantsListCache.clear();
    this.resourcePolicyFindCache.clear();
    this.resourcePolicyListCache.clear();
  }

  private toRoleAssignmentListCacheKey(query: AuthorizationRoleAssignmentPersistenceLookupQuery): string {
    const statuses = query.statuses ? [...query.statuses].sort().join(",") : "";
    return [
      query.workspaceId ?? "",
      query.actorUserIdentityId ?? "",
      query.roleKey ?? "",
      query.scope ?? "",
      query.resourceFamily ?? "",
      query.resourceType ?? "",
      query.resourceId ?? "",
      statuses,
      String(query.includeRevoked ?? false),
      query.asOf ?? "",
      query.limit?.toString() ?? "",
      query.offset?.toString() ?? "",
    ].join("|");
  }

  private toSharingGrantListCacheKey(query: AuthorizationSharingGrantPersistenceLookupQuery): string {
    const resourceKey = query.resource ? toAuthorizationResourceLookupKey(query.resource) : "";
    return [
      resourceKey,
      query.workspaceId ?? "",
      query.subjectUserIdentityId ?? "",
      query.subjectWorkspaceId ?? "",
      query.subjectRoleKey ?? "",
      String(query.includeRevoked ?? false),
      String(query.includeExpired ?? false),
      query.asOf ?? "",
      query.limit?.toString() ?? "",
      query.offset?.toString() ?? "",
    ].join("|");
  }

  private toResourcePolicyFindCacheKey(resource: AuthorizationPersistenceResourceLocator): string {
    return toAuthorizationResourceLookupKey(resource);
  }

  private toResourcePolicyListCacheKey(query: AuthorizationResourcePolicyMetadataPersistenceLookupQuery): string {
    const resourceKey = query.resource ? toAuthorizationResourceLookupKey(query.resource) : "";
    return [
      resourceKey,
      query.workspaceId ?? "",
      query.ownerUserIdentityId ?? "",
      query.visibility ?? "",
      String(query.includeDeleted ?? false),
      query.asOf ?? "",
      query.limit?.toString() ?? "",
      query.offset?.toString() ?? "",
    ].join("|");
  }
}
