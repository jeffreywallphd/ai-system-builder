import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceInvitation,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
  WorkspaceIdNamespace,
  WorkspaceInvitationListQuery,
  WorkspacePendingInvitationByTokenHashLookupQuery,
  WorkspacePendingInvitationLookupQuery,
  WorkspaceListQuery,
  WorkspaceMembershipListQuery,
  WorkspaceRoleAssignmentListQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceVisibilities } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  WorkspaceInvitationLifecycleActions,
  WorkspaceInvitationLifecycleErrorCodes,
  type WorkspaceInvitationLifecycleClock,
  type WorkspaceInvitationLifecycleIdGenerator,
} from "../use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import { WorkspaceAdministrationAuditEventTypes, type WorkspaceAdministrationAuditEvent } from "../use-cases/WorkspaceAdministrationAudit";

class InMemoryWorkspaceInvitationLifecycleAdapter
  implements
    IWorkspaceRepository,
    IWorkspaceInvitationRepository,
    IWorkspaceMembershipRepository,
    IWorkspaceRoleAssignmentRepository,
    IWorkspaceAuthorizationReadRepository,
    IWorkspaceTransactionManager {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly invitations = new Map<string, WorkspaceInvitation>();
  public readonly memberships = new Map<string, WorkspaceMembership>();
  public readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();

  public async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId.trim());
  }

  public async findWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const normalized = slug.trim().toLowerCase();
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === normalized) {
        return workspace;
      }
    }
    return undefined;
  }

  public async listWorkspaces(query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>> {
    const filtered = [...this.workspaces.values()]
      .filter((workspace) => !query.ownerUserId || workspace.ownership.ownerUserId === query.ownerUserId)
      .filter((workspace) => !query.visibility || workspace.ownership.visibility === query.visibility)
      .filter((workspace) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(workspace.status))
      .filter((workspace) => !query.slugPrefix || workspace.slug.startsWith(query.slugPrefix.trim().toLowerCase()));

    return Object.freeze(filtered);
  }

  public async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  public async findInvitationById(invitationId: string): Promise<WorkspaceInvitation | undefined> {
    return this.invitations.get(invitationId.trim());
  }

  public async findPendingInvitationByEmail(
    query: WorkspacePendingInvitationLookupQuery,
  ): Promise<WorkspaceInvitation | undefined> {
    const normalizedEmail = query.invitedEmail.trim().toLowerCase();
    const asOf = query.asOf ? new Date(query.asOf).getTime() : Number.NaN;

    for (const invitation of this.invitations.values()) {
      const expiresAt = new Date(invitation.expiresAt).getTime();
      if (
        invitation.workspaceId === query.workspaceId
        && invitation.invitedEmail === normalizedEmail
        && invitation.status === "pending"
        && (Number.isNaN(asOf) || expiresAt > asOf)
      ) {
        return invitation;
      }
    }

    return undefined;
  }

  public async findPendingInvitationByTokenHash(
    query: WorkspacePendingInvitationByTokenHashLookupQuery,
  ): Promise<WorkspaceInvitation | undefined> {
    const normalizedTokenHash = query.invitationTokenHash.trim().toLowerCase();
    const asOf = query.asOf ? new Date(query.asOf).getTime() : Number.NaN;

    for (const invitation of this.invitations.values()) {
      const expiresAt = new Date(invitation.expiresAt).getTime();
      if (
        invitation.workspaceId === query.workspaceId
        && invitation.invitationTokenHash === normalizedTokenHash
        && invitation.status === "pending"
        && (Number.isNaN(asOf) || expiresAt > asOf)
      ) {
        return invitation;
      }
    }

    return undefined;
  }

  public async listInvitations(query: WorkspaceInvitationListQuery): Promise<ReadonlyArray<WorkspaceInvitation>> {
    const filtered = [...this.invitations.values()]
      .filter((invitation) => invitation.workspaceId === query.workspaceId)
      .filter((invitation) => !query.invitedEmail || invitation.invitedEmail === query.invitedEmail.trim().toLowerCase())
      .filter((invitation) => !query.invitedByUserId || invitation.invitedByUserId === query.invitedByUserId)
      .filter((invitation) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(invitation.status));

    return Object.freeze(filtered);
  }

  public async saveInvitation(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation> {
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  public async findMembershipById(membershipId: string): Promise<WorkspaceMembership | undefined> {
    return this.memberships.get(membershipId.trim());
  }

  public async findMembershipByWorkspaceAndUser(
    workspaceId: string,
    userIdentityId: string,
  ): Promise<WorkspaceMembership | undefined> {
    for (const membership of this.memberships.values()) {
      if (membership.workspaceId === workspaceId && membership.userIdentityId === userIdentityId) {
        return membership;
      }
    }

    return undefined;
  }

  public async listMemberships(query: WorkspaceMembershipListQuery): Promise<ReadonlyArray<WorkspaceMembership>> {
    const filtered = [...this.memberships.values()]
      .filter((membership) => membership.workspaceId === query.workspaceId)
      .filter((membership) => !query.userIdentityId || membership.userIdentityId === query.userIdentityId)
      .filter((membership) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(membership.status));

    return Object.freeze(filtered);
  }

  public async saveMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership> {
    this.memberships.set(membership.id, membership);
    return membership;
  }

  public async findRoleAssignmentById(roleAssignmentId: string): Promise<WorkspaceRoleAssignment | undefined> {
    return this.roleAssignments.get(roleAssignmentId.trim());
  }

  public async listRoleAssignments(query: WorkspaceRoleAssignmentListQuery): Promise<ReadonlyArray<WorkspaceRoleAssignment>> {
    const filtered = [...this.roleAssignments.values()]
      .filter((roleAssignment) => roleAssignment.workspaceId === query.workspaceId)
      .filter((roleAssignment) => !query.userIdentityId || roleAssignment.userIdentityId === query.userIdentityId)
      .filter((roleAssignment) => !query.roles || query.roles.length === 0 || query.roles.includes(roleAssignment.role))
      .filter((roleAssignment) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(roleAssignment.status));

    return Object.freeze(filtered);
  }

  public async countActiveRoleAssignments(workspaceId: string, role?: WorkspaceRole): Promise<number> {
    let total = 0;
    for (const roleAssignment of this.roleAssignments.values()) {
      if (
        roleAssignment.workspaceId === workspaceId
        && roleAssignment.status === WorkspaceRoleAssignmentStatuses.active
        && (!role || roleAssignment.role === role)
      ) {
        total += 1;
      }
    }

    return total;
  }

  public async saveRoleAssignment(roleAssignment: WorkspaceRoleAssignment): Promise<WorkspaceRoleAssignment> {
    this.roleAssignments.set(roleAssignment.id, roleAssignment);
    return roleAssignment;
  }

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = this.workspaces.get(query.workspaceId);
    if (!workspace) {
      return undefined;
    }

    const membership = await this.findMembershipByWorkspaceAndUser(query.workspaceId, query.userIdentityId);
    const activeRoleAssignments = [...this.roleAssignments.values()].filter((assignment) => (
      assignment.workspaceId === query.workspaceId
      && assignment.userIdentityId === query.userIdentityId
      && assignment.status === WorkspaceRoleAssignmentStatuses.active
    ));
    const effectiveRoles = Object.freeze([...new Set(activeRoleAssignments.map((assignment) => assignment.role))]);

    return Object.freeze({
      workspace,
      membership,
      activeRoleAssignments: Object.freeze(activeRoleAssignments),
      effectiveRoles,
      isWorkspaceOwner: effectiveRoles.includes(WorkspaceRoles.owner),
    });
  }

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const invitationSnapshot = new Map(this.invitations);
    const membershipSnapshot = new Map(this.memberships);
    const roleAssignmentSnapshot = new Map(this.roleAssignments);

    try {
      return await operation();
    } catch (error) {
      this.invitations.clear();
      this.memberships.clear();
      this.roleAssignments.clear();

      for (const [key, value] of invitationSnapshot) {
        this.invitations.set(key, value);
      }
      for (const [key, value] of membershipSnapshot) {
        this.memberships.set(key, value);
      }
      for (const [key, value] of roleAssignmentSnapshot) {
        this.roleAssignments.set(key, value);
      }

      throw error;
    }
  }
}

