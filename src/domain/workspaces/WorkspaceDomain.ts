import {
  WorkspaceOwnershipError,
  WorkspaceVisibilities,
  createWorkspaceOwnershipMetadata,
  touchWorkspaceOwnershipMetadata,
  withWorkspaceOwner,
  withWorkspaceOwnershipVisibility,
  type WorkspaceOwnershipMetadata,
  type WorkspaceVisibility,
} from "../../shared/workspaces/WorkspaceOwnership";

export class WorkspaceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceDomainError";
  }
}

export class WorkspaceLifecycleTransitionError extends WorkspaceDomainError {
  constructor(fromStatus: WorkspaceStatus, toStatus: WorkspaceStatus) {
    super(`Workspace lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "WorkspaceLifecycleTransitionError";
  }
}

export class WorkspaceMembershipLifecycleTransitionError extends WorkspaceDomainError {
  constructor(fromStatus: WorkspaceMembershipStatus, toStatus: WorkspaceMembershipStatus) {
    super(`Workspace membership lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "WorkspaceMembershipLifecycleTransitionError";
  }
}

export class WorkspaceInvitationLifecycleTransitionError extends WorkspaceDomainError {
  constructor(fromStatus: WorkspaceInvitationStatus, toStatus: WorkspaceInvitationStatus) {
    super(`Workspace invitation lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "WorkspaceInvitationLifecycleTransitionError";
  }
}

export const WorkspaceStatuses = Object.freeze({
  provisioning: "provisioning",
  active: "active",
  suspended: "suspended",
  archived: "archived",
});

export type WorkspaceStatus = typeof WorkspaceStatuses[keyof typeof WorkspaceStatuses];

export const WorkspaceMembershipStatuses = Object.freeze({
  pending: "pending",
  active: "active",
  suspended: "suspended",
  removed: "removed",
});

export type WorkspaceMembershipStatus =
  typeof WorkspaceMembershipStatuses[keyof typeof WorkspaceMembershipStatuses];

export const WorkspaceRoles = Object.freeze({
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
});

export type WorkspaceRole = typeof WorkspaceRoles[keyof typeof WorkspaceRoles];

export const WorkspaceRoleAssignmentStatuses = Object.freeze({
  active: "active",
  revoked: "revoked",
});

export type WorkspaceRoleAssignmentStatus =
  typeof WorkspaceRoleAssignmentStatuses[keyof typeof WorkspaceRoleAssignmentStatuses];

export const WorkspaceInvitationStatuses = Object.freeze({
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  revoked: "revoked",
  expired: "expired",
});

export type WorkspaceInvitationStatus =
  typeof WorkspaceInvitationStatuses[keyof typeof WorkspaceInvitationStatuses];

export interface Workspace {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly status: WorkspaceStatus;
  readonly ownership: WorkspaceOwnershipMetadata;
}

export interface WorkspaceMembership {
  readonly id: string;
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
}

export interface WorkspaceRoleAssignment {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentStatus;
  readonly assignedAt: string;
  readonly assignedBy: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
}

export interface WorkspaceInvitation {
  readonly id: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserId: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly status: WorkspaceInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly acceptedByUserIdentityId?: string;
  readonly lastModifiedBy: string;
  readonly lastModifiedAt: string;
}

export const WorkspaceLifecycleTransitions: Readonly<Record<WorkspaceStatus, ReadonlyArray<WorkspaceStatus>>> = Object.freeze({
  [WorkspaceStatuses.provisioning]: Object.freeze([WorkspaceStatuses.active, WorkspaceStatuses.archived]),
  [WorkspaceStatuses.active]: Object.freeze([WorkspaceStatuses.suspended, WorkspaceStatuses.archived]),
  [WorkspaceStatuses.suspended]: Object.freeze([WorkspaceStatuses.active, WorkspaceStatuses.archived]),
  [WorkspaceStatuses.archived]: Object.freeze([WorkspaceStatuses.active]),
});

export const WorkspaceMembershipLifecycleTransitions: Readonly<
  Record<WorkspaceMembershipStatus, ReadonlyArray<WorkspaceMembershipStatus>>
> = Object.freeze({
  [WorkspaceMembershipStatuses.pending]: Object.freeze([
    WorkspaceMembershipStatuses.active,
    WorkspaceMembershipStatuses.removed,
  ]),
  [WorkspaceMembershipStatuses.active]: Object.freeze([
    WorkspaceMembershipStatuses.suspended,
    WorkspaceMembershipStatuses.removed,
  ]),
  [WorkspaceMembershipStatuses.suspended]: Object.freeze([
    WorkspaceMembershipStatuses.active,
    WorkspaceMembershipStatuses.removed,
  ]),
  [WorkspaceMembershipStatuses.removed]: Object.freeze([]),
});

export const WorkspaceInvitationLifecycleTransitions: Readonly<
  Record<WorkspaceInvitationStatus, ReadonlyArray<WorkspaceInvitationStatus>>
> = Object.freeze({
  [WorkspaceInvitationStatuses.pending]: Object.freeze([
    WorkspaceInvitationStatuses.accepted,
    WorkspaceInvitationStatuses.declined,
    WorkspaceInvitationStatuses.revoked,
    WorkspaceInvitationStatuses.expired,
  ]),
  [WorkspaceInvitationStatuses.accepted]: Object.freeze([]),
  [WorkspaceInvitationStatuses.declined]: Object.freeze([]),
  [WorkspaceInvitationStatuses.revoked]: Object.freeze([]),
  [WorkspaceInvitationStatuses.expired]: Object.freeze([]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new WorkspaceDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorkspaceDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeWorkspaceStatus(value?: WorkspaceStatus): WorkspaceStatus {
  const status = value ?? WorkspaceStatuses.provisioning;
  if (!Object.values(WorkspaceStatuses).includes(status)) {
    throw new WorkspaceDomainError(`Workspace status '${String(value)}' is invalid.`);
  }
  return status;
}

function normalizeMembershipStatus(value?: WorkspaceMembershipStatus): WorkspaceMembershipStatus {
  const status = value ?? WorkspaceMembershipStatuses.pending;
  if (!Object.values(WorkspaceMembershipStatuses).includes(status)) {
    throw new WorkspaceDomainError(`Workspace membership status '${String(value)}' is invalid.`);
  }
  return status;
}

function normalizeRole(value: WorkspaceRole): WorkspaceRole {
  if (!Object.values(WorkspaceRoles).includes(value)) {
    throw new WorkspaceDomainError(`Workspace role '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeRoleAssignmentStatus(value?: WorkspaceRoleAssignmentStatus): WorkspaceRoleAssignmentStatus {
  const status = value ?? WorkspaceRoleAssignmentStatuses.active;
  if (!Object.values(WorkspaceRoleAssignmentStatuses).includes(status)) {
    throw new WorkspaceDomainError(`Workspace role assignment status '${String(value)}' is invalid.`);
  }
  return status;
}

function normalizeInvitationStatus(value?: WorkspaceInvitationStatus): WorkspaceInvitationStatus {
  const status = value ?? WorkspaceInvitationStatuses.pending;
  if (!Object.values(WorkspaceInvitationStatuses).includes(status)) {
    throw new WorkspaceDomainError(`Workspace invitation status '${String(value)}' is invalid.`);
  }
  return status;
}

function normalizeSlug(value: string): string {
  const normalized = normalizeRequired(value, "Workspace slug").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new WorkspaceDomainError("Workspace slug must be lowercase alphanumeric with optional '-' separators.");
  }
  return normalized;
}

function normalizeWorkspaceName(value: string): string {
  const normalized = normalizeRequired(value, "Workspace displayName");
  if (normalized.length > 120) {
    throw new WorkspaceDomainError("Workspace displayName must be 120 characters or fewer.");
  }
  return normalized;
}

function normalizeWorkspaceDescription(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  if (normalized && normalized.length > 1_000) {
    throw new WorkspaceDomainError("Workspace description must be 1000 characters or fewer.");
  }
  return normalized;
}

function normalizeInvitationEmail(email: string): string {
  const normalized = normalizeRequired(email, "Workspace invitation invitedEmail").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new WorkspaceDomainError(`Workspace invitation email '${email}' is invalid.`);
  }
  return normalized;
}

function normalizeRoles(roles: ReadonlyArray<WorkspaceRole>): ReadonlyArray<WorkspaceRole> {
  if (roles.length === 0) {
    throw new WorkspaceDomainError("Workspace invitedRoles must include at least one role.");
  }

  const deduped = new Set<WorkspaceRole>();
  for (const role of roles) {
    const normalized = normalizeRole(role);
    if (normalized === WorkspaceRoles.owner) {
      throw new WorkspaceDomainError("Workspace invitations cannot assign owner role.");
    }
    deduped.add(normalized);
  }
  return Object.freeze([...deduped.values()]);
}

function assertWorkspaceTransitionAllowed(from: WorkspaceStatus, to: WorkspaceStatus): void {
  if (from === to) {
    return;
  }
  if (!WorkspaceLifecycleTransitions[from].includes(to)) {
    throw new WorkspaceLifecycleTransitionError(from, to);
  }
}

function assertMembershipTransitionAllowed(from: WorkspaceMembershipStatus, to: WorkspaceMembershipStatus): void {
  if (from === to) {
    return;
  }
  if (!WorkspaceMembershipLifecycleTransitions[from].includes(to)) {
    throw new WorkspaceMembershipLifecycleTransitionError(from, to);
  }
}

function assertInvitationTransitionAllowed(from: WorkspaceInvitationStatus, to: WorkspaceInvitationStatus): void {
  if (from === to) {
    return;
  }
  if (!WorkspaceInvitationLifecycleTransitions[from].includes(to)) {
    throw new WorkspaceInvitationLifecycleTransitionError(from, to);
  }
}

function assertWorkspaceState(workspace: Workspace): void {
  if (workspace.status === WorkspaceStatuses.archived && workspace.ownership.visibility === WorkspaceVisibilities.public) {
    throw new WorkspaceDomainError("Archived workspaces cannot remain public.");
  }
}

function assertMembershipState(membership: WorkspaceMembership): void {
  if (membership.status === WorkspaceMembershipStatuses.active && !membership.joinedAt) {
    throw new WorkspaceDomainError("Active workspace memberships must include joinedAt.");
  }
  if (membership.status !== WorkspaceMembershipStatuses.active && membership.joinedAt && membership.status === WorkspaceMembershipStatuses.pending) {
    throw new WorkspaceDomainError("Pending workspace memberships cannot include joinedAt.");
  }
  if (membership.status === WorkspaceMembershipStatuses.suspended && !membership.suspendedAt) {
    throw new WorkspaceDomainError("Suspended workspace memberships must include suspendedAt.");
  }
  if (membership.status !== WorkspaceMembershipStatuses.suspended && membership.suspendedAt) {
    throw new WorkspaceDomainError("Only suspended memberships may include suspendedAt.");
  }
  if (membership.status === WorkspaceMembershipStatuses.removed && !membership.removedAt) {
    throw new WorkspaceDomainError("Removed workspace memberships must include removedAt.");
  }
  if (membership.status === WorkspaceMembershipStatuses.removed && !membership.removedByUserId) {
    throw new WorkspaceDomainError("Removed workspace memberships must include removedByUserId.");
  }
  if (membership.status !== WorkspaceMembershipStatuses.removed && (membership.removedAt || membership.removedByUserId)) {
    throw new WorkspaceDomainError("Only removed memberships may include removedAt/removedByUserId.");
  }
}

function assertRoleAssignmentState(assignment: WorkspaceRoleAssignment): void {
  if (assignment.status === WorkspaceRoleAssignmentStatuses.revoked && !assignment.revokedAt) {
    throw new WorkspaceDomainError("Revoked workspace role assignments must include revokedAt.");
  }
  if (assignment.status === WorkspaceRoleAssignmentStatuses.revoked && !assignment.revokedBy) {
    throw new WorkspaceDomainError("Revoked workspace role assignments must include revokedBy.");
  }
  if (assignment.status !== WorkspaceRoleAssignmentStatuses.revoked && (assignment.revokedAt || assignment.revokedBy)) {
    throw new WorkspaceDomainError("Only revoked role assignments may include revokedAt/revokedBy.");
  }
}

function assertInvitationState(invitation: WorkspaceInvitation): void {
  if (new Date(invitation.expiresAt).getTime() <= new Date(invitation.createdAt).getTime()) {
    throw new WorkspaceDomainError("Workspace invitation expiresAt must be later than createdAt.");
  }
  if (invitation.status === WorkspaceInvitationStatuses.accepted && !invitation.acceptedByUserIdentityId) {
    throw new WorkspaceDomainError("Accepted workspace invitations must include acceptedByUserIdentityId.");
  }
  if (invitation.status === WorkspaceInvitationStatuses.accepted && !invitation.respondedAt) {
    throw new WorkspaceDomainError("Accepted workspace invitations must include respondedAt.");
  }
  if (invitation.status === WorkspaceInvitationStatuses.declined && !invitation.respondedAt) {
    throw new WorkspaceDomainError("Declined workspace invitations must include respondedAt.");
  }
  if (invitation.status !== WorkspaceInvitationStatuses.accepted && invitation.acceptedByUserIdentityId) {
    throw new WorkspaceDomainError("Only accepted invitations may include acceptedByUserIdentityId.");
  }
}

function countActiveOwnerAssignments(assignments: ReadonlyArray<WorkspaceRoleAssignment>): number {
  return assignments.filter((assignment) =>
    assignment.status === WorkspaceRoleAssignmentStatuses.active && assignment.role === WorkspaceRoles.owner
  ).length;
}

export function createWorkspace(input: {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly ownerUserId: string;
  readonly visibility?: WorkspaceVisibility;
  readonly createdBy: string;
  readonly status?: WorkspaceStatus;
  readonly now?: Date;
}): Workspace {
  let ownership: WorkspaceOwnershipMetadata;
  try {
    ownership = createWorkspaceOwnershipMetadata({
      workspaceId: input.id,
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
      createdBy: input.createdBy,
      now: input.now,
    });
  } catch (error) {
    if (error instanceof WorkspaceOwnershipError) {
      throw new WorkspaceDomainError(error.message);
    }
    throw error;
  }

  const workspace: Workspace = Object.freeze({
    id: normalizeRequired(input.id, "Workspace id"),
    slug: normalizeSlug(input.slug),
    displayName: normalizeWorkspaceName(input.displayName),
    description: normalizeWorkspaceDescription(input.description),
    status: normalizeWorkspaceStatus(input.status),
    ownership,
  });

  assertWorkspaceState(workspace);
  return workspace;
}

export function transitionWorkspaceStatus(
  workspace: Workspace,
  status: WorkspaceStatus,
  actorUserId: string,
  now: Date = new Date(),
): Workspace {
  assertWorkspaceTransitionAllowed(workspace.status, status);
  if (workspace.status === status) {
    return workspace;
  }

  const updatedOwnership = touchWorkspaceOwnershipMetadata(
    workspace.ownership,
    normalizeRequired(actorUserId, "Workspace lastModifiedBy"),
    now,
  );

  const updated: Workspace = Object.freeze({
    ...workspace,
    status,
    ownership: updatedOwnership,
  });
  assertWorkspaceState(updated);
  return updated;
}

export function updateWorkspaceDetails(
  workspace: Workspace,
  input: {
    readonly displayName?: string;
    readonly description?: string;
    readonly visibility?: WorkspaceVisibility;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): Workspace {
  const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Workspace lastModifiedAt");
  const actorUserId = normalizeRequired(input.actorUserId, "Workspace lastModifiedBy");
  const nextDisplayName = input.displayName === undefined
    ? workspace.displayName
    : normalizeWorkspaceName(input.displayName);
  const nextDescription = input.description === undefined
    ? workspace.description
    : normalizeWorkspaceDescription(input.description);

  let nextOwnership = workspace.ownership;
  if (input.visibility !== undefined) {
    try {
      nextOwnership = withWorkspaceOwnershipVisibility(nextOwnership, input.visibility, actorUserId, new Date(nowIso));
    } catch (error) {
      if (error instanceof WorkspaceOwnershipError) {
        throw new WorkspaceDomainError(error.message);
      }
      throw error;
    }
  } else {
    nextOwnership = touchWorkspaceOwnershipMetadata(
      nextOwnership,
      actorUserId,
      new Date(nowIso),
    );
  }

  const updated: Workspace = Object.freeze({
    ...workspace,
    displayName: nextDisplayName,
    description: nextDescription,
    ownership: nextOwnership,
  });
  assertWorkspaceState(updated);
  return updated;
}

export function transferWorkspaceOwnership(
  workspace: Workspace,
  input: {
    readonly newOwnerUserId: string;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): Workspace {
  const actorUserId = normalizeRequired(input.actorUserId, "Workspace ownership transfer actorUserId");
  if (workspace.ownership.ownerUserId !== actorUserId) {
    throw new WorkspaceDomainError("Only current workspace owner can transfer ownership.");
  }

  let ownership: WorkspaceOwnershipMetadata;
  try {
    ownership = withWorkspaceOwner(
      workspace.ownership,
      input.newOwnerUserId,
      actorUserId,
      input.now ?? new Date(),
    );
  } catch (error) {
    if (error instanceof WorkspaceOwnershipError) {
      throw new WorkspaceDomainError(error.message);
    }
    throw error;
  }

  const updated: Workspace = Object.freeze({
    ...workspace,
    ownership,
  });
  assertWorkspaceState(updated);
  return updated;
}

export function createWorkspaceMembership(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status?: WorkspaceMembershipStatus;
  readonly invitedByUserId?: string;
  readonly invitationId?: string;
  readonly joinedAt?: Date | string;
  readonly suspendedAt?: Date | string;
  readonly removedAt?: Date | string;
  readonly removedByUserId?: string;
  readonly createdBy: string;
  readonly now?: Date;
}): WorkspaceMembership {
  const createdAt = normalizeIsoTimestamp(input.now ?? new Date(), "Workspace membership createdAt");
  const membership: WorkspaceMembership = Object.freeze({
    id: normalizeRequired(input.id, "Workspace membership id"),
    workspaceId: normalizeRequired(input.workspaceId, "Workspace membership workspaceId"),
    userIdentityId: normalizeRequired(input.userIdentityId, "Workspace membership userIdentityId"),
    status: normalizeMembershipStatus(input.status),
    invitedByUserId: normalizeOptional(input.invitedByUserId),
    invitationId: normalizeOptional(input.invitationId),
    joinedAt: input.joinedAt ? normalizeIsoTimestamp(input.joinedAt, "Workspace membership joinedAt") : undefined,
    suspendedAt: input.suspendedAt ? normalizeIsoTimestamp(input.suspendedAt, "Workspace membership suspendedAt") : undefined,
    removedAt: input.removedAt ? normalizeIsoTimestamp(input.removedAt, "Workspace membership removedAt") : undefined,
    removedByUserId: normalizeOptional(input.removedByUserId),
    createdAt,
    updatedAt: createdAt,
    createdBy: normalizeRequired(input.createdBy, "Workspace membership createdBy"),
    lastModifiedBy: normalizeRequired(input.createdBy, "Workspace membership lastModifiedBy"),
  });
  assertMembershipState(membership);
  return membership;
}

export function transitionWorkspaceMembershipStatus(
  membership: WorkspaceMembership,
  input: {
    readonly status: WorkspaceMembershipStatus;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): WorkspaceMembership {
  assertMembershipTransitionAllowed(membership.status, input.status);
  const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Workspace membership updatedAt");

  if (membership.status === input.status) {
    return membership;
  }

  const updated: WorkspaceMembership = Object.freeze({
    ...membership,
    status: input.status,
    joinedAt: input.status === WorkspaceMembershipStatuses.active ? (membership.joinedAt ?? nowIso) : membership.joinedAt,
    suspendedAt: input.status === WorkspaceMembershipStatuses.suspended ? nowIso : undefined,
    removedAt: input.status === WorkspaceMembershipStatuses.removed ? nowIso : undefined,
    removedByUserId: input.status === WorkspaceMembershipStatuses.removed
      ? normalizeRequired(input.actorUserId, "Workspace membership removedByUserId")
      : undefined,
    updatedAt: nowIso,
    lastModifiedBy: normalizeRequired(input.actorUserId, "Workspace membership lastModifiedBy"),
  });

  assertMembershipState(updated);
  return updated;
}

export function createWorkspaceRoleAssignment(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly assignedBy: string;
  readonly status?: WorkspaceRoleAssignmentStatus;
  readonly assignedAt?: Date | string;
  readonly revokedAt?: Date | string;
  readonly revokedBy?: string;
}): WorkspaceRoleAssignment {
  const assignment: WorkspaceRoleAssignment = Object.freeze({
    id: normalizeRequired(input.id, "Workspace role assignment id"),
    workspaceId: normalizeRequired(input.workspaceId, "Workspace role assignment workspaceId"),
    userIdentityId: normalizeRequired(input.userIdentityId, "Workspace role assignment userIdentityId"),
    role: normalizeRole(input.role),
    status: normalizeRoleAssignmentStatus(input.status),
    assignedAt: normalizeIsoTimestamp(input.assignedAt ?? new Date(), "Workspace role assignment assignedAt"),
    assignedBy: normalizeRequired(input.assignedBy, "Workspace role assignment assignedBy"),
    revokedAt: input.revokedAt ? normalizeIsoTimestamp(input.revokedAt, "Workspace role assignment revokedAt") : undefined,
    revokedBy: normalizeOptional(input.revokedBy),
  });
  assertRoleAssignmentState(assignment);
  return assignment;
}

export function revokeWorkspaceRoleAssignment(
  assignment: WorkspaceRoleAssignment,
  input: {
    readonly revokedBy: string;
    readonly now?: Date;
    readonly activeOwnerAssignmentCount: number;
  },
): WorkspaceRoleAssignment {
  if (assignment.status === WorkspaceRoleAssignmentStatuses.revoked) {
    return assignment;
  }
  if (!Number.isInteger(input.activeOwnerAssignmentCount) || input.activeOwnerAssignmentCount < 0) {
    throw new WorkspaceDomainError("activeOwnerAssignmentCount must be a non-negative integer.");
  }
  if (assignment.role === WorkspaceRoles.owner && input.activeOwnerAssignmentCount <= 1) {
    throw new WorkspaceDomainError("Workspace must retain at least one active owner role assignment.");
  }

  const updated: WorkspaceRoleAssignment = Object.freeze({
    ...assignment,
    status: WorkspaceRoleAssignmentStatuses.revoked,
    revokedAt: normalizeIsoTimestamp(input.now ?? new Date(), "Workspace role assignment revokedAt"),
    revokedBy: normalizeRequired(input.revokedBy, "Workspace role assignment revokedBy"),
  });
  assertRoleAssignmentState(updated);
  return updated;
}

export function assertWorkspaceRoleAssignmentSetInvariants(assignments: ReadonlyArray<WorkspaceRoleAssignment>): void {
  const byId = new Set<string>();
  const activeRolesByWorkspaceUser = new Set<string>();

  for (const assignment of assignments) {
    assertRoleAssignmentState(assignment);

    if (byId.has(assignment.id)) {
      throw new WorkspaceDomainError(`Duplicate workspace role assignment id '${assignment.id}' is not allowed.`);
    }
    byId.add(assignment.id);

    if (assignment.status === WorkspaceRoleAssignmentStatuses.active) {
      const dedupeKey = `${assignment.workspaceId}|${assignment.userIdentityId}|${assignment.role}`;
      if (activeRolesByWorkspaceUser.has(dedupeKey)) {
        throw new WorkspaceDomainError(`Duplicate active workspace role assignment '${dedupeKey}' is not allowed.`);
      }
      activeRolesByWorkspaceUser.add(dedupeKey);
    }
  }

  const workspaces = new Set(assignments.map((assignment) => assignment.workspaceId));
  for (const workspaceId of workspaces) {
    const ownerCount = countActiveOwnerAssignments(assignments.filter((assignment) => assignment.workspaceId === workspaceId));
    if (ownerCount !== 1) {
      throw new WorkspaceDomainError(`Workspace '${workspaceId}' must have exactly one active owner role assignment.`);
    }
  }
}

export function createWorkspaceInvitation(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserId: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly status?: WorkspaceInvitationStatus;
  readonly createdAt?: Date | string;
  readonly expiresAt: Date | string;
  readonly respondedAt?: Date | string;
  readonly acceptedByUserIdentityId?: string;
  readonly lastModifiedBy?: string;
  readonly lastModifiedAt?: Date | string;
}): WorkspaceInvitation {
  const createdAt = normalizeIsoTimestamp(input.createdAt ?? new Date(), "Workspace invitation createdAt");
  const invitation: WorkspaceInvitation = Object.freeze({
    id: normalizeRequired(input.id, "Workspace invitation id"),
    workspaceId: normalizeRequired(input.workspaceId, "Workspace invitation workspaceId"),
    invitedEmail: normalizeInvitationEmail(input.invitedEmail),
    invitedByUserId: normalizeRequired(input.invitedByUserId, "Workspace invitation invitedByUserId"),
    invitedRoles: normalizeRoles(input.invitedRoles),
    status: normalizeInvitationStatus(input.status),
    createdAt,
    expiresAt: normalizeIsoTimestamp(input.expiresAt, "Workspace invitation expiresAt"),
    respondedAt: input.respondedAt ? normalizeIsoTimestamp(input.respondedAt, "Workspace invitation respondedAt") : undefined,
    acceptedByUserIdentityId: normalizeOptional(input.acceptedByUserIdentityId),
    lastModifiedBy: normalizeRequired(input.lastModifiedBy ?? input.invitedByUserId, "Workspace invitation lastModifiedBy"),
    lastModifiedAt: normalizeIsoTimestamp(input.lastModifiedAt ?? createdAt, "Workspace invitation lastModifiedAt"),
  });

  assertInvitationState(invitation);
  return invitation;
}

export function isWorkspaceInvitationActive(invitation: WorkspaceInvitation, now: Date = new Date()): boolean {
  return invitation.status === WorkspaceInvitationStatuses.pending
    && new Date(invitation.expiresAt).getTime() > now.getTime();
}

export function acceptWorkspaceInvitation(
  invitation: WorkspaceInvitation,
  input: {
    readonly acceptedByUserIdentityId: string;
    readonly now?: Date;
  },
): WorkspaceInvitation {
  assertInvitationTransitionAllowed(invitation.status, WorkspaceInvitationStatuses.accepted);
  const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Workspace invitation respondedAt");
  if (new Date(invitation.expiresAt).getTime() <= new Date(nowIso).getTime()) {
    throw new WorkspaceDomainError("Expired invitations cannot be accepted.");
  }

  const accepted: WorkspaceInvitation = Object.freeze({
    ...invitation,
    status: WorkspaceInvitationStatuses.accepted,
    respondedAt: nowIso,
    acceptedByUserIdentityId: normalizeRequired(
      input.acceptedByUserIdentityId,
      "Workspace invitation acceptedByUserIdentityId",
    ),
    lastModifiedBy: normalizeRequired(
      input.acceptedByUserIdentityId,
      "Workspace invitation lastModifiedBy",
    ),
    lastModifiedAt: nowIso,
  });
  assertInvitationState(accepted);
  return accepted;
}

export function declineWorkspaceInvitation(
  invitation: WorkspaceInvitation,
  input: {
    readonly actorUserId: string;
    readonly now?: Date;
  },
): WorkspaceInvitation {
  assertInvitationTransitionAllowed(invitation.status, WorkspaceInvitationStatuses.declined);
  const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Workspace invitation respondedAt");
  const declined: WorkspaceInvitation = Object.freeze({
    ...invitation,
    status: WorkspaceInvitationStatuses.declined,
    respondedAt: nowIso,
    acceptedByUserIdentityId: undefined,
    lastModifiedBy: normalizeRequired(input.actorUserId, "Workspace invitation lastModifiedBy"),
    lastModifiedAt: nowIso,
  });
  assertInvitationState(declined);
  return declined;
}

export function revokeWorkspaceInvitation(
  invitation: WorkspaceInvitation,
  input: {
    readonly actorUserId: string;
    readonly now?: Date;
  },
): WorkspaceInvitation {
  assertInvitationTransitionAllowed(invitation.status, WorkspaceInvitationStatuses.revoked);
  const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Workspace invitation lastModifiedAt");
  const revoked: WorkspaceInvitation = Object.freeze({
    ...invitation,
    status: WorkspaceInvitationStatuses.revoked,
    respondedAt: invitation.respondedAt ?? nowIso,
    acceptedByUserIdentityId: undefined,
    lastModifiedBy: normalizeRequired(input.actorUserId, "Workspace invitation lastModifiedBy"),
    lastModifiedAt: nowIso,
  });
  assertInvitationState(revoked);
  return revoked;
}

export function expireWorkspaceInvitation(
  invitation: WorkspaceInvitation,
  now: Date = new Date(),
): WorkspaceInvitation {
  assertInvitationTransitionAllowed(invitation.status, WorkspaceInvitationStatuses.expired);
  const nowIso = normalizeIsoTimestamp(now, "Workspace invitation lastModifiedAt");
  if (new Date(invitation.expiresAt).getTime() > new Date(nowIso).getTime()) {
    throw new WorkspaceDomainError("Workspace invitation cannot be expired before expiresAt.");
  }

  const expired: WorkspaceInvitation = Object.freeze({
    ...invitation,
    status: WorkspaceInvitationStatuses.expired,
    respondedAt: invitation.respondedAt ?? nowIso,
    acceptedByUserIdentityId: undefined,
    lastModifiedBy: invitation.lastModifiedBy,
    lastModifiedAt: nowIso,
  });
  assertInvitationState(expired);
  return expired;
}
