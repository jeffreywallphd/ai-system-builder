import type {
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceMembership,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceRoleAssignment,
  WorkspaceRoleAssignmentStatus,
  WorkspaceStatus,
} from "@domain/workspaces/WorkspaceDomain";
import {
  type WorkspaceEncryptionPolicy,
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
} from "@domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";

export const WorkspaceAdministrationQueryErrorCodes = Object.freeze({
  invalidRequest: "workspace-query-invalid-request",
  forbidden: "workspace-query-forbidden",
  notFound: "workspace-query-not-found",
});

export type WorkspaceAdministrationQueryErrorCode =
  typeof WorkspaceAdministrationQueryErrorCodes[keyof typeof WorkspaceAdministrationQueryErrorCodes];

export interface WorkspaceAdministrationQueryError {
  readonly code: WorkspaceAdministrationQueryErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceAdministrationPaginationRequest {
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspaceAdministrationPagination {
  readonly limit: number;
  readonly offset: number;
  readonly returned: number;
  readonly hasMore: boolean;
}

export interface WorkspaceMembershipStatusSummary {
  readonly pending: number;
  readonly active: number;
  readonly suspended: number;
  readonly removed: number;
  readonly total: number;
}

export interface WorkspaceRoleSummary {
  readonly owner: number;
  readonly admin: number;
  readonly member: number;
  readonly viewer: number;
  readonly activeAssignments: number;
  readonly revokedAssignments: number;
  readonly totalAssignments: number;
}

export interface WorkspaceInvitationStatusSummary {
  readonly pending: number;
  readonly accepted: number;
  readonly declined: number;
  readonly revoked: number;
  readonly expired: number;
  readonly activePending: number;
  readonly total: number;
}

export interface WorkspaceAdministrativeActorAccessSummary {
  readonly membershipStatus?: WorkspaceMembershipStatus;
  readonly effectiveRoles: ReadonlyArray<WorkspaceRole>;
  readonly canAdministrate: boolean;
  readonly isWorkspaceOwner: boolean;
}

export interface WorkspaceListItemDto {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly status: WorkspaceStatus;
  readonly encryptionPolicy: WorkspaceEncryptionPolicy;
  readonly ownerUserIdentityId: string;
  readonly visibility: WorkspaceVisibility;
  readonly createdAt: string;
  readonly lastModifiedAt: string;
  readonly membershipSummary: WorkspaceMembershipStatusSummary;
  readonly roleSummary: WorkspaceRoleSummary;
  readonly invitationSummary: WorkspaceInvitationStatusSummary;
  readonly actorAccess: WorkspaceAdministrativeActorAccessSummary;
}

export interface ListWorkspaceAdministrationWorkspacesInput
  extends WorkspaceAdministrationPaginationRequest {
  readonly actorUserIdentityId: string;
  readonly ownerUserIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceStatus>;
  readonly visibility?: WorkspaceVisibility;
  readonly slugPrefix?: string;
}

export interface ListWorkspaceAdministrationWorkspacesResult {
  readonly workspaces: ReadonlyArray<WorkspaceListItemDto>;
  readonly pagination: WorkspaceAdministrationPagination;
}

export interface WorkspaceMembershipItemDto {
  readonly membershipId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
  readonly invitedByUserId?: string;
  readonly invitationId?: string;
  readonly joinedAt?: string;
  readonly suspendedAt?: string;
  readonly removedAt?: string;
  readonly removedByUserId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly activeRoles: ReadonlyArray<WorkspaceRole>;
  readonly hasAdministrativeRole: boolean;
  readonly isWorkspaceOwner: boolean;
}

export interface ListWorkspaceMembershipsForAdministrationInput
  extends WorkspaceAdministrationPaginationRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly userIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceMembershipStatus>;
  readonly invitationId?: string;
  readonly invitedByUserId?: string;
}

export interface ListWorkspaceMembershipsForAdministrationResult {
  readonly memberships: ReadonlyArray<WorkspaceMembershipItemDto>;
  readonly pagination: WorkspaceAdministrationPagination;
  readonly workspaceMembershipSummary: WorkspaceMembershipStatusSummary;
  readonly workspaceRoleSummary: WorkspaceRoleSummary;
}

export interface WorkspaceInvitationItemDto {
  readonly invitationId: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserId: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly status: WorkspaceInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly acceptedByUserIdentityId?: string;
  readonly isActive: boolean;
  readonly isExpiredAsOfQuery: boolean;
}

export interface ListWorkspaceInvitationsForAdministrationInput
  extends WorkspaceAdministrationPaginationRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly invitedEmail?: string;
  readonly invitedByUserId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceInvitationStatus>;
  readonly activeOnly?: boolean;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly asOf?: string;
}

