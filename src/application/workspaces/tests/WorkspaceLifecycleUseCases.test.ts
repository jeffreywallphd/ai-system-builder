import { describe, expect, it } from "bun:test";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type Workspace,
  type WorkspaceMembership,
  type WorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
  WorkspaceListQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import {
  TransitionWorkspaceLifecycleUseCase,
  WorkspaceLifecycleActions,
  WorkspaceLifecycleTransitionErrorCodes,
  type WorkspaceLifecycleTransitionClock,
} from "../use-cases/TransitionWorkspaceLifecycleUseCase";
import {
  UpdateWorkspaceUseCase,
  WorkspaceUpdateErrorCodes,
  type WorkspaceUpdateClock,
} from "../use-cases/UpdateWorkspaceUseCase";
import { WorkspaceAdministrationAuditEventTypes, type WorkspaceAdministrationAuditEvent } from "../use-cases/WorkspaceAdministrationAudit";

class InMemoryWorkspaceLifecycleAdapter
  implements IWorkspaceRepository, IWorkspaceAuthorizationReadRepository {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly memberships = new Map<string, WorkspaceMembership>();
  public readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();

  public async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId.trim());
  }

  public async findWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const normalizedSlug = slug.trim().toLowerCase();
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === normalizedSlug) {
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

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = await this.findWorkspaceById(query.workspaceId);
    if (!workspace) {
      return undefined;
    }

    let membership: WorkspaceMembership | undefined;
    for (const candidate of this.memberships.values()) {
      if (
        candidate.workspaceId === query.workspaceId
        && candidate.userIdentityId === query.userIdentityId
      ) {
        membership = candidate;
        break;
      }
    }

    const activeRoleAssignments = [...this.roleAssignments.values()].filter((assignment) => (
      assignment.workspaceId === query.workspaceId
      && assignment.userIdentityId === query.userIdentityId
      && assignment.status === "active"
    ));
    const effectiveRoles = Object.freeze(
      [...new Set(activeRoleAssignments.map((assignment) => assignment.role))],
    );

    return Object.freeze({
      workspace,
      membership,
      activeRoleAssignments: Object.freeze(activeRoleAssignments),
      effectiveRoles,
      isWorkspaceOwner: effectiveRoles.includes(WorkspaceRoles.owner),
    });
  }
}

class FixedWorkspaceLifecycleClock implements WorkspaceUpdateClock, WorkspaceLifecycleTransitionClock {
  public constructor(private readonly fixedTime: string) {}

  public now(): Date {
    return new Date(this.fixedTime);
  }
}

function seedWorkspaceWithMember(
  adapter: InMemoryWorkspaceLifecycleAdapter,
  input: {
    readonly workspace: Workspace;
    readonly userIdentityId: string;
    readonly role: "owner" | "admin" | "member" | "viewer";
    readonly membershipStatus?: "pending" | "active" | "suspended" | "removed";
  },
): void {
  const now = new Date("2026-04-05T12:00:00.000Z");
  adapter.workspaces.set(input.workspace.id, input.workspace);
  adapter.memberships.set(`membership:${input.userIdentityId}`, createWorkspaceMembership({
    id: `membership:${input.userIdentityId}`,
    workspaceId: input.workspace.id,
    userIdentityId: input.userIdentityId,
    status: input.membershipStatus ?? WorkspaceMembershipStatuses.active,
    joinedAt: input.membershipStatus === WorkspaceMembershipStatuses.active ? now : undefined,
    createdBy: input.workspace.ownership.ownerUserId,
    now,
  }));
  adapter.roleAssignments.set(`role:${input.userIdentityId}`, createWorkspaceRoleAssignment({
    id: `role:${input.userIdentityId}`,
    workspaceId: input.workspace.id,
    userIdentityId: input.userIdentityId,
    role: input.role,
    assignedBy: input.workspace.ownership.ownerUserId,
    assignedAt: now,
  }));
}

