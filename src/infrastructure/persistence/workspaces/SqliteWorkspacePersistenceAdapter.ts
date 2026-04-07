import fs from "node:fs";
import path from "node:path";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "@application/workspaces/ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "@application/workspaces/ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "@application/workspaces/ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "@application/workspaces/ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "@application/workspaces/ports/IWorkspaceTransactionManager";
import {
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
  WorkspaceInvitationListQuery,
  WorkspacePendingInvitationByTokenHashLookupQuery,
  WorkspaceMembershipListQuery,
  WorkspaceListQuery,
  WorkspacePendingInvitationLookupQuery,
  WorkspaceRoleAssignmentListQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { openSqliteCompatDatabase, type SqliteCompatDatabase } from "../sqlite/SqliteCompat";
import { SqliteTransactionCoordinator } from "../sqlite/SqliteTransactionCoordinator";
import { SafeSqliteRepositoryBase } from "../common/SafeSqliteRepositoryBase";
import {
  mapWorkspaceInvitationRowToDomain,
  mapWorkspaceInvitationToRowValues,
  mapWorkspaceMembershipRowToDomain,
  mapWorkspaceMembershipToRowValues,
  mapWorkspaceRoleAssignmentRowToDomain,
  mapWorkspaceRoleAssignmentToRowValues,
  mapWorkspaceRowToDomain,
  mapWorkspaceToRowValues,
  normalizeEmailLookup,
  normalizeLookup,
  normalizeSlugLookup,
  type WorkspaceInvitationRow,
  type WorkspaceMembershipRow,
  type WorkspaceRoleAssignmentRow,
  type WorkspaceRow,
} from "./WorkspacePersistenceMapper";
import {
  WORKSPACE_PERSISTENCE_MIGRATIONS,
  WORKSPACE_PERSISTENCE_SCHEMA_VERSION,
} from "./SqliteWorkspacePersistenceMigrations";

export class SqliteWorkspacePersistenceAdapter
  extends SafeSqliteRepositoryBase
  implements
    IWorkspaceRepository,
    IWorkspaceMembershipRepository,
    IWorkspaceRoleAssignmentRepository,
    IWorkspaceInvitationRepository,
    IWorkspaceAuthorizationReadRepository,
    IWorkspaceTransactionManager {
  private database?: SqliteCompatDatabase;
  private initialized = false;
  private readonly transactionCoordinator: SqliteTransactionCoordinator;

  public constructor(private readonly databasePath: string) {
    super("Workspace");
    this.transactionCoordinator = new SqliteTransactionCoordinator(() => this.getDatabase());
  }

  public async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    const normalizedWorkspaceId = normalizeLookup(workspaceId);
    if (!normalizedWorkspaceId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        workspace_id,
        slug,
        display_name,
        description,
        status,
        owner_user_id,
        visibility,
        encryption_mode,
        content_encryption_required,
        key_scope,
        allow_preview_decryption,
        allow_worker_decryption,
        created_by,
        last_modified_by,
        created_at,
        last_modified_at
      FROM workspace_records
      WHERE workspace_id = ?
    `).get(normalizedWorkspaceId) as WorkspaceRow | undefined;

    return row ? mapWorkspaceRowToDomain(row) : undefined;
  }

  public async findWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const normalizedSlug = normalizeSlugLookup(slug);
    if (!normalizedSlug) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        workspace_id,
        slug,
        display_name,
        description,
        status,
        owner_user_id,
        visibility,
        encryption_mode,
        content_encryption_required,
        key_scope,
        allow_preview_decryption,
        allow_worker_decryption,
        created_by,
        last_modified_by,
        created_at,
        last_modified_at
      FROM workspace_records
      WHERE slug = ?
    `).get(normalizedSlug) as WorkspaceRow | undefined;

    return row ? mapWorkspaceRowToDomain(row) : undefined;
  }

  public async listWorkspaces(query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const ownerUserId = normalizeLookup(query.ownerUserId ?? "");
    if (ownerUserId) {
      clauses.push("w.owner_user_id = ?");
      params.push(ownerUserId);
    }

    if (query.visibility) {
      clauses.push("w.visibility = ?");
      params.push(query.visibility);
    }

    const slugPrefix = normalizeSlugLookup(query.slugPrefix ?? "");
    if (slugPrefix) {
      clauses.push("w.slug LIKE ?");
      params.push(`${slugPrefix}%`);
    }

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`w.status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    const memberUserIdentityId = normalizeLookup(query.memberUserIdentityId ?? "");
    if (memberUserIdentityId) {
      clauses.push(`EXISTS (
        SELECT 1
        FROM workspace_memberships m
        WHERE m.workspace_id = w.workspace_id
          AND m.user_identity_id = ?
          AND m.status = 'active'
      )`);
      params.push(memberUserIdentityId);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        w.workspace_id,
        w.slug,
        w.display_name,
        w.description,
        w.status,
        w.owner_user_id,
        w.visibility,
        w.encryption_mode,
        w.content_encryption_required,
        w.key_scope,
        w.allow_preview_decryption,
        w.allow_worker_decryption,
        w.created_by,
        w.last_modified_by,
        w.created_at,
        w.last_modified_at
      FROM workspace_records w
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY w.created_at DESC
      ${paging.sql}
    `).all(...params, ...paging.params) as WorkspaceRow[];

    return Object.freeze(rows.map((row) => mapWorkspaceRowToDomain(row)));
  }

  public async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    const result = this.executeMutation("save workspace", () => this.getDatabase().prepare(`
        INSERT INTO workspace_records (
          workspace_id,
          slug,
          display_name,
          description,
          status,
          owner_user_id,
          visibility,
          encryption_mode,
          content_encryption_required,
          key_scope,
          allow_preview_decryption,
          allow_worker_decryption,
          created_by,
          last_modified_by,
          created_at,
          last_modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
          slug = excluded.slug,
          display_name = excluded.display_name,
          description = excluded.description,
          status = excluded.status,
          owner_user_id = excluded.owner_user_id,
          visibility = excluded.visibility,
          encryption_mode = excluded.encryption_mode,
          content_encryption_required = excluded.content_encryption_required,
          key_scope = excluded.key_scope,
          allow_preview_decryption = excluded.allow_preview_decryption,
          allow_worker_decryption = excluded.allow_worker_decryption,
          created_by = excluded.created_by,
          last_modified_by = excluded.last_modified_by,
          created_at = excluded.created_at,
          last_modified_at = excluded.last_modified_at
        WHERE excluded.last_modified_at >= workspace_records.last_modified_at
      `).run(...mapWorkspaceToRowValues(workspace)));

    if (result.changes === 0) {
      const persisted = await this.findWorkspaceById(workspace.id);
      if (
        persisted &&
        persisted.ownership.lastModifiedAt > workspace.ownership.lastModifiedAt
      ) {
        throw new Error(
          `Workspace persistence conflict while saving workspace '${workspace.id}': a newer record already exists.`,
        );
      }
    }

    return workspace;
  }

  public async findMembershipById(membershipId: string): Promise<WorkspaceMembership | undefined> {
    const normalizedMembershipId = normalizeLookup(membershipId);
    if (!normalizedMembershipId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        membership_id,
        workspace_id,
        user_identity_id,
        status,
        invited_by_user_id,
        invitation_id,
        joined_at,
        suspended_at,
        removed_at,
        removed_by_user_id,
        created_at,
        updated_at,
        created_by,
        last_modified_by
      FROM workspace_memberships
      WHERE membership_id = ?
    `).get(normalizedMembershipId) as WorkspaceMembershipRow | undefined;

    return row ? mapWorkspaceMembershipRowToDomain(row) : undefined;
  }

  public async findMembershipByWorkspaceAndUser(
    workspaceId: string,
    userIdentityId: string,
  ): Promise<WorkspaceMembership | undefined> {
    const normalizedWorkspaceId = normalizeLookup(workspaceId);
    const normalizedUserIdentityId = normalizeLookup(userIdentityId);
    if (!normalizedWorkspaceId || !normalizedUserIdentityId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        membership_id,
        workspace_id,
        user_identity_id,
        status,
        invited_by_user_id,
        invitation_id,
        joined_at,
        suspended_at,
        removed_at,
        removed_by_user_id,
        created_at,
        updated_at,
        created_by,
        last_modified_by
      FROM workspace_memberships
      WHERE workspace_id = ?
        AND user_identity_id = ?
      LIMIT 1
    `).get(normalizedWorkspaceId, normalizedUserIdentityId) as WorkspaceMembershipRow | undefined;

    return row ? mapWorkspaceMembershipRowToDomain(row) : undefined;
  }

  public async listMemberships(query: WorkspaceMembershipListQuery): Promise<ReadonlyArray<WorkspaceMembership>> {
    const normalizedWorkspaceId = normalizeLookup(query.workspaceId);
    if (!normalizedWorkspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [normalizedWorkspaceId];

    const userIdentityId = normalizeLookup(query.userIdentityId ?? "");
    if (userIdentityId) {
      clauses.push("user_identity_id = ?");
      params.push(userIdentityId);
    }

    const invitationId = normalizeLookup(query.invitationId ?? "");
    if (invitationId) {
      clauses.push("invitation_id = ?");
      params.push(invitationId);
    }

    const invitedByUserId = normalizeLookup(query.invitedByUserId ?? "");
    if (invitedByUserId) {
      clauses.push("invited_by_user_id = ?");
      params.push(invitedByUserId);
    }

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        membership_id,
        workspace_id,
        user_identity_id,
        status,
        invited_by_user_id,
        invitation_id,
        joined_at,
        suspended_at,
        removed_at,
        removed_by_user_id,
        created_at,
        updated_at,
        created_by,
        last_modified_by
      FROM workspace_memberships
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC
      ${paging.sql}
    `).all(...params, ...paging.params) as WorkspaceMembershipRow[];

    return Object.freeze(rows.map((row) => mapWorkspaceMembershipRowToDomain(row)));
  }

  public async saveMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership> {
    const result = this.executeMutation("save workspace membership", () => this.getDatabase().prepare(`
        INSERT INTO workspace_memberships (
          membership_id,
          workspace_id,
          user_identity_id,
          status,
          invited_by_user_id,
          invitation_id,
          joined_at,
          suspended_at,
          removed_at,
          removed_by_user_id,
          created_at,
          updated_at,
          created_by,
          last_modified_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(membership_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          user_identity_id = excluded.user_identity_id,
          status = excluded.status,
          invited_by_user_id = excluded.invited_by_user_id,
          invitation_id = excluded.invitation_id,
          joined_at = excluded.joined_at,
          suspended_at = excluded.suspended_at,
          removed_at = excluded.removed_at,
          removed_by_user_id = excluded.removed_by_user_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          created_by = excluded.created_by,
          last_modified_by = excluded.last_modified_by
        WHERE excluded.updated_at >= workspace_memberships.updated_at
      `).run(...mapWorkspaceMembershipToRowValues(membership)));

    if (result.changes === 0) {
      const persisted = await this.findMembershipById(membership.id);
      if (persisted && persisted.updatedAt > membership.updatedAt) {
        throw new Error(
          `Workspace persistence conflict while saving membership '${membership.id}': a newer record already exists.`,
        );
      }
    }

    return membership;
  }

  public async findRoleAssignmentById(roleAssignmentId: string): Promise<WorkspaceRoleAssignment | undefined> {
    const normalizedRoleAssignmentId = normalizeLookup(roleAssignmentId);
    if (!normalizedRoleAssignmentId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        role_assignment_id,
        workspace_id,
        user_identity_id,
        role,
        status,
        assigned_at,
        assigned_by,
        revoked_at,
        revoked_by
      FROM workspace_role_assignments
      WHERE role_assignment_id = ?
    `).get(normalizedRoleAssignmentId) as WorkspaceRoleAssignmentRow | undefined;

    return row ? mapWorkspaceRoleAssignmentRowToDomain(row) : undefined;
  }

  public async listRoleAssignments(query: WorkspaceRoleAssignmentListQuery): Promise<ReadonlyArray<WorkspaceRoleAssignment>> {
    const normalizedWorkspaceId = normalizeLookup(query.workspaceId);
    if (!normalizedWorkspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [normalizedWorkspaceId];

    const userIdentityId = normalizeLookup(query.userIdentityId ?? "");
    if (userIdentityId) {
      clauses.push("user_identity_id = ?");
      params.push(userIdentityId);
    }

    if (query.roles && query.roles.length > 0) {
      clauses.push(`role IN (${query.roles.map(() => "?").join(", ")})`);
      params.push(...query.roles);
    }

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        role_assignment_id,
        workspace_id,
        user_identity_id,
        role,
        status,
        assigned_at,
        assigned_by,
        revoked_at,
        revoked_by
      FROM workspace_role_assignments
      WHERE ${clauses.join(" AND ")}
      ORDER BY assigned_at DESC
      ${paging.sql}
    `).all(...params, ...paging.params) as WorkspaceRoleAssignmentRow[];

    return Object.freeze(rows.map((row) => mapWorkspaceRoleAssignmentRowToDomain(row)));
  }

  public async countActiveRoleAssignments(workspaceId: string, role?: WorkspaceRole): Promise<number> {
    const normalizedWorkspaceId = normalizeLookup(workspaceId);
    if (!normalizedWorkspaceId) {
      return 0;
    }

    const clauses = ["workspace_id = ?", "status = 'active'"];
    const params: unknown[] = [normalizedWorkspaceId];

    if (role) {
      clauses.push("role = ?");
      params.push(role);
    }

    const row = this.getDatabase().prepare(`
      SELECT COUNT(*) AS total
      FROM workspace_role_assignments
      WHERE ${clauses.join(" AND ")}
    `).get(...params) as { total?: number } | undefined;

    return typeof row?.total === "number" ? row.total : 0;
  }

  public async saveRoleAssignment(roleAssignment: WorkspaceRoleAssignment): Promise<WorkspaceRoleAssignment> {
    const result = this.executeMutation("save workspace role assignment", () => this.getDatabase().prepare(`
        INSERT INTO workspace_role_assignments (
          role_assignment_id,
          workspace_id,
          user_identity_id,
          role,
          status,
          assigned_at,
          assigned_by,
          revoked_at,
          revoked_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(role_assignment_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          user_identity_id = excluded.user_identity_id,
          role = excluded.role,
          status = excluded.status,
          assigned_at = excluded.assigned_at,
          assigned_by = excluded.assigned_by,
          revoked_at = excluded.revoked_at,
          revoked_by = excluded.revoked_by
        WHERE COALESCE(excluded.revoked_at, excluded.assigned_at)
          >= COALESCE(workspace_role_assignments.revoked_at, workspace_role_assignments.assigned_at)
      `).run(...mapWorkspaceRoleAssignmentToRowValues(roleAssignment)));

    if (result.changes === 0) {
      const persisted = await this.findRoleAssignmentById(roleAssignment.id);
      if (
        persisted &&
        this.getRoleAssignmentMutationTimestamp(persisted)
          > this.getRoleAssignmentMutationTimestamp(roleAssignment)
      ) {
        throw new Error(
          `Workspace persistence conflict while saving role assignment '${roleAssignment.id}': a newer record already exists.`,
        );
      }
    }

    return roleAssignment;
  }

  public async findInvitationById(invitationId: string): Promise<WorkspaceInvitation | undefined> {
    const normalizedInvitationId = normalizeLookup(invitationId);
    if (!normalizedInvitationId) {
      return undefined;
    }

    const row = this.getDatabase().prepare(`
      SELECT
        invitation_id,
        workspace_id,
        invited_email,
        invited_by_user_id,
        invited_roles_json,
        invitation_token_hash,
        invitation_token_hint,
        target_user_identity_id_hint,
        onboarding_metadata_json,
        status,
        created_at,
        expires_at,
        responded_at,
        accepted_by_user_identity_id,
        last_modified_by,
        last_modified_at
      FROM workspace_invitations
      WHERE invitation_id = ?
    `).get(normalizedInvitationId) as WorkspaceInvitationRow | undefined;

    return row ? mapWorkspaceInvitationRowToDomain(row) : undefined;
  }

  public async findPendingInvitationByEmail(
    query: WorkspacePendingInvitationLookupQuery,
  ): Promise<WorkspaceInvitation | undefined> {
    const normalizedWorkspaceId = normalizeLookup(query.workspaceId);
    const normalizedEmail = normalizeEmailLookup(query.invitedEmail);
    if (!normalizedWorkspaceId || !normalizedEmail) {
      return undefined;
    }

    const asOf = normalizeLookup(query.asOf ?? "");
    const row = this.getDatabase().prepare(`
      SELECT
        invitation_id,
        workspace_id,
        invited_email,
        invited_by_user_id,
        invited_roles_json,
        invitation_token_hash,
        invitation_token_hint,
        target_user_identity_id_hint,
        onboarding_metadata_json,
        status,
        created_at,
        expires_at,
        responded_at,
        accepted_by_user_identity_id,
        last_modified_by,
        last_modified_at
      FROM workspace_invitations
      WHERE workspace_id = ?
        AND invited_email = ?
        AND status = 'pending'
        ${asOf ? "AND expires_at > ?" : ""}
      ORDER BY created_at DESC
      LIMIT 1
    `).get(...(asOf ? [normalizedWorkspaceId, normalizedEmail, asOf] : [normalizedWorkspaceId, normalizedEmail])) as WorkspaceInvitationRow | undefined;

    return row ? mapWorkspaceInvitationRowToDomain(row) : undefined;
  }

  public async findPendingInvitationByTokenHash(
    query: WorkspacePendingInvitationByTokenHashLookupQuery,
  ): Promise<WorkspaceInvitation | undefined> {
    const normalizedWorkspaceId = normalizeLookup(query.workspaceId);
    const normalizedTokenHash = normalizeLookup(query.invitationTokenHash)?.toLowerCase();
    if (!normalizedWorkspaceId || !normalizedTokenHash) {
      return undefined;
    }

    const asOf = normalizeLookup(query.asOf ?? "");
    const row = this.getDatabase().prepare(`
      SELECT
        invitation_id,
        workspace_id,
        invited_email,
        invited_by_user_id,
        invited_roles_json,
        invitation_token_hash,
        invitation_token_hint,
        target_user_identity_id_hint,
        onboarding_metadata_json,
        status,
        created_at,
        expires_at,
        responded_at,
        accepted_by_user_identity_id,
        last_modified_by,
        last_modified_at
      FROM workspace_invitations
      WHERE workspace_id = ?
        AND invitation_token_hash = ?
        AND status = 'pending'
        ${asOf ? "AND expires_at > ?" : ""}
      ORDER BY created_at DESC
      LIMIT 1
    `).get(...(asOf ? [normalizedWorkspaceId, normalizedTokenHash, asOf] : [normalizedWorkspaceId, normalizedTokenHash])) as WorkspaceInvitationRow | undefined;

    return row ? mapWorkspaceInvitationRowToDomain(row) : undefined;
  }

  public async listInvitations(query: WorkspaceInvitationListQuery): Promise<ReadonlyArray<WorkspaceInvitation>> {
    const normalizedWorkspaceId = normalizeLookup(query.workspaceId);
    if (!normalizedWorkspaceId) {
      return Object.freeze([]);
    }

    const clauses: string[] = ["workspace_id = ?"];
    const params: unknown[] = [normalizedWorkspaceId];

    const invitedEmail = query.invitedEmail ? normalizeEmailLookup(query.invitedEmail) : undefined;
    if (invitedEmail) {
      clauses.push("invited_email = ?");
      params.push(invitedEmail);
    }

    const invitedByUserId = normalizeLookup(query.invitedByUserId ?? "");
    if (invitedByUserId) {
      clauses.push("invited_by_user_id = ?");
      params.push(invitedByUserId);
    }

    if (query.statuses && query.statuses.length > 0) {
      clauses.push(`status IN (${query.statuses.map(() => "?").join(", ")})`);
      params.push(...query.statuses);
    }

    if (query.activeOnly) {
      clauses.push("status = 'pending'");
    }

    if (query.expiresBefore) {
      clauses.push("expires_at < ?");
      params.push(query.expiresBefore);
    }

    if (query.expiresAfter) {
      clauses.push("expires_at > ?");
      params.push(query.expiresAfter);
    }

    const paging = this.buildPagingClause(query.limit, query.offset);

    const rows = this.getDatabase().prepare(`
      SELECT
        invitation_id,
        workspace_id,
        invited_email,
        invited_by_user_id,
        invited_roles_json,
        invitation_token_hash,
        invitation_token_hint,
        target_user_identity_id_hint,
        onboarding_metadata_json,
        status,
        created_at,
        expires_at,
        responded_at,
        accepted_by_user_identity_id,
        last_modified_by,
        last_modified_at
      FROM workspace_invitations
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC
      ${paging.sql}
    `).all(...params, ...paging.params) as WorkspaceInvitationRow[];

    return Object.freeze(rows.map((row) => mapWorkspaceInvitationRowToDomain(row)));
  }

  public async saveInvitation(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation> {
    const result = this.executeMutation("save workspace invitation", () => this.getDatabase().prepare(`
        INSERT INTO workspace_invitations (
          invitation_id,
          workspace_id,
          invited_email,
          invited_by_user_id,
          invited_roles_json,
          invitation_token_hash,
          invitation_token_hint,
          target_user_identity_id_hint,
          onboarding_metadata_json,
          status,
          created_at,
          expires_at,
          responded_at,
          accepted_by_user_identity_id,
          last_modified_by,
          last_modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(invitation_id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          invited_email = excluded.invited_email,
          invited_by_user_id = excluded.invited_by_user_id,
          invited_roles_json = excluded.invited_roles_json,
          invitation_token_hash = excluded.invitation_token_hash,
          invitation_token_hint = excluded.invitation_token_hint,
          target_user_identity_id_hint = excluded.target_user_identity_id_hint,
          onboarding_metadata_json = excluded.onboarding_metadata_json,
          status = excluded.status,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at,
          responded_at = excluded.responded_at,
          accepted_by_user_identity_id = excluded.accepted_by_user_identity_id,
          last_modified_by = excluded.last_modified_by,
          last_modified_at = excluded.last_modified_at
        WHERE excluded.last_modified_at >= workspace_invitations.last_modified_at
      `).run(...mapWorkspaceInvitationToRowValues(invitation)));

    if (result.changes === 0) {
      const persisted = await this.findInvitationById(invitation.id);
      if (persisted && persisted.lastModifiedAt > invitation.lastModifiedAt) {
        throw new Error(
          `Workspace persistence conflict while saving invitation '${invitation.id}': a newer record already exists.`,
        );
      }
    }

    return invitation;
  }

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = await this.findWorkspaceById(query.workspaceId);
    if (!workspace) {
      return undefined;
    }

    const membership = await this.findMembershipByWorkspaceAndUser(query.workspaceId, query.userIdentityId);
    const activeRoleAssignments = await this.listRoleAssignments({
      workspaceId: query.workspaceId,
      userIdentityId: query.userIdentityId,
      statuses: [WorkspaceRoleAssignmentStatuses.active],
    });
    const effectiveRoles = Object.freeze([
      ...new Set(activeRoleAssignments.map((assignment) => assignment.role)),
    ]);

    return Object.freeze({
      workspace,
      membership,
      activeRoleAssignments,
      effectiveRoles,
      isWorkspaceOwner: effectiveRoles.includes(WorkspaceRoles.owner),
    });
  }

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    return this.transactionCoordinator.runInTransaction(operation);
  }

  public dispose(): void {
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
    if (currentVersion > WORKSPACE_PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(
        `Workspace schema version ${currentVersion} is newer than supported version ${WORKSPACE_PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    for (const [version, sql] of WORKSPACE_PERSISTENCE_MIGRATIONS) {
      if (version <= currentVersion) {
        continue;
      }

      database.transaction(() => {
        database.exec(sql);
        database.prepare(
          "INSERT INTO workspace_repository_migrations (version, applied_at) VALUES (?, ?)",
        ).run(version, new Date().toISOString());
      })();
    }
  }

  private getSchemaVersion(database: SqliteCompatDatabase): number {
    database.exec(`
      CREATE TABLE IF NOT EXISTS workspace_repository_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const row = database.prepare("SELECT MAX(version) AS version FROM workspace_repository_migrations")
      .get() as { version?: number } | undefined;

    return typeof row?.version === "number" ? row.version : 0;
  }

  private getRoleAssignmentMutationTimestamp(roleAssignment: WorkspaceRoleAssignment): string {
    return roleAssignment.revokedAt ?? roleAssignment.assignedAt;
  }
}