export interface ListWorkspaceInvitationsForAdministrationResult {
  readonly invitations: ReadonlyArray<WorkspaceInvitationItemDto>;
  readonly pagination: WorkspaceAdministrationPagination;
  readonly workspaceInvitationSummary: WorkspaceInvitationStatusSummary;
}

export interface WorkspaceRoleAssignmentItemDto {
  readonly roleAssignmentId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentStatus;
  readonly assignedAt: string;
  readonly assignedBy: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
  readonly isAdministrativeRole: boolean;
}

export interface ListWorkspaceRoleAssignmentsForAdministrationInput
  extends WorkspaceAdministrationPaginationRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly userIdentityId?: string;
  readonly roles?: ReadonlyArray<WorkspaceRole>;
  readonly statuses?: ReadonlyArray<WorkspaceRoleAssignmentStatus>;
}

export interface ListWorkspaceRoleAssignmentsForAdministrationResult {
  readonly roleAssignments: ReadonlyArray<WorkspaceRoleAssignmentItemDto>;
  readonly pagination: WorkspaceAdministrationPagination;
  readonly workspaceRoleSummary: WorkspaceRoleSummary;
}

export type WorkspaceAdministrationQueryOutcome<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceAdministrationQueryError;
  };

export interface WorkspaceAdministrationQueryClock {
  now(): Date;
}

interface WorkspaceAdministrationQueryServiceDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly invitationRepository: IWorkspaceInvitationRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: WorkspaceAdministrationQueryClock;
}

interface NormalizedPaging {
  readonly limit: number;
  readonly offset: number;
  readonly fetchLimit: number;
}

export class WorkspaceAdministrationQueryService {
  private readonly clock: WorkspaceAdministrationQueryClock;