describe("Workspace lifecycle use cases", () => {
  it("emits workspace administration audit hooks for update and lifecycle transitions", async () => {
    const adapter = new InMemoryWorkspaceLifecycleAdapter();
    const workspace = createWorkspace({
      id: "workspace:audit",
      slug: "team-audit",
      displayName: "Team Audit",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T11:00:00.000Z"),
    });
    seedWorkspaceWithMember(adapter, {
      workspace,
      userIdentityId: "user:owner",
      role: WorkspaceRoles.owner,
    });

    const events: WorkspaceAdministrationAuditEvent[] = [];
    const auditSink = {
      async recordWorkspaceAdministrationEvent(event: WorkspaceAdministrationAuditEvent): Promise<void> {
        events.push(event);
      },
    };

    const updateUseCase = new UpdateWorkspaceUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:00:00.000Z"),
      auditSink,
    });
    const lifecycleUseCase = new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:05:00.000Z"),
      auditSink,
    });

    const updated = await updateUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      displayName: "Team Audit Updated",
    });
    expect(updated.ok).toBe(true);

    const archived = await lifecycleUseCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      action: WorkspaceLifecycleActions.archive,
    });
    expect(archived.ok).toBe(true);

    expect(events.map((event) => event.type)).toEqual([
      WorkspaceAdministrationAuditEventTypes.workspaceUpdated,
      WorkspaceAdministrationAuditEventTypes.workspaceLifecycleTransitioned,
    ]);
  });

  it("updates workspace metadata for active admins and preserves protected fields", async () => {
    const adapter = new InMemoryWorkspaceLifecycleAdapter();
    const workspace = createWorkspace({
      id: "workspace:alpha",
      slug: "team-alpha",
      displayName: "Team Alpha",
      description: "Original",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      visibility: WorkspaceVisibilities.team,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T11:00:00.000Z"),
    });
    seedWorkspaceWithMember(adapter, {
      workspace,
      userIdentityId: "user:admin",
      role: WorkspaceRoles.admin,
    });

    const useCase = new UpdateWorkspaceUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:00:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:admin",
      displayName: "Team Alpha Renamed",
      description: "Updated metadata",
      visibility: WorkspaceVisibilities.private,
      encryptionPolicy: {
        encryptionMode: "customer-managed",
        keyScope: "workspace",
        allowWorkerDecryption: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.changed).toBe(true);
    expect(result.value.workspace.displayName).toBe("Team Alpha Renamed");
    expect(result.value.workspace.description).toBe("Updated metadata");
    expect(result.value.workspace.ownership.visibility).toBe(WorkspaceVisibilities.private);
    expect(result.value.workspace.encryptionPolicy).toEqual({
      encryptionMode: "customer-managed",
      contentEncryptionRequired: true,
      keyScope: "workspace",
      allowPreviewDecryption: false,
      allowWorkerDecryption: true,
    });
    expect(result.value.workspace.slug).toBe("team-alpha");
    expect(result.value.workspace.ownership.ownerUserId).toBe("user:owner");
  });

  it("rejects metadata updates for non-admin actors and empty update payloads", async () => {
    const adapter = new InMemoryWorkspaceLifecycleAdapter();
    const workspace = createWorkspace({
      id: "workspace:beta",
      slug: "team-beta",
      displayName: "Team Beta",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T11:00:00.000Z"),
    });
    seedWorkspaceWithMember(adapter, {
      workspace,
      userIdentityId: "user:member",
      role: WorkspaceRoles.member,
    });

    const useCase = new UpdateWorkspaceUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:00:00.000Z"),
    });

    const emptyPayload = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:member",
    });
    expect(emptyPayload.ok).toBe(false);
    if (!emptyPayload.ok) {
      expect(emptyPayload.error.code).toBe(WorkspaceUpdateErrorCodes.invalidRequest);
    }

    const forbidden = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:member",
      displayName: "Team Beta Updated",
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe(WorkspaceUpdateErrorCodes.forbidden);
    }
  });

  it("archives and reactivates workspaces through explicit lifecycle actions", async () => {
    const adapter = new InMemoryWorkspaceLifecycleAdapter();
    const workspace = createWorkspace({
      id: "workspace:gamma",
      slug: "team-gamma",
      displayName: "Team Gamma",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      visibility: WorkspaceVisibilities.private,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T11:00:00.000Z"),
    });
    seedWorkspaceWithMember(adapter, {
      workspace,
      userIdentityId: "user:owner",
      role: WorkspaceRoles.owner,
    });

    const useCase = new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:00:00.000Z"),
    });

    const archivedResult = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      action: WorkspaceLifecycleActions.archive,
    });
    expect(archivedResult.ok).toBe(true);
    if (!archivedResult.ok) {
      return;
    }
    expect(archivedResult.value.workspace.status).toBe(WorkspaceStatuses.archived);

    const reactivatedResult = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      action: WorkspaceLifecycleActions.reactivate,
    });
    expect(reactivatedResult.ok).toBe(true);
    if (!reactivatedResult.ok) {
      return;
    }
    expect(reactivatedResult.value.workspace.status).toBe(WorkspaceStatuses.active);
  });

  it("rejects forbidden and invalid lifecycle transitions predictably", async () => {
    const adapter = new InMemoryWorkspaceLifecycleAdapter();
    const workspace = createWorkspace({
      id: "workspace:delta",
      slug: "team-delta",
      displayName: "Team Delta",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      visibility: WorkspaceVisibilities.private,
      status: WorkspaceStatuses.archived,
      now: new Date("2026-04-05T11:00:00.000Z"),
    });
    seedWorkspaceWithMember(adapter, {
      workspace,
      userIdentityId: "user:admin",
      role: WorkspaceRoles.admin,
    });

    const useCase = new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:00:00.000Z"),
    });

    const forbiddenArchive = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:admin",
      action: WorkspaceLifecycleActions.archive,
    });
    expect(forbiddenArchive.ok).toBe(false);
    if (!forbiddenArchive.ok) {
      expect(forbiddenArchive.error.code).toBe(WorkspaceLifecycleTransitionErrorCodes.forbidden);
    }

    adapter.roleAssignments.set("role:user:owner", createWorkspaceRoleAssignment({
      id: "role:user:owner",
      workspaceId: workspace.id,
      userIdentityId: "user:owner",
      role: WorkspaceRoles.owner,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T12:00:00.000Z",
    }));
    adapter.memberships.set("membership:user:owner", createWorkspaceMembership({
      id: "membership:user:owner",
      workspaceId: workspace.id,
      userIdentityId: "user:owner",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    const invalidTransition = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      action: WorkspaceLifecycleActions.suspend,
    });
    expect(invalidTransition.ok).toBe(false);
    if (!invalidTransition.ok) {
      expect(invalidTransition.error.code).toBe(WorkspaceLifecycleTransitionErrorCodes.invalidTransition);
    }
  });

  it("returns unchanged for idempotent lifecycle actions", async () => {
    const adapter = new InMemoryWorkspaceLifecycleAdapter();
    const workspace = createWorkspace({
      id: "workspace:epsilon",
      slug: "team-epsilon",
      displayName: "Team Epsilon",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      visibility: WorkspaceVisibilities.private,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T11:00:00.000Z"),
    });
    seedWorkspaceWithMember(adapter, {
      workspace,
      userIdentityId: "user:owner",
      role: WorkspaceRoles.owner,
    });

    const useCase = new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceLifecycleClock("2026-04-05T13:00:00.000Z"),
    });

    const unchanged = await useCase.execute({
      workspaceId: workspace.id,
      actorUserIdentityId: "user:owner",
      action: WorkspaceLifecycleActions.activate,
    });
    expect(unchanged.ok).toBe(true);
    if (!unchanged.ok) {
      return;
    }
    expect(unchanged.value.changed).toBe(false);
    expect(unchanged.value.workspace.status).toBe(WorkspaceStatuses.active);
  });
});

