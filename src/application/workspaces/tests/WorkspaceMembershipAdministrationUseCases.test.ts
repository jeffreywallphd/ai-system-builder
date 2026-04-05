import { describe, expect, it } from "bun:test";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type Workspace,
  type WorkspaceMembership,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import {
  WorkspaceIdNamespaces,
  type WorkspaceAuthorizationSnapshot,
  type WorkspaceAuthorizationSnapshotQuery,
  type WorkspaceIdNamespace,
  type WorkspaceMembershipListQuery,
  type WorkspaceRoleAssignmentListQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceVisibilities } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  AddWorkspaceMemberUseCase,
  WorkspaceMembershipAdditionErrorCodes,
  type WorkspaceMembershipAdministrationClock,
  type WorkspaceMembershipAdministrationIdGenerator,
} from "../use-cases/AddWorkspaceMemberUseCase";
import {
  ChangeWorkspaceMembershipStatusUseCase,
  WorkspaceMembershipStatusChangeErrorCodes,
  type WorkspaceMembershipStatusChangeClock,
} from "../use-cases/ChangeWorkspaceMembershipStatusUseCase";
import {
  RemoveWorkspaceMemberUseCase,
  WorkspaceMembershipRemovalErrorCodes,
} from "../use-cases/RemoveWorkspaceMemberUseCase";
import {
  AssignWorkspaceRoleUseCase,
  WorkspaceRoleAssignmentErrorCodes,
} from "../use-cases/AssignWorkspaceRoleUseCase";
import {
  ReassignWorkspaceRoleUseCase,
  WorkspaceRoleReassignmentErrorCodes,
} from "../use-cases/ReassignWorkspaceRoleUseCase";
import {
  RevokeWorkspaceRoleUseCase,
  WorkspaceRoleRevocationErrorCodes,
} from "../use-cases/RevokeWorkspaceRoleUseCase";
import type { WorkspaceRoleAdministrationClock, WorkspaceRoleAdministrationIdGenerator } from "../use-cases/WorkspaceRoleAdministrationContext";
import { WorkspaceAdministrationAuditEventTypes, type WorkspaceAdministrationAuditEvent } from "../use-cases/WorkspaceAdministrationAudit";