  public constructor(private readonly dependencies: WorkspaceAdministrationQueryServiceDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async listWorkspaces(
    input: ListWorkspaceAdministrationWorkspacesInput,
  ): Promise<WorkspaceAdministrationQueryOutcome<ListWorkspaceAdministrationWorkspacesResult>> {
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceAdministrationQueryErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const paging = normalizePaging(input.limit, input.offset);
    const workspacesWindow = await this.dependencies.workspaceRepository.listWorkspaces({
      ownerUserId: normalizeOptional(input.ownerUserIdentityId),
      memberUserIdentityId: actorUserIdentityId,
      statuses: input.statuses,
      visibility: input.visibility,
      slugPrefix: normalizeOptional(input.slugPrefix),
      limit: paging.fetchLimit,
      offset: paging.offset,
    });

    const page = this.pageWindow(workspacesWindow, paging);
    const workspaceDtos = await Promise.all(page.values.map(async (workspace) => this.toWorkspaceListItem(workspace, actorUserIdentityId)));

    return {
      ok: true,
      value: Object.freeze({
        workspaces: Object.freeze(workspaceDtos),
        pagination: this.toPagination(paging, page.values.length, page.hasMore),
      }),
    };
  }

  public async listWorkspaceMemberships(
    input: ListWorkspaceMembershipsForAdministrationInput,
  ): Promise<WorkspaceAdministrationQueryOutcome<ListWorkspaceMembershipsForAdministrationResult>> {
    const workspaceId = normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceAdministrationQueryErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(WorkspaceAdministrationQueryErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const authorization = await this.assertActorCanAdministrateWorkspace(workspaceId, actorUserIdentityId);
    if (!authorization.ok) {
      return authorization;
    }

    const paging = normalizePaging(input.limit, input.offset);
    const membershipsWindow = await this.dependencies.membershipRepository.listMemberships({
      workspaceId,
      userIdentityId: normalizeOptional(input.userIdentityId),
      statuses: input.statuses,
      invitationId: normalizeOptional(input.invitationId),
      invitedByUserId: normalizeOptional(input.invitedByUserId),
      limit: paging.fetchLimit,
      offset: paging.offset,
    });
    const page = this.pageWindow(membershipsWindow, paging);

    const allWorkspaceRoleAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId,
    });
    const activeRolesByUser = mapActiveRolesByUser(
      allWorkspaceRoleAssignments.filter((roleAssignment) => (
        roleAssignment.status === WorkspaceRoleAssignmentStatuses.active
      )),
    );

    const memberships = page.values.map((membership) => {
      const activeRoles = Object.freeze(activeRolesByUser.get(membership.userIdentityId) ?? []);
      return Object.freeze({
        membershipId: membership.id,
        workspaceId: membership.workspaceId,
        userIdentityId: membership.userIdentityId,
        status: membership.status,
        invitedByUserId: membership.invitedByUserId,
        invitationId: membership.invitationId,
        joinedAt: membership.joinedAt,
        suspendedAt: membership.suspendedAt,
        removedAt: membership.removedAt,
        removedByUserId: membership.removedByUserId,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
        createdBy: membership.createdBy,
        lastModifiedBy: membership.lastModifiedBy,
        activeRoles,
        hasAdministrativeRole: hasAdministrativeRole(activeRoles),
        isWorkspaceOwner: activeRoles.includes(WorkspaceRoles.owner),
      } satisfies WorkspaceMembershipItemDto);
    });

    const allWorkspaceMemberships = await this.dependencies.membershipRepository.listMemberships({ workspaceId });

    return {
      ok: true,
      value: Object.freeze({
        memberships: Object.freeze(memberships),
        pagination: this.toPagination(paging, memberships.length, page.hasMore),
        workspaceMembershipSummary: summarizeMemberships(allWorkspaceMemberships),
        workspaceRoleSummary: summarizeRoleAssignments(allWorkspaceRoleAssignments),
      }),
    };
  }