class FixedWorkspaceInvitationLifecycleClock implements WorkspaceInvitationLifecycleClock {
  public constructor(private readonly nowIso: string) {}

  public now(): Date {
    return new Date(this.nowIso);
  }
}

class SequenceWorkspaceInvitationLifecycleIdGenerator implements WorkspaceInvitationLifecycleIdGenerator {
  private index = 0;

  public nextId(namespace: WorkspaceIdNamespace): string {
    this.index += 1;
    return `${namespace}:${this.index}`;
  }
}

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function seedWorkspace(adapter: InMemoryWorkspaceInvitationLifecycleAdapter, status: Workspace["status"] = WorkspaceStatuses.active): Workspace {
  const workspace = createWorkspace({
    id: "workspace:alpha",
    slug: "alpha-workspace",
    displayName: "Alpha Workspace",
    ownerUserId: "user:owner",
    createdBy: "user:owner",
    visibility: WorkspaceVisibilities.team,
    status,
    now: new Date("2026-04-05T11:00:00.000Z"),
  });

  adapter.workspaces.set(workspace.id, workspace);
  adapter.memberships.set("membership:owner", createWorkspaceMembership({
    id: "membership:owner",
    workspaceId: workspace.id,
    userIdentityId: "user:owner",
    status: WorkspaceMembershipStatuses.active,
    joinedAt: "2026-04-05T11:00:00.000Z",
    createdBy: "user:owner",
    now: new Date("2026-04-05T11:00:00.000Z"),
  }));
  adapter.roleAssignments.set("role:owner", createWorkspaceRoleAssignment({
    id: "role:owner",
    workspaceId: workspace.id,
    userIdentityId: "user:owner",
    role: WorkspaceRoles.owner,
    assignedBy: "user:owner",
    assignedAt: "2026-04-05T11:00:00.000Z",
  }));

  return workspace;
}