class InMemoryWorkspaceMembershipAdministrationAdapter
  implements
    IWorkspaceMembershipRepository,
    IWorkspaceRoleAssignmentRepository,
    IWorkspaceAuthorizationReadRepository,
    IWorkspaceTransactionManager {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly memberships = new Map<string, WorkspaceMembership>();
  public readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();

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
      .filter((membership) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(membership.status))
      .filter((membership) => !query.invitationId || membership.invitationId === query.invitationId)
      .filter((membership) => !query.invitedByUserId || membership.invitedByUserId === query.invitedByUserId);

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
      .filter((assignment) => assignment.workspaceId === query.workspaceId)
      .filter((assignment) => !query.userIdentityId || assignment.userIdentityId === query.userIdentityId)
      .filter((assignment) => !query.roles || query.roles.length === 0 || query.roles.includes(assignment.role))
      .filter((assignment) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(assignment.status));

    return Object.freeze(filtered);
  }

  public async countActiveRoleAssignments(workspaceId: string, role?: WorkspaceRole): Promise<number> {
    let total = 0;
    for (const assignment of this.roleAssignments.values()) {
      if (
        assignment.workspaceId === workspaceId
        && assignment.status === WorkspaceRoleAssignmentStatuses.active
        && (!role || assignment.role === role)
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
    const membershipsSnapshot = new Map(this.memberships);
    const roleAssignmentsSnapshot = new Map(this.roleAssignments);

    try {
      return await operation();
    } catch (error) {
      this.memberships.clear();
      this.roleAssignments.clear();
      for (const [key, value] of membershipsSnapshot) {
        this.memberships.set(key, value);
      }
      for (const [key, value] of roleAssignmentsSnapshot) {
        this.roleAssignments.set(key, value);
      }
      throw error;
    }
  }
}

class FixedMembershipAdministrationClock
  implements
    WorkspaceMembershipAdministrationClock,
    WorkspaceMembershipStatusChangeClock,
    WorkspaceRoleAdministrationClock {
  public constructor(private readonly timeIso: string) {}

  public now(): Date {
    return new Date(this.timeIso);
  }
}

class SequenceMembershipAdministrationIdGenerator implements WorkspaceMembershipAdministrationIdGenerator {
  private index = 0;

  public nextId(namespace: WorkspaceIdNamespace): string {
    this.index += 1;
    return `${namespace}:${this.index}`;
  }
}

class SequenceRoleAdministrationIdGenerator implements WorkspaceRoleAdministrationIdGenerator {
  private index = 0;

  public nextId(namespace: WorkspaceIdNamespace): string {
    this.index += 1;
    return `${namespace}:role:${this.index}`;
  }
}

function seedWorkspace(adapter: InMemoryWorkspaceMembershipAdministrationAdapter): Workspace {
  const workspace = createWorkspace({
    id: "workspace:alpha",
    slug: "alpha-workspace",
    displayName: "Alpha Workspace",
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

describe("Workspace membership administration use cases", () => {
  it("emits audit hooks for member add, status mutation, and remove", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);
    const events: WorkspaceAdministrationAuditEvent[] = [];
    const auditSink = {
      async recordWorkspaceAdministrationEvent(event: WorkspaceAdministrationAuditEvent): Promise<void> {
        events.push(event);
      },
    };

    const addUseCase = new AddWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceMembershipAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:00:00.000Z"),
      auditSink,
    });
    const statusUseCase = new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:10:00.000Z"),
      auditSink,
    });
    const removeUseCase = new RemoveWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:20:00.000Z"),
      auditSink,
    });

    const added = await addUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:audit-target",
      initialStatus: WorkspaceMembershipStatuses.pending,
    });
    expect(added.ok).toBe(true);

    const activated = await statusUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:audit-target",
      status: WorkspaceMembershipStatuses.active,
    });
    expect(activated.ok).toBe(true);

    const removed = await removeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:audit-target",
    });
    expect(removed.ok).toBe(true);

    expect(events.map((event) => event.type)).toEqual([
      WorkspaceAdministrationAuditEventTypes.membershipAdded,
      WorkspaceAdministrationAuditEventTypes.membershipStatusChanged,
      WorkspaceAdministrationAuditEventTypes.membershipStatusChanged,
    ]);
    expect(events[2]?.details?.mutationKind).toBe("remove");
  });

  it("adds members with default role and actor/timestamp attribution", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);

    const useCase = new AddWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceMembershipAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:new-member",
      initialStatus: WorkspaceMembershipStatuses.active,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.membership.status).toBe(WorkspaceMembershipStatuses.active);
    expect(result.value.membership.createdBy).toBe("user:owner");
    expect(result.value.membership.lastModifiedBy).toBe("user:owner");
    expect(result.value.membership.createdAt).toBe("2026-04-05T12:00:00.000Z");
    expect(result.value.membership.joinedAt).toBe("2026-04-05T12:00:00.000Z");
    expect(result.value.roleAssignments).toHaveLength(1);
    expect(result.value.roleAssignments[0]?.role).toBe(WorkspaceRoles.member);
    expect(result.value.roleAssignments[0]?.assignedBy).toBe("user:owner");
    expect(result.value.roleAssignments[0]?.assignedAt).toBe("2026-04-05T12:00:00.000Z");
  });

  it("rejects membership additions from non-admin actors", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
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

    const useCase = new AddWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceMembershipAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:member",
      targetUserIdentityId: "user:new-member",
      initialStatus: WorkspaceMembershipStatuses.pending,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceMembershipAdditionErrorCodes.forbidden);
    }
  });

  it("changes membership status for valid transitions and preserves continuity policy", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.memberships.set("membership:admin", createWorkspaceMembership({
      id: "membership:admin",
      workspaceId: workspace.id,
      userIdentityId: "user:admin",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:10:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:10:00.000Z"),
    }));
    adapter.roleAssignments.set("role:admin", createWorkspaceRoleAssignment({
      id: "role:admin",
      workspaceId: workspace.id,
      userIdentityId: "user:admin",
      role: WorkspaceRoles.admin,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:10:00.000Z",
    }));

    const useCase = new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:30:00.000Z"),
    });

    const suspended = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:admin",
      status: WorkspaceMembershipStatuses.suspended,
    });

    expect(suspended.ok).toBe(true);
    if (!suspended.ok) {
      return;
    }

    expect(suspended.value.membership.status).toBe(WorkspaceMembershipStatuses.suspended);
    expect(suspended.value.membership.lastModifiedBy).toBe("user:owner");
    expect(suspended.value.membership.updatedAt).toBe("2026-04-05T12:30:00.000Z");
    expect(suspended.value.membership.suspendedAt).toBe("2026-04-05T12:30:00.000Z");

    const blocksLastAdmin = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:owner",
      status: WorkspaceMembershipStatuses.suspended,
    });

    expect(blocksLastAdmin.ok).toBe(false);
    if (!blocksLastAdmin.ok) {
      expect(blocksLastAdmin.error.code).toBe(WorkspaceMembershipStatusChangeErrorCodes.conflict);
      expect(blocksLastAdmin.error.message).toContain("retain at least one active owner or admin");
    }
  });

  it("removes members, revokes roles, and blocks last-admin removal without replacement", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.memberships.set("membership:target", createWorkspaceMembership({
      id: "membership:target",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:20:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:20:00.000Z"),
    }));
    adapter.roleAssignments.set("role:target-admin", createWorkspaceRoleAssignment({
      id: "role:target-admin",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      role: WorkspaceRoles.admin,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:20:00.000Z",
    }));

    const removeUseCase = new RemoveWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:45:00.000Z"),
    });

    const removed = await removeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
    });

    expect(removed.ok).toBe(true);
    if (!removed.ok) {
      return;
    }

    expect(removed.value.membership.status).toBe(WorkspaceMembershipStatuses.removed);
    expect(removed.value.membership.removedByUserId).toBe("user:owner");
    expect(removed.value.membership.removedAt).toBe("2026-04-05T12:45:00.000Z");
    expect(removed.value.revokedRoleAssignmentIds).toEqual(["role:target-admin"]);

    const persistedRole = await adapter.findRoleAssignmentById("role:target-admin");
    expect(persistedRole?.status).toBe(WorkspaceRoleAssignmentStatuses.revoked);
    expect(persistedRole?.revokedBy).toBe("user:owner");
    expect(persistedRole?.revokedAt).toBe("2026-04-05T12:45:00.000Z");

    const blocked = await removeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:owner",
    });

    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.code).toBe(WorkspaceMembershipRemovalErrorCodes.conflict);
      expect(blocked.error.message).toContain("retain at least one active owner or admin");
    }
  });

  it("returns actionable conflicts for duplicate member additions and invalid transitions", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.memberships.set("membership:existing", createWorkspaceMembership({
      id: "membership:existing",
      workspaceId: workspace.id,
      userIdentityId: "user:existing",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:15:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:15:00.000Z"),
    }));

    const addUseCase = new AddWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceMembershipAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:00:00.000Z"),
    });

    const duplicate = await addUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:existing",
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(WorkspaceMembershipAdditionErrorCodes.conflict);
      expect(duplicate.error.message).toContain("Use membership status change flow");
    }

    const statusUseCase = new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T12:00:00.000Z"),
    });

    const invalidTransition = await statusUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:existing",
      status: WorkspaceMembershipStatuses.pending,
    });

    expect(invalidTransition.ok).toBe(false);
    if (!invalidTransition.ok) {
      expect(invalidTransition.error.code).toBe(WorkspaceMembershipStatusChangeErrorCodes.invalidTransition);
    }
  });

  it("maps not-found and permission denials through remove flow result codes", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.memberships.set("membership:member", createWorkspaceMembership({
      id: "membership:member",
      workspaceId: workspace.id,
      userIdentityId: "user:member",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:30:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:30:00.000Z"),
    }));
    adapter.roleAssignments.set("role:member", createWorkspaceRoleAssignment({
      id: "role:member",
      workspaceId: workspace.id,
      userIdentityId: "user:member",
      role: WorkspaceRoles.member,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:30:00.000Z",
    }));

    const removeUseCase = new RemoveWorkspaceMemberUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:00:00.000Z"),
    });

    const forbidden = await removeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:member",
      targetUserIdentityId: "user:owner",
    });

    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe(WorkspaceMembershipRemovalErrorCodes.forbidden);
    }

    const missing = await removeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:missing",
    });

    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe(WorkspaceMembershipRemovalErrorCodes.notFound);
    }
  });

  it("exposes story-level id namespace constants for membership administration ids", () => {
    expect(WorkspaceIdNamespaces.workspaceMembership).toBe("workspace-membership");
    expect(WorkspaceIdNamespaces.workspaceRoleAssignment).toBe("workspace-role-assignment");
  });
});