  public async listWorkspaceInvitations(
    input: ListWorkspaceInvitationsForAdministrationInput,
  ): Promise<WorkspaceAdministrationQueryOutcome<ListWorkspaceInvitationsForAdministrationResult>> {
    const workspaceId = normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceAdministrationQueryErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(WorkspaceAdministrationQueryErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const authorization = await this.assertActorCanAdministrateWorkspace(workspaceId, actorUserIdentityId);
    if (!authorization.ok) {
      return authorization;
    }

    const asOfIso = normalizeOptional(input.asOf) ?? this.clock.now().toISOString();
    const asOfTime = new Date(asOfIso).getTime();
    if (Number.isNaN(asOfTime)) {
      return this.failure(
        WorkspaceAdministrationQueryErrorCodes.invalidRequest,
        "asOf must be a valid ISO timestamp when provided.",
      );
    }

    const paging = normalizePaging(input.limit, input.offset);
    const invitationWindow = await this.dependencies.invitationRepository.listInvitations({
      workspaceId,
      invitedEmail: normalizeOptional(input.invitedEmail),
      invitedByUserId: normalizeOptional(input.invitedByUserId),
      statuses: input.statuses,
      activeOnly: input.activeOnly,
      expiresBefore: normalizeOptional(input.expiresBefore),
      expiresAfter: normalizeOptional(input.expiresAfter),
      limit: paging.fetchLimit,
      offset: paging.offset,
    });
    const page = this.pageWindow(invitationWindow, paging);

    const invitations = page.values.map((invitation) => {
      const expiresAtTime = new Date(invitation.expiresAt).getTime();
      const isExpiredAsOfQuery = !Number.isNaN(expiresAtTime) && expiresAtTime <= asOfTime;
      const isActive = invitation.status === WorkspaceInvitationStatuses.pending && !isExpiredAsOfQuery;

      return Object.freeze({
        invitationId: invitation.id,
        workspaceId: invitation.workspaceId,
        invitedEmail: invitation.invitedEmail,
        invitedByUserId: invitation.invitedByUserId,
        invitedRoles: invitation.invitedRoles,
        status: invitation.status,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        respondedAt: invitation.respondedAt,
        acceptedByUserIdentityId: invitation.acceptedByUserIdentityId,
        isActive,
        isExpiredAsOfQuery,
      } satisfies WorkspaceInvitationItemDto);
    });

    const allWorkspaceInvitations = await this.dependencies.invitationRepository.listInvitations({
      workspaceId,
    });

    return {
      ok: true,
      value: Object.freeze({
        invitations: Object.freeze(invitations),
        pagination: this.toPagination(paging, invitations.length, page.hasMore),
        workspaceInvitationSummary: summarizeInvitations(allWorkspaceInvitations, asOfIso),
      }),
    };
  }

  public async listWorkspaceRoleAssignments(
    input: ListWorkspaceRoleAssignmentsForAdministrationInput,
  ): Promise<WorkspaceAdministrationQueryOutcome<ListWorkspaceRoleAssignmentsForAdministrationResult>> {
    const workspaceId = normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceAdministrationQueryErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(WorkspaceAdministrationQueryErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const authorization = await this.assertActorCanAdministrateWorkspace(workspaceId, actorUserIdentityId);
    if (!authorization.ok) {
      return authorization;
    }

    const paging = normalizePaging(input.limit, input.offset);
    const roleAssignmentWindow = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId,
      userIdentityId: normalizeOptional(input.userIdentityId),
      roles: input.roles,
      statuses: input.statuses,
      limit: paging.fetchLimit,
      offset: paging.offset,
    });
    const page = this.pageWindow(roleAssignmentWindow, paging);

    const roleAssignments = page.values.map((roleAssignment) => Object.freeze({
      roleAssignmentId: roleAssignment.id,
      workspaceId: roleAssignment.workspaceId,
      userIdentityId: roleAssignment.userIdentityId,
      role: roleAssignment.role,
      status: roleAssignment.status,
      assignedAt: roleAssignment.assignedAt,
      assignedBy: roleAssignment.assignedBy,
      revokedAt: roleAssignment.revokedAt,
      revokedBy: roleAssignment.revokedBy,
      isAdministrativeRole: isAdministrativeRole(roleAssignment.role),
    } satisfies WorkspaceRoleAssignmentItemDto));

    const allWorkspaceRoleAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId,
    });

    return {
      ok: true,
      value: Object.freeze({
        roleAssignments: Object.freeze(roleAssignments),
        pagination: this.toPagination(paging, roleAssignments.length, page.hasMore),
        workspaceRoleSummary: summarizeRoleAssignments(allWorkspaceRoleAssignments),
      }),
    };
  }

  private async toWorkspaceListItem(
    workspace: Workspace,
    actorUserIdentityId: string,
  ): Promise<WorkspaceListItemDto> {
    const [memberships, roleAssignments, invitations, actorMembership, actorRoleAssignments] = await Promise.all([
      this.dependencies.membershipRepository.listMemberships({
        workspaceId: workspace.id,
      }),
      this.dependencies.roleAssignmentRepository.listRoleAssignments({
        workspaceId: workspace.id,
      }),
      this.dependencies.invitationRepository.listInvitations({
        workspaceId: workspace.id,
      }),
      this.dependencies.membershipRepository.findMembershipByWorkspaceAndUser(
        workspace.id,
        actorUserIdentityId,
      ),
      this.dependencies.roleAssignmentRepository.listRoleAssignments({
        workspaceId: workspace.id,
        userIdentityId: actorUserIdentityId,
        statuses: [WorkspaceRoleAssignmentStatuses.active],
      }),
    ]);

    const actorEffectiveRoles = Object.freeze([
      ...new Set(actorRoleAssignments.map((assignment) => assignment.role)),
    ]);

    return Object.freeze({
      id: workspace.id,
      slug: workspace.slug,
      displayName: workspace.displayName,
      description: workspace.description,
      status: workspace.status,
      encryptionPolicy: workspace.encryptionPolicy,
      ownerUserIdentityId: workspace.ownership.ownerUserId,
      visibility: workspace.ownership.visibility,
      createdAt: workspace.ownership.createdAt,
      lastModifiedAt: workspace.ownership.lastModifiedAt,
      membershipSummary: summarizeMemberships(memberships),
      roleSummary: summarizeRoleAssignments(roleAssignments),
      invitationSummary: summarizeInvitations(invitations, this.clock.now().toISOString()),
      actorAccess: Object.freeze({
        membershipStatus: actorMembership?.status,
        effectiveRoles: actorEffectiveRoles,
        canAdministrate: hasAdministrativeRole(actorEffectiveRoles),
        isWorkspaceOwner: actorEffectiveRoles.includes(WorkspaceRoles.owner),
      }),
    });
  }

  private async assertActorCanAdministrateWorkspace(
    workspaceId: string,
    actorUserIdentityId: string,
  ): Promise<WorkspaceAdministrationQueryOutcome<undefined>> {
    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: this.clock.now().toISOString(),
    });

    if (!snapshot) {
      return this.failure(
        WorkspaceAdministrationQueryErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceAdministrationQueryErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    if (!hasAdministrativeRole(snapshot.effectiveRoles)) {
      return this.failure(
        WorkspaceAdministrationQueryErrorCodes.forbidden,
        "Actor must have owner or admin role to access workspace administration read models.",
      );
    }

    return { ok: true, value: undefined };
  }

  private pageWindow<TValue>(
    values: ReadonlyArray<TValue>,
    paging: NormalizedPaging,
  ): { readonly values: ReadonlyArray<TValue>; readonly hasMore: boolean } {
    if (values.length <= paging.limit) {
      return {
        values,
        hasMore: false,
      };
    }

    return {
      values: values.slice(0, paging.limit),
      hasMore: true,
    };
  }

  private toPagination(
    paging: NormalizedPaging,
    returned: number,
    hasMore: boolean,
  ): WorkspaceAdministrationPagination {
    return Object.freeze({
      limit: paging.limit,
      offset: paging.offset,
      returned,
      hasMore,
    });
  }

  private failure(
    code: WorkspaceAdministrationQueryErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): WorkspaceAdministrationQueryOutcome<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePaging(limit?: number, offset?: number): NormalizedPaging {
  const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0
    ? Math.min(limit as number, 100)
    : 25;
  const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0
    ? (offset as number)
    : 0;

  return {
    limit: normalizedLimit,
    offset: normalizedOffset,
    fetchLimit: normalizedLimit + 1,
  };
}

function mapActiveRolesByUser(
  activeRoleAssignments: ReadonlyArray<WorkspaceRoleAssignment>,
): ReadonlyMap<string, ReadonlyArray<WorkspaceRole>> {
  const map = new Map<string, WorkspaceRole[]>();
  for (const assignment of activeRoleAssignments) {
    const existing = map.get(assignment.userIdentityId);
    if (existing) {
      if (!existing.includes(assignment.role)) {
        existing.push(assignment.role);
      }
      continue;
    }
    map.set(assignment.userIdentityId, [assignment.role]);
  }

  const frozen = new Map<string, ReadonlyArray<WorkspaceRole>>();
  for (const [userIdentityId, roles] of map.entries()) {
    frozen.set(userIdentityId, Object.freeze([...roles]));
  }
  return frozen;
}

function summarizeMemberships(
  memberships: ReadonlyArray<WorkspaceMembership>,
): WorkspaceMembershipStatusSummary {
  let pending = 0;
  let active = 0;
  let suspended = 0;
  let removed = 0;

  for (const membership of memberships) {
    if (membership.status === WorkspaceMembershipStatuses.pending) {
      pending += 1;
      continue;
    }
    if (membership.status === WorkspaceMembershipStatuses.active) {
      active += 1;
      continue;
    }
    if (membership.status === WorkspaceMembershipStatuses.suspended) {
      suspended += 1;
      continue;
    }
    removed += 1;
  }

  return Object.freeze({
    pending,
    active,
    suspended,
    removed,
    total: memberships.length,
  });
}

function summarizeRoleAssignments(
  roleAssignments: ReadonlyArray<WorkspaceRoleAssignment>,
): WorkspaceRoleSummary {
  let owner = 0;
  let admin = 0;
  let member = 0;
  let viewer = 0;
  let activeAssignments = 0;
  let revokedAssignments = 0;

  for (const roleAssignment of roleAssignments) {
    if (roleAssignment.role === WorkspaceRoles.owner) {
      owner += 1;
    } else if (roleAssignment.role === WorkspaceRoles.admin) {
      admin += 1;
    } else if (roleAssignment.role === WorkspaceRoles.member) {
      member += 1;
    } else {
      viewer += 1;
    }

    if (roleAssignment.status === WorkspaceRoleAssignmentStatuses.active) {
      activeAssignments += 1;
    } else {
      revokedAssignments += 1;
    }
  }

  return Object.freeze({
    owner,
    admin,
    member,
    viewer,
    activeAssignments,
    revokedAssignments,
    totalAssignments: roleAssignments.length,
  });
}

function summarizeInvitations(
  invitations: ReadonlyArray<WorkspaceInvitation>,
  asOf: string,
): WorkspaceInvitationStatusSummary {
  const asOfTime = new Date(asOf).getTime();

  let pending = 0;
  let accepted = 0;
  let declined = 0;
  let revoked = 0;
  let expired = 0;
  let activePending = 0;

  for (const invitation of invitations) {
    if (invitation.status === WorkspaceInvitationStatuses.pending) {
      pending += 1;
      const expiresAtTime = new Date(invitation.expiresAt).getTime();
      if (!Number.isNaN(asOfTime) && !Number.isNaN(expiresAtTime) && expiresAtTime > asOfTime) {
        activePending += 1;
      }
      continue;
    }

    if (invitation.status === WorkspaceInvitationStatuses.accepted) {
      accepted += 1;
      continue;
    }

    if (invitation.status === WorkspaceInvitationStatuses.declined) {
      declined += 1;
      continue;
    }

    if (invitation.status === WorkspaceInvitationStatuses.revoked) {
      revoked += 1;
      continue;
    }

    expired += 1;
  }

  return Object.freeze({
    pending,
    accepted,
    declined,
    revoked,
    expired,
    activePending,
    total: invitations.length,
  });
}

function isAdministrativeRole(role: WorkspaceRole): boolean {
  return role === WorkspaceRoles.owner || role === WorkspaceRoles.admin;
}

function hasAdministrativeRole(roles: ReadonlyArray<WorkspaceRole>): boolean {
  return roles.includes(WorkspaceRoles.owner) || roles.includes(WorkspaceRoles.admin);
}

