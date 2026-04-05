import { describe, expect, it } from "bun:test";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
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
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
  WorkspaceIdNamespace,
  WorkspaceInvitationListQuery,
  WorkspacePendingInvitationByTokenHashLookupQuery,
  WorkspacePendingInvitationLookupQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceVisibilities } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  IssueWorkspaceInvitationUseCase,
  WorkspaceInvitationIssuanceErrorCodes,
  type WorkspaceInvitationIssuanceClock,
  type WorkspaceInvitationIssuanceIdGenerator,
  type WorkspaceInvitationTokenIssuer,
  type WorkspaceInvitationTokenReference,
} from "../use-cases/IssueWorkspaceInvitationUseCase";
import { WorkspaceAdministrationAuditEventTypes, type WorkspaceAdministrationAuditEvent } from "../use-cases/WorkspaceAdministrationAudit";

class InMemoryWorkspaceInvitationIssuanceAdapter
  implements IWorkspaceInvitationRepository, IWorkspaceAuthorizationReadRepository, IWorkspaceTransactionManager {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly memberships = new Map<string, WorkspaceMembership>();
  public readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();
  public readonly invitations = new Map<string, WorkspaceInvitation>();

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

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = this.workspaces.get(query.workspaceId);
    if (!workspace) {
      return undefined;
    }

    const membership = [...this.memberships.values()].find((value) => (
      value.workspaceId === query.workspaceId && value.userIdentityId === query.userIdentityId
    ));

    const activeRoleAssignments = [...this.roleAssignments.values()].filter((value) => (
      value.workspaceId === query.workspaceId
      && value.userIdentityId === query.userIdentityId
      && value.status === WorkspaceRoleAssignmentStatuses.active
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
    const snapshot = new Map(this.invitations);
    try {
      return await operation();
    } catch (error) {
      this.invitations.clear();
      for (const [key, value] of snapshot) {
        this.invitations.set(key, value);
      }
      throw error;
    }
  }
}

class FixedInvitationClock implements WorkspaceInvitationIssuanceClock {
  public constructor(private readonly timeIso: string) {}

  public now(): Date {
    return new Date(this.timeIso);
  }
}

class SequenceInvitationIdGenerator implements WorkspaceInvitationIssuanceIdGenerator {
  private index = 0;

  public nextId(namespace: WorkspaceIdNamespace): string {
    this.index += 1;
    return `${namespace}:${this.index}`;
  }
}

class StubInvitationTokenIssuer implements WorkspaceInvitationTokenIssuer {
  public constructor(private readonly tokenReference: WorkspaceInvitationTokenReference) {}

  public issueTokenReference(): WorkspaceInvitationTokenReference {
    return this.tokenReference;
  }
}

function seedWorkspace(adapter: InMemoryWorkspaceInvitationIssuanceAdapter): Workspace {
  const workspace = createWorkspace({
    id: "workspace:alpha",
    slug: "team-alpha",
    displayName: "Team Alpha",
    ownerUserId: "user:owner",
    createdBy: "user:owner",
    visibility: WorkspaceVisibilities.team,
    status: WorkspaceStatuses.active,
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

describe("IssueWorkspaceInvitationUseCase", () => {
  it("emits invitation issuance audit hooks after successful issuance", async () => {
    const adapter = new InMemoryWorkspaceInvitationIssuanceAdapter();
    const workspace = seedWorkspace(adapter);
    const events: WorkspaceAdministrationAuditEvent[] = [];

    const useCase = new IssueWorkspaceInvitationUseCase({
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceInvitationIdGenerator(),
      clock: new FixedInvitationClock("2026-04-05T12:00:00.000Z"),
      tokenIssuer: new StubInvitationTokenIssuer({
        token: "tok_live_audit",
        tokenHash: "aa7f44c8c9c9b66a7ad6bd9d8674ef50d5d30f5d5fb8bf6f6f17ac53fb16d7e2",
        tokenHint: "audit001",
      }),
      auditSink: {
        async recordWorkspaceAdministrationEvent(event: WorkspaceAdministrationAuditEvent): Promise<void> {
          events.push(event);
        },
      },
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      invitedEmail: "audit@example.com",
      invitedRoles: [WorkspaceRoles.viewer],
    });

    expect(result.ok).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(WorkspaceAdministrationAuditEventTypes.invitationIssued);
  });

  it("issues invitation records for authorized actors with hashed token references", async () => {
    const adapter = new InMemoryWorkspaceInvitationIssuanceAdapter();
    const workspace = seedWorkspace(adapter);

    const useCase = new IssueWorkspaceInvitationUseCase({
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceInvitationIdGenerator(),
      clock: new FixedInvitationClock("2026-04-05T12:00:00.000Z"),
      tokenIssuer: new StubInvitationTokenIssuer({
        token: "tok_live_abc123",
        tokenHash: "b7f5a0c8c9c9b66a7ad6bd9d8674ef50d5d30f5d5fb8bf6f6f17ac53fb16d7e1",
        tokenHint: "abc123",
      }),
      defaultInvitationTtlMs: 24 * 60 * 60 * 1_000,
      maxInvitationTtlMs: 30 * 24 * 60 * 60 * 1_000,
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      invitedEmail: "Member@Example.com",
      invitedRoles: [WorkspaceRoles.member, WorkspaceRoles.viewer],
      targetUserIdentityIdHint: "user:member",
      onboardingMetadata: {
        source: "admin-console",
        flow: "workspace-invite",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.invitationToken).toBe("tok_live_abc123");
    expect(result.value.invitation.invitedEmail).toBe("member@example.com");
    expect(result.value.invitation.invitationTokenHash).toBe("b7f5a0c8c9c9b66a7ad6bd9d8674ef50d5d30f5d5fb8bf6f6f17ac53fb16d7e1");
    expect(result.value.invitation.invitationTokenHint).toBe("abc123");
    expect(result.value.invitation.targetUserIdentityIdHint).toBe("user:member");
    expect(result.value.invitation.onboardingMetadata?.source).toBe("admin-console");
    expect(result.value.invitation.status).toBe("pending");
    expect(result.value.invitation.expiresAt).toBe("2026-04-06T12:00:00.000Z");

    const pendingByToken = await adapter.findPendingInvitationByTokenHash({
      workspaceId: workspace.id,
      invitationTokenHash: "b7f5a0c8c9c9b66a7ad6bd9d8674ef50d5d30f5d5fb8bf6f6f17ac53fb16d7e1",
      asOf: "2026-04-05T12:00:00.000Z",
    });
    expect(pendingByToken?.id).toBe(result.value.invitation.id);
  });

  it("rejects invitation issuance for non-admin actors", async () => {
    const adapter = new InMemoryWorkspaceInvitationIssuanceAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.memberships.set("membership:member", createWorkspaceMembership({
      id: "membership:member",
      workspaceId: workspace.id,
      userIdentityId: "user:member",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:10:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:10:00.000Z"),
    }));
    adapter.roleAssignments.set("role:member", createWorkspaceRoleAssignment({
      id: "role:member",
      workspaceId: workspace.id,
      userIdentityId: "user:member",
      role: WorkspaceRoles.member,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:10:00.000Z",
    }));

    const useCase = new IssueWorkspaceInvitationUseCase({
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceInvitationIdGenerator(),
      clock: new FixedInvitationClock("2026-04-05T12:00:00.000Z"),
      tokenIssuer: new StubInvitationTokenIssuer({
        token: "tok_live_member",
        tokenHash: "2d7a26cbc7354f9f7f778ad4b49bc3f9f00f6a6f236e85531a61c0b7a9a8d844",
        tokenHint: "member",
      }),
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:member",
      invitedEmail: "new@example.com",
      invitedRoles: [WorkspaceRoles.viewer],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceInvitationIssuanceErrorCodes.forbidden);
    }
  });

  it("rejects duplicate pending invitations for the same workspace/email", async () => {
    const adapter = new InMemoryWorkspaceInvitationIssuanceAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.invitations.set("invite:existing", createWorkspaceInvitation({
      id: "invite:existing",
      workspaceId: workspace.id,
      invitedEmail: "member@example.com",
      invitedByUserId: "user:owner",
      invitedRoles: [WorkspaceRoles.member],
      invitationTokenHash: "ab5f6d498d1377f5d14fc98289b2dcd60d443f95f6099d61326792de4ccf4f4b",
      invitationTokenHint: "exist001",
      createdAt: "2026-04-05T11:30:00.000Z",
      expiresAt: "2026-04-06T11:30:00.000Z",
      lastModifiedBy: "user:owner",
      lastModifiedAt: "2026-04-05T11:30:00.000Z",
    }));

    const useCase = new IssueWorkspaceInvitationUseCase({
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceInvitationIdGenerator(),
      clock: new FixedInvitationClock("2026-04-05T12:00:00.000Z"),
      tokenIssuer: new StubInvitationTokenIssuer({
        token: "tok_live_new",
        tokenHash: "9f9ee71595f7f9a6c8068fbf9164d9d36ca9f57b6f61659566ab709593fbbf57",
        tokenHint: "newtok01",
      }),
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      invitedEmail: "MEMBER@EXAMPLE.COM",
      invitedRoles: [WorkspaceRoles.viewer],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceInvitationIssuanceErrorCodes.conflict);
      expect(result.error.message).toContain("active pending invitation");
    }
  });

  it("enforces explicit expiration policy bounds", async () => {
    const adapter = new InMemoryWorkspaceInvitationIssuanceAdapter();
    const workspace = seedWorkspace(adapter);

    const useCase = new IssueWorkspaceInvitationUseCase({
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceInvitationIdGenerator(),
      clock: new FixedInvitationClock("2026-04-05T12:00:00.000Z"),
      tokenIssuer: new StubInvitationTokenIssuer({
        token: "tok_live_expiry",
        tokenHash: "17f30e626a42c8c74c3b8d5d5a6dd71c946f1f26a3dbf058ffb68f95d7fc2e3d",
        tokenHint: "expiry01",
      }),
      maxInvitationTtlMs: 3_600_000,
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      invitedEmail: "late@example.com",
      invitedRoles: [WorkspaceRoles.viewer],
      expiresAt: "2026-04-05T14:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceInvitationIssuanceErrorCodes.invalidRequest);
      expect(result.error.message).toContain("maximum allowed invitation lifetime");
    }
  });
});