function seedPendingInvitation(
  adapter: InMemoryWorkspaceInvitationLifecycleAdapter,
  input?: {
    readonly token?: string;
    readonly invitedEmail?: string;
    readonly targetUserIdentityIdHint?: string;
    readonly expiresAt?: string;
  },
): WorkspaceInvitation {
  const invitation = createWorkspaceInvitation({
    id: "invite:alpha",
    workspaceId: "workspace:alpha",
    invitedEmail: input?.invitedEmail ?? "member@example.com",
    invitedByUserId: "user:owner",
    invitedRoles: [WorkspaceRoles.member, WorkspaceRoles.viewer],
    invitationTokenHash: hashToken(input?.token ?? "tok_invite_123"),
    invitationTokenHint: "invite123",
    targetUserIdentityIdHint: input?.targetUserIdentityIdHint,
    createdAt: "2026-04-05T11:30:00.000Z",
    expiresAt: input?.expiresAt ?? "2026-04-06T11:30:00.000Z",
    lastModifiedBy: "user:owner",
    lastModifiedAt: "2026-04-05T11:30:00.000Z",
  });

  adapter.invitations.set(invitation.id, invitation);
  return invitation;
}

describe("ResolveWorkspaceInvitationLifecycleUseCase", () => {
  it("emits invitation acceptance audit hooks on successful acceptance", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_accept_audit_123",
      targetUserIdentityIdHint: "user:member",
    });
    const events: WorkspaceAdministrationAuditEvent[] = [];

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:00:00.000Z"),
      auditSink: {
        async recordWorkspaceAdministrationEvent(event: WorkspaceAdministrationAuditEvent): Promise<void> {
          events.push(event);
        },
      },
    });

    const result = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_accept_audit_123",
    });

    expect(result.ok).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(WorkspaceAdministrationAuditEventTypes.invitationAccepted);
  });

  it("accepts a valid invitation token and creates an active membership with projected roles", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_invite_123",
      targetUserIdentityIdHint: "user:member",
    });

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "MEMBER@EXAMPLE.COM",
      invitationToken: "tok_invite_123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.invitation.status).toBe(WorkspaceInvitationStatuses.accepted);
    expect(result.value.invitation.acceptedByUserIdentityId).toBe("user:member");
    expect(result.value.membership?.status).toBe(WorkspaceMembershipStatuses.active);
    expect(result.value.membership?.invitationId).toBe("invite:alpha");
    expect(result.value.membership?.joinedAt).toBe("2026-04-05T12:00:00.000Z");
    expect(result.value.createdRoleAssignments).toHaveLength(2);
    expect(result.value.createdRoleAssignments.map((assignment) => assignment.role)).toEqual([
      WorkspaceRoles.member,
      WorkspaceRoles.viewer,
    ]);

    const replay = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_invite_123",
    });

    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error.code).toBe(WorkspaceInvitationLifecycleErrorCodes.invalidToken);
    }
  });

  it("supports accepting into pending membership state when onboarding should remain pending", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_pending_123",
      targetUserIdentityIdHint: "user:member",
    });

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:05:00.000Z"),
    });

    const result = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_pending_123",
      acceptedMembershipStatus: WorkspaceMembershipStatuses.pending,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.membership?.status).toBe(WorkspaceMembershipStatuses.pending);
    expect(result.value.membership?.joinedAt).toBeUndefined();
  });

  it("persists resolved onboarding metadata during invitation acceptance", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_onboarding_metadata_123",
      targetUserIdentityIdHint: "user:member",
    });

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:06:00.000Z"),
    });

    const result = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_onboarding_metadata_123",
      resolvedOnboardingMetadata: {
        onboardingResolution: {
          completedAt: "2026-04-05T12:06:00.000Z",
          flow: "authenticated-join",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.invitation.onboardingMetadata).toBeDefined();
    expect(result.value.invitation.onboardingMetadata?.onboardingResolution).toEqual({
      completedAt: "2026-04-05T12:06:00.000Z",
      flow: "authenticated-join",
    });

    const persisted = await adapter.findInvitationById("invite:alpha");
    expect(persisted?.onboardingMetadata?.onboardingResolution).toEqual({
      completedAt: "2026-04-05T12:06:00.000Z",
      flow: "authenticated-join",
    });
  });

  it("declines pending invitations and persists declined lifecycle metadata", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_decline_123",
    });

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:10:00.000Z"),
    });

    const result = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.decline,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_decline_123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.invitation.status).toBe(WorkspaceInvitationStatuses.declined);
    expect(result.value.invitation.respondedAt).toBe("2026-04-05T12:10:00.000Z");
    expect(result.value.invitation.acceptedByUserIdentityId).toBeUndefined();
    expect(result.value.membership).toBeUndefined();
  });

  it("resolves expired pending tokens to expired status and rejects stale use safely", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_expired_123",
      expiresAt: "2026-04-05T11:50:00.000Z",
    });

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:20:00.000Z"),
    });

    const result = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_expired_123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceInvitationLifecycleErrorCodes.invalidToken);
    }

    const persisted = await adapter.findInvitationById("invite:alpha");
    expect(persisted?.status).toBe(WorkspaceInvitationStatuses.expired);
  });

  it("rejects identity mismatches and suspended workspace acceptance", async () => {
    const mismatchAdapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(mismatchAdapter);
    seedPendingInvitation(mismatchAdapter, {
      token: "tok_identity_123",
      targetUserIdentityIdHint: "user:expected",
    });

    const mismatchUseCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: mismatchAdapter,
      invitationRepository: mismatchAdapter,
      membershipRepository: mismatchAdapter,
      roleAssignmentRepository: mismatchAdapter,
      authorizationReadRepository: mismatchAdapter,
      transactionManager: mismatchAdapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:30:00.000Z"),
    });

    const identityMismatch = await mismatchUseCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:wrong",
      actorEmail: "member@example.com",
      invitationToken: "tok_identity_123",
    });

    expect(identityMismatch.ok).toBe(false);
    if (!identityMismatch.ok) {
      expect(identityMismatch.error.code).toBe(WorkspaceInvitationLifecycleErrorCodes.forbidden);
    }

    const suspendedAdapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    seedWorkspace(suspendedAdapter, WorkspaceStatuses.suspended);
    seedPendingInvitation(suspendedAdapter, {
      token: "tok_state_123",
      targetUserIdentityIdHint: "user:member",
    });

    const suspendedUseCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: suspendedAdapter,
      invitationRepository: suspendedAdapter,
      membershipRepository: suspendedAdapter,
      roleAssignmentRepository: suspendedAdapter,
      authorizationReadRepository: suspendedAdapter,
      transactionManager: suspendedAdapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:30:00.000Z"),
    });

    const invalidWorkspaceState = await suspendedUseCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:member",
      actorEmail: "member@example.com",
      invitationToken: "tok_state_123",
    });

    expect(invalidWorkspaceState.ok).toBe(false);
    if (!invalidWorkspaceState.ok) {
      expect(invalidWorkspaceState.error.code).toBe(WorkspaceInvitationLifecycleErrorCodes.invalidState);
    }
  });

  it("supports admin cancellation and forbids non-admin cancellation", async () => {
    const adapter = new InMemoryWorkspaceInvitationLifecycleAdapter();
    const workspace = seedWorkspace(adapter);
    seedPendingInvitation(adapter, {
      token: "tok_cancel_123",
    });

    adapter.memberships.set("membership:member", createWorkspaceMembership({
      id: "membership:member",
      workspaceId: workspace.id,
      userIdentityId: "user:member",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:15:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:15:00.000Z"),
    }));
    adapter.roleAssignments.set("role:member", createWorkspaceRoleAssignment({
      id: "role:member",
      workspaceId: workspace.id,
      userIdentityId: "user:member",
      role: WorkspaceRoles.member,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:15:00.000Z",
    }));

    const useCase = new ResolveWorkspaceInvitationLifecycleUseCase({
      workspaceRepository: adapter,
      invitationRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceWorkspaceInvitationLifecycleIdGenerator(),
      clock: new FixedWorkspaceInvitationLifecycleClock("2026-04-05T12:40:00.000Z"),
    });

    const forbidden = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.cancel,
      workspaceId: workspace.id,
      actorUserIdentityId: "user:member",
      invitationId: "invite:alpha",
    });

    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe(WorkspaceInvitationLifecycleErrorCodes.forbidden);
    }

    const canceled = await useCase.execute({
      action: WorkspaceInvitationLifecycleActions.cancel,
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      invitationId: "invite:alpha",
    });

    expect(canceled.ok).toBe(true);
    if (!canceled.ok) {
      return;
    }

    expect(canceled.value.invitation.status).toBe(WorkspaceInvitationStatuses.revoked);
    expect(canceled.value.invitation.lastModifiedBy).toBe("user:owner");
  });
});