describe("Workspace role administration use cases", () => {
  it("emits audit hooks for assign, reassign, and revoke role mutations", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);
    const events: WorkspaceAdministrationAuditEvent[] = [];
    const auditSink = {
      async recordWorkspaceAdministrationEvent(event: WorkspaceAdministrationAuditEvent): Promise<void> {
        events.push(event);
      },
    };

    adapter.memberships.set("membership:target", createWorkspaceMembership({
      id: "membership:target",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:20:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:20:00.000Z"),
    }));

    const assignUseCase = new AssignWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceRoleAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:15:00.000Z"),
      auditSink,
    });
    const reassignUseCase = new ReassignWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceRoleAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:20:00.000Z"),
      auditSink,
    });
    const revokeUseCase = new RevokeWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:25:00.000Z"),
      auditSink,
    });

    const assigned = await assignUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
      role: WorkspaceRoles.admin,
    });
    expect(assigned.ok).toBe(true);

    const reassigned = await reassignUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
      fromRole: WorkspaceRoles.admin,
      toRole: WorkspaceRoles.viewer,
    });
    expect(reassigned.ok).toBe(true);

    const revoked = await revokeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
      role: WorkspaceRoles.viewer,
    });
    expect(revoked.ok).toBe(true);

    expect(events.map((event) => event.type)).toEqual([
      WorkspaceAdministrationAuditEventTypes.roleAssigned,
      WorkspaceAdministrationAuditEventTypes.roleReassigned,
      WorkspaceAdministrationAuditEventTypes.roleRevoked,
    ]);
  });

  it("assigns workspace roles through explicit application flow and captures audit context", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);
    adapter.memberships.set("membership:target", createWorkspaceMembership({
      id: "membership:target",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:20:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:20:00.000Z"),
    }));

    const useCase = new AssignWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceRoleAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:15:00.000Z"),
    });

    const assigned = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
      role: WorkspaceRoles.admin,
      audit: {
        reason: "delegate administration",
        correlationId: "req-123",
        metadata: {
          ticket: "IAM-42",
        },
      },
    });

    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    expect(assigned.value.roleAssignment.role).toBe(WorkspaceRoles.admin);
    expect(assigned.value.roleAssignment.assignedBy).toBe("user:owner");
    expect(assigned.value.roleAssignment.assignedAt).toBe("2026-04-05T13:15:00.000Z");
    expect(assigned.value.audit?.reason).toBe("delegate administration");
    expect(assigned.value.audit?.correlationId).toBe("req-123");
  });

  it("blocks contradictory and unauthorized role assignments", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);
    adapter.memberships.set("membership:target", createWorkspaceMembership({
      id: "membership:target",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:20:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:20:00.000Z"),
    }));
    adapter.roleAssignments.set("role:target-member", createWorkspaceRoleAssignment({
      id: "role:target-member",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      role: WorkspaceRoles.member,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:20:00.000Z",
    }));
    adapter.memberships.set("membership:non-admin", createWorkspaceMembership({
      id: "membership:non-admin",
      workspaceId: workspace.id,
      userIdentityId: "user:non-admin",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:40:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:40:00.000Z"),
    }));
    adapter.roleAssignments.set("role:non-admin-member", createWorkspaceRoleAssignment({
      id: "role:non-admin-member",
      workspaceId: workspace.id,
      userIdentityId: "user:non-admin",
      role: WorkspaceRoles.member,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:40:00.000Z",
    }));

    const useCase = new AssignWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceRoleAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:20:00.000Z"),
    });

    const duplicate = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
      role: WorkspaceRoles.member,
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(WorkspaceRoleAssignmentErrorCodes.conflict);
    }

    const forbidden = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:non-admin",
      targetUserIdentityId: "user:target",
      role: WorkspaceRoles.viewer,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe(WorkspaceRoleAssignmentErrorCodes.forbidden);
    }
  });

  it("reassigns roles by revoking prior assignment and creating a replacement record", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);
    adapter.memberships.set("membership:target", createWorkspaceMembership({
      id: "membership:target",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:20:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:20:00.000Z"),
    }));
    adapter.roleAssignments.set("role:target-member", createWorkspaceRoleAssignment({
      id: "role:target-member",
      workspaceId: workspace.id,
      userIdentityId: "user:target",
      role: WorkspaceRoles.member,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:20:00.000Z",
    }));

    const useCase = new ReassignWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceRoleAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:25:00.000Z"),
    });

    const reassigned = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      targetUserIdentityId: "user:target",
      fromRole: WorkspaceRoles.member,
      toRole: WorkspaceRoles.viewer,
      audit: {
        reason: "limit permissions",
      },
    });

    expect(reassigned.ok).toBe(true);
    if (!reassigned.ok) {
      return;
    }

    expect(reassigned.value.revokedRoleAssignment.status).toBe(WorkspaceRoleAssignmentStatuses.revoked);
    expect(reassigned.value.revokedRoleAssignment.revokedBy).toBe("user:owner");
    expect(reassigned.value.assignedRoleAssignment.role).toBe(WorkspaceRoles.viewer);
    expect(reassigned.value.assignedRoleAssignment.assignedBy).toBe("user:owner");
    expect(reassigned.value.audit?.reason).toBe("limit permissions");
  });

  it("blocks reassign and revoke operations that violate continuity or role mutation constraints", async () => {
    const adapter = new InMemoryWorkspaceMembershipAdministrationAdapter();
    const workspace = seedWorkspace(adapter);

    adapter.memberships.set("membership:owner", createWorkspaceMembership({
      id: "membership:owner",
      workspaceId: workspace.id,
      userIdentityId: "user:owner",
      status: WorkspaceMembershipStatuses.suspended,
      suspendedAt: "2026-04-05T12:00:00.000Z",
      joinedAt: "2026-04-05T11:00:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));
    adapter.memberships.set("membership:admin", createWorkspaceMembership({
      id: "membership:admin",
      workspaceId: workspace.id,
      userIdentityId: "user:admin",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T11:10:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T11:10:00.000Z"),
    }));
    adapter.roleAssignments.set("role:admin", createWorkspaceRoleAssignment({
      id: "role:admin",
      workspaceId: workspace.id,
      userIdentityId: "user:admin",
      role: WorkspaceRoles.admin,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T11:10:00.000Z",
    }));

    const reassignUseCase = new ReassignWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      idGenerator: new SequenceRoleAdministrationIdGenerator(),
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:30:00.000Z"),
    });
    const revokeUseCase = new RevokeWorkspaceRoleUseCase({
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      authorizationReadRepository: adapter,
      transactionManager: adapter,
      clock: new FixedMembershipAdministrationClock("2026-04-05T13:30:00.000Z"),
    });

    const blockedReassignment = await reassignUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:admin",
      targetUserIdentityId: "user:admin",
      fromRole: WorkspaceRoles.admin,
      toRole: WorkspaceRoles.viewer,
    });
    expect(blockedReassignment.ok).toBe(false);
    if (!blockedReassignment.ok) {
      expect(blockedReassignment.error.code).toBe(WorkspaceRoleReassignmentErrorCodes.conflict);
      expect(blockedReassignment.error.message).toContain("retain at least one active owner or admin");
    }

    const blockedRevocation = await revokeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:admin",
      targetUserIdentityId: "user:admin",
      role: WorkspaceRoles.admin,
    });
    expect(blockedRevocation.ok).toBe(false);
    if (!blockedRevocation.ok) {
      expect(blockedRevocation.error.code).toBe(WorkspaceRoleRevocationErrorCodes.conflict);
      expect(blockedRevocation.error.message).toContain("retain at least one active owner or admin");
    }

    const invalidOwnerRevocation = await revokeUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:admin",
      targetUserIdentityId: "user:owner",
      role: WorkspaceRoles.owner,
    });
    expect(invalidOwnerRevocation.ok).toBe(false);
    if (!invalidOwnerRevocation.ok) {
      expect(invalidOwnerRevocation.error.code).toBe(WorkspaceRoleRevocationErrorCodes.invalidRequest);
    }
  });
});
