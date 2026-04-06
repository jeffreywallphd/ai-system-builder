import { describe, expect, it } from "bun:test";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  type Workspace,
  type WorkspaceMembership,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  CreateWorkspaceUseCase,
  WorkspaceCreationErrorCodes,
  type WorkspaceCreationAuditSink,
  type WorkspaceCreationAuthorizationHook,
  type WorkspaceCreationClock,
  type WorkspaceCreationIdGenerator,
} from "../use-cases/CreateWorkspaceUseCase";
import { WorkspaceAdministrationAuditEventTypes } from "../use-cases/WorkspaceAdministrationAudit";
import type {
  WorkspaceIdNamespace,
  WorkspaceMembershipListQuery,
  WorkspaceRoleAssignmentListQuery,
  WorkspaceListQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";

class InMemoryWorkspaceInitializationAdapter
  implements
    IWorkspaceRepository,
    IWorkspaceMembershipRepository,
    IWorkspaceRoleAssignmentRepository,
    IWorkspaceTransactionManager {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly memberships = new Map<string, WorkspaceMembership>();
  public readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();
  public failRoleAssignmentSave = false;

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

  public async listWorkspaces(_query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>> {
    return Object.freeze([...this.workspaces.values()]);
  }

  public async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
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

  public async listMemberships(_query: WorkspaceMembershipListQuery): Promise<ReadonlyArray<WorkspaceMembership>> {
    return Object.freeze([...this.memberships.values()]);
  }

  public async saveMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership> {
    this.memberships.set(membership.id, membership);
    return membership;
  }

  public async findRoleAssignmentById(roleAssignmentId: string): Promise<WorkspaceRoleAssignment | undefined> {
    return this.roleAssignments.get(roleAssignmentId.trim());
  }

  public async listRoleAssignments(_query: WorkspaceRoleAssignmentListQuery): Promise<ReadonlyArray<WorkspaceRoleAssignment>> {
    return Object.freeze([...this.roleAssignments.values()]);
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
    if (this.failRoleAssignmentSave) {
      throw new Error("Simulated role assignment persistence failure.");
    }
    this.roleAssignments.set(roleAssignment.id, roleAssignment);
    return roleAssignment;
  }

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const workspaceSnapshot = new Map(this.workspaces);
    const membershipSnapshot = new Map(this.memberships);
    const roleAssignmentSnapshot = new Map(this.roleAssignments);
    try {
      return await operation();
    } catch (error) {
      this.workspaces.clear();
      this.memberships.clear();
      this.roleAssignments.clear();
      for (const [key, value] of workspaceSnapshot) {
        this.workspaces.set(key, value);
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

class StubWorkspaceCreationIdGenerator implements WorkspaceCreationIdGenerator {
  private readonly ids = Object.freeze({
    workspace: "workspace:created",
    membership: "workspace-membership:created",
    roleAssignment: "workspace-role-assignment:created",
  });

  public nextId(namespace: WorkspaceIdNamespace): string {
    if (namespace === "workspace") {
      return this.ids.workspace;
    }
    if (namespace === "workspace-membership") {
      return this.ids.membership;
    }
    if (namespace === "workspace-role-assignment") {
      return this.ids.roleAssignment;
    }
    return `unexpected:${namespace}`;
  }
}

class StubWorkspaceCreationClock implements WorkspaceCreationClock {
  public now(): Date {
    return new Date("2026-04-05T16:00:00.000Z");
  }
}

describe("CreateWorkspaceUseCase", () => {
  it("creates a workspace with active creator membership and owner role assignment", async () => {
    const adapter = new InMemoryWorkspaceInitializationAdapter();
    let auditedEventType: string | undefined;
    const useCase = new CreateWorkspaceUseCase({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      transactionManager: adapter,
      idGenerator: new StubWorkspaceCreationIdGenerator(),
      clock: new StubWorkspaceCreationClock(),
      auditSink: {
        async recordWorkspaceAdministrationEvent(event) {
          auditedEventType = event.type;
        },
      } satisfies WorkspaceCreationAuditSink,
    });

    const result = await useCase.execute({
      slug: "Team-Alpha",
      displayName: "Team Alpha",
      description: "Alpha workspace",
      visibility: WorkspaceVisibilities.team,
      encryptionPolicy: {
        encryptionMode: "customer-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: true,
      },
      actorUserIdentityId: "user:owner",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.workspace.status).toBe(WorkspaceStatuses.active);
    expect(result.value.workspace.slug).toBe("team-alpha");
    expect(result.value.workspace.ownership.createdBy).toBe("user:owner");
    expect(result.value.workspace.ownership.lastModifiedBy).toBe("user:owner");
    expect(result.value.workspace.ownership.createdAt).toBe("2026-04-05T16:00:00.000Z");
    expect(result.value.workspace.encryptionPolicy).toEqual({
      encryptionMode: "customer-managed",
      contentEncryptionRequired: true,
      keyScope: "workspace",
      allowPreviewDecryption: false,
      allowWorkerDecryption: true,
    });
    expect(result.value.creatorMembership.status).toBe(WorkspaceMembershipStatuses.active);
    expect(result.value.creatorMembership.joinedAt).toBe("2026-04-05T16:00:00.000Z");
    expect(result.value.creatorRoleAssignment.role).toBe(WorkspaceRoles.owner);
    expect(auditedEventType).toBe(WorkspaceAdministrationAuditEventTypes.workspaceCreated);

    expect(adapter.workspaces.size).toBe(1);
    expect(adapter.memberships.size).toBe(1);
    expect(adapter.roleAssignments.size).toBe(1);
  });

  it("rejects invalid workspace creation input predictably", async () => {
    const adapter = new InMemoryWorkspaceInitializationAdapter();
    const useCase = new CreateWorkspaceUseCase({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      transactionManager: adapter,
      idGenerator: new StubWorkspaceCreationIdGenerator(),
      clock: new StubWorkspaceCreationClock(),
    });

    const result = await useCase.execute({
      slug: "INVALID SLUG",
      displayName: "Team Alpha",
      actorUserIdentityId: "user:owner",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(WorkspaceCreationErrorCodes.invalidRequest);
    expect(adapter.workspaces.size).toBe(0);
    expect(adapter.memberships.size).toBe(0);
    expect(adapter.roleAssignments.size).toBe(0);
  });

  it("rejects duplicate workspace slugs before initialization writes", async () => {
    const adapter = new InMemoryWorkspaceInitializationAdapter();
    await adapter.saveWorkspace(createWorkspace({
      id: "workspace:existing",
      slug: "team-alpha",
      displayName: "Team Alpha Existing",
      ownerUserId: "user:existing",
      createdBy: "user:existing",
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T15:00:00.000Z"),
    }));

    const useCase = new CreateWorkspaceUseCase({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      transactionManager: adapter,
      idGenerator: new StubWorkspaceCreationIdGenerator(),
      clock: new StubWorkspaceCreationClock(),
    });

    const result = await useCase.execute({
      slug: "TEAM-ALPHA",
      displayName: "Team Alpha",
      actorUserIdentityId: "user:owner",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(WorkspaceCreationErrorCodes.duplicate);
    expect(adapter.workspaces.size).toBe(1);
    expect(adapter.memberships.size).toBe(0);
    expect(adapter.roleAssignments.size).toBe(0);
  });

  it("supports authorization hook gating for valid actors", async () => {
    const adapter = new InMemoryWorkspaceInitializationAdapter();
    const authorizationHook: WorkspaceCreationAuthorizationHook = {
      async assertCanCreateWorkspace() {
        throw new Error("Actor is not allowed to create workspaces.");
      },
    };
    const useCase = new CreateWorkspaceUseCase({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      transactionManager: adapter,
      idGenerator: new StubWorkspaceCreationIdGenerator(),
      clock: new StubWorkspaceCreationClock(),
      authorizationHook,
    });

    const result = await useCase.execute({
      slug: "team-alpha",
      displayName: "Team Alpha",
      actorUserIdentityId: "user:owner",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(WorkspaceCreationErrorCodes.forbidden);
    expect(adapter.workspaces.size).toBe(0);
    expect(adapter.memberships.size).toBe(0);
    expect(adapter.roleAssignments.size).toBe(0);
  });

  it("rolls back partial initialization when one create step fails inside a transaction", async () => {
    const adapter = new InMemoryWorkspaceInitializationAdapter();
    adapter.failRoleAssignmentSave = true;
    const useCase = new CreateWorkspaceUseCase({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      transactionManager: adapter,
      idGenerator: new StubWorkspaceCreationIdGenerator(),
      clock: new StubWorkspaceCreationClock(),
    });

    const result = await useCase.execute({
      slug: "team-alpha",
      displayName: "Team Alpha",
      actorUserIdentityId: "user:owner",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(WorkspaceCreationErrorCodes.invalidState);
    expect(adapter.workspaces.size).toBe(0);
    expect(adapter.memberships.size).toBe(0);
    expect(adapter.roleAssignments.size).toBe(0);
  });
});
