import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";
import { WorkspaceInvitationBackendApi } from "../../../../api/workspaces/WorkspaceInvitationBackendApi";
import { WorkspaceAdministrationBackendApi } from "../../../../api/workspaces/WorkspaceAdministrationBackendApi";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { SqliteWorkspacePersistenceAdapter } from "../../../../../src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
} from "../../../../../src/domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../../../../src/shared/workspaces/WorkspaceOwnership";
import {
  IssueWorkspaceInvitationUseCase,
  type WorkspaceInvitationIssuanceClock,
  type WorkspaceInvitationIssuanceIdGenerator,
  type WorkspaceInvitationTokenIssuer,
  type WorkspaceInvitationTokenReference,
} from "../../../../../src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  type WorkspaceInvitationLifecycleClock,
  type WorkspaceInvitationLifecycleIdGenerator,
} from "../../../../../src/application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  type AuthenticatedWorkspaceOnboardingClock,
} from "../../../../../src/application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";
import type { WorkspaceIdNamespace } from "../../../../../src/shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceAdministrationQueryService } from "../../../../../src/application/workspaces/use-cases/WorkspaceAdministrationQueryService";
import { CreateWorkspaceUseCase } from "../../../../../src/application/workspaces/use-cases/CreateWorkspaceUseCase";
import { UpdateWorkspaceUseCase } from "../../../../../src/application/workspaces/use-cases/UpdateWorkspaceUseCase";
import { TransitionWorkspaceLifecycleUseCase } from "../../../../../src/application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase";
import { AddWorkspaceMemberUseCase } from "../../../../../src/application/workspaces/use-cases/AddWorkspaceMemberUseCase";
import { ChangeWorkspaceMembershipStatusUseCase } from "../../../../../src/application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase";
import { RemoveWorkspaceMemberUseCase } from "../../../../../src/application/workspaces/use-cases/RemoveWorkspaceMemberUseCase";
import { AssignWorkspaceRoleUseCase } from "../../../../../src/application/workspaces/use-cases/AssignWorkspaceRoleUseCase";
import { ReassignWorkspaceRoleUseCase } from "../../../../../src/application/workspaces/use-cases/ReassignWorkspaceRoleUseCase";
import { RevokeWorkspaceRoleUseCase } from "../../../../../src/application/workspaces/use-cases/RevokeWorkspaceRoleUseCase";
import { AuthorizationPolicyDecisionEvaluator } from "../../../../../src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { WorkspaceAuthorizationPolicyReadAdapter } from "../../../../../src/infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter";
import { createIdentityHttpServer } from "../IdentityHttpServer";

class FixedClock implements WorkspaceInvitationIssuanceClock, WorkspaceInvitationLifecycleClock, AuthenticatedWorkspaceOnboardingClock {
  public constructor(private readonly nowIso: string) {}

  public now(): Date {
    return new Date(this.nowIso);
  }
}

class SequenceIdGenerator implements WorkspaceInvitationIssuanceIdGenerator, WorkspaceInvitationLifecycleIdGenerator {
  private index = 0;

  public nextId(namespace: WorkspaceIdNamespace): string {
    this.index += 1;
    return `${namespace}:${this.index}`;
  }
}

class StaticTokenIssuer implements WorkspaceInvitationTokenIssuer {
  public issueTokenReference(): WorkspaceInvitationTokenReference {
    const token = "tok_join_123";
    return Object.freeze({
      token,
      tokenHash: createHash("sha256").update(token, "utf8").digest("hex"),
      tokenHint: "join_123",
    });
  }
}

const servers: Server[] = [];
const cleanup: Array<() => void> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
  while (cleanup.length > 0) {
    const dispose = cleanup.pop();
    dispose?.();
  }
});

async function startServer() {
  const harness = await createIdentityAuthTestHarness();
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-workspace-admin-http-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const workspaceRepository = new SqliteWorkspacePersistenceAdapter(path.join(root, "workspace.sqlite"));
  cleanup.push(() => workspaceRepository.dispose());

  const clock = new FixedClock("2026-04-05T12:00:00.000Z");
  const idGenerator = new SequenceIdGenerator();
  const lifecycleUseCase = new ResolveWorkspaceInvitationLifecycleUseCase({
    workspaceRepository,
    invitationRepository: workspaceRepository,
    membershipRepository: workspaceRepository,
    roleAssignmentRepository: workspaceRepository,
    authorizationReadRepository: workspaceRepository,
    transactionManager: workspaceRepository,
    idGenerator,
    clock,
  });

  const workspaceBackendApi = new WorkspaceInvitationBackendApi({
    issueWorkspaceInvitationUseCase: new IssueWorkspaceInvitationUseCase({
      invitationRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator,
      tokenIssuer: new StaticTokenIssuer(),
      clock,
    }),
    resolveAuthenticatedWorkspaceOnboardingUseCase: new ResolveAuthenticatedWorkspaceOnboardingUseCase({
      invitationLifecycleUseCase: lifecycleUseCase,
      clock,
    }),
  });

  const workspaceAuthorizationPolicyReadAdapter = new WorkspaceAuthorizationPolicyReadAdapter({
    workspaceAuthorizationReadRepository: workspaceRepository,
  });
  const workspaceAdministrationBackendApi = new WorkspaceAdministrationBackendApi({
    workspaceQueryService: new WorkspaceAdministrationQueryService({
      workspaceRepository,
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      invitationRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      clock,
    }),
    workspaceRepository,
    membershipRepository: workspaceRepository,
    roleAssignmentRepository: workspaceRepository,
    invitationRepository: workspaceRepository,
    authorizationReadRepository: workspaceRepository,
    createWorkspaceUseCase: new CreateWorkspaceUseCase({
      workspaceRepository,
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator,
      clock,
    }),
    updateWorkspaceUseCase: new UpdateWorkspaceUseCase({
      workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      clock,
    }),
    transitionWorkspaceLifecycleUseCase: new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      clock,
    }),
    addWorkspaceMemberUseCase: new AddWorkspaceMemberUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator,
      clock,
    }),
    changeWorkspaceMembershipStatusUseCase: new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      clock,
    }),
    removeWorkspaceMemberUseCase: new RemoveWorkspaceMemberUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      clock,
    }),
    assignWorkspaceRoleUseCase: new AssignWorkspaceRoleUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator,
      clock,
    }),
    reassignWorkspaceRoleUseCase: new ReassignWorkspaceRoleUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator,
      clock,
    }),
    revokeWorkspaceRoleUseCase: new RevokeWorkspaceRoleUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      clock,
    }),
    resolveWorkspaceInvitationLifecycleUseCase: lifecycleUseCase,
    authorizationPolicyDecisionEvaluator: new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: workspaceAuthorizationPolicyReadAdapter,
      sharingGrantReadRepository: workspaceAuthorizationPolicyReadAdapter,
      resourcePolicyMetadataReadRepository: workspaceAuthorizationPolicyReadAdapter,
      clock,
    }),
    workspaceAdministrationCapabilityResourceType: "workspace-administration",
    clock,
  });

  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    workspaceBackendApi,
    workspaceAdministrationBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return Object.freeze({
    baseUrl,
    workspaceRepository,
  });
}

async function registerAndLogin(
  baseUrl: string,
  input: { readonly username: string; readonly email: string },
): Promise<{ readonly userIdentityId: string; readonly sessionToken: string }> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      credential: { candidate: "StrongPass!2026" },
    }),
  });
  const registerBody = await registerResponse.json();
  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: input.username,
      credential: { candidate: "StrongPass!2026" },
    }),
  });
  const loginBody = await loginResponse.json();
  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId,
    sessionToken: loginBody.data.sessionToken,
  });
}

async function seedWorkspaceAdmin(
  workspaceRepository: SqliteWorkspacePersistenceAdapter,
  input: { readonly workspaceId: string; readonly ownerUserIdentityId: string; readonly memberUserIdentityId?: string },
): Promise<void> {
  const now = new Date("2026-04-05T11:00:00.000Z");
  await workspaceRepository.saveWorkspace(createWorkspace({
    id: input.workspaceId,
    slug: "alpha-workspace",
    displayName: "Alpha Workspace",
    ownerUserId: input.ownerUserIdentityId,
    createdBy: input.ownerUserIdentityId,
    visibility: WorkspaceVisibilities.team,
    status: WorkspaceStatuses.active,
    now,
  }));

  await workspaceRepository.saveMembership(createWorkspaceMembership({
    id: "workspace-membership:owner",
    workspaceId: input.workspaceId,
    userIdentityId: input.ownerUserIdentityId,
    status: WorkspaceMembershipStatuses.active,
    joinedAt: now.toISOString(),
    createdBy: input.ownerUserIdentityId,
    now,
  }));
  await workspaceRepository.saveRoleAssignment(createWorkspaceRoleAssignment({
    id: "workspace-role-assignment:owner",
    workspaceId: input.workspaceId,
    userIdentityId: input.ownerUserIdentityId,
    role: WorkspaceRoles.owner,
    status: WorkspaceRoleAssignmentStatuses.active,
    assignedBy: input.ownerUserIdentityId,
    assignedAt: now.toISOString(),
  }));

  if (input.memberUserIdentityId) {
    await workspaceRepository.saveMembership(createWorkspaceMembership({
      id: "workspace-membership:member",
      workspaceId: input.workspaceId,
      userIdentityId: input.memberUserIdentityId,
      status: WorkspaceMembershipStatuses.active,
      joinedAt: now.toISOString(),
      createdBy: input.ownerUserIdentityId,
      now,
    }));
    await workspaceRepository.saveRoleAssignment(createWorkspaceRoleAssignment({
      id: "workspace-role-assignment:member",
      workspaceId: input.workspaceId,
      userIdentityId: input.memberUserIdentityId,
      role: WorkspaceRoles.member,
      status: WorkspaceRoleAssignmentStatuses.active,
      assignedBy: input.ownerUserIdentityId,
      assignedAt: now.toISOString(),
    }));
  }
}

describe("IdentityHttpServer workspace administration routes", () => {
  it("serves workspace admin listing and view contracts", async () => {
    const { baseUrl, workspaceRepository } = await startServer();
    const owner = await registerAndLogin(baseUrl, { username: "workspace.admin.owner", email: "admin-owner@example.com" });
    await seedWorkspaceAdmin(workspaceRepository, {
      workspaceId: "workspace:alpha",
      ownerUserIdentityId: owner.userIdentityId,
    });

    const listResponse = await fetch(`${baseUrl}/api/v1/workspaces`, {
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
      },
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.workspaces).toHaveLength(1);
    expect(listBody.data.workspaces[0].workspaceId).toBe("workspace:alpha");
    expect(listBody.data.workspaces[0].membershipSummary.active).toBe(1);
    expect(listBody.data.workspaces[0].actorAccess.canAdministrate).toBe(true);
    expect(listBody.data.workspaces[0].actorAccess.capabilities.canManageWorkspaceSettings).toBe(true);
    expect(listBody.data.workspaces[0].actorAccess.capabilities.canManageMembers).toBe(true);
    expect(listBody.data.workspaces[0].actorAccess.capabilities.canManageInvitations).toBe(true);
    expect(listBody.data.workspaces[0].actorAccess.capabilities.canManageRoles).toBe(true);

    const viewResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/admin-view`, {
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
      },
    });
    expect(viewResponse.status).toBe(200);
    const viewBody = await viewResponse.json();
    expect(viewBody.ok).toBe(true);
    expect(viewBody.data.workspace.workspaceId).toBe("workspace:alpha");
    expect(viewBody.data.workspace.roleSummary.owner).toBeGreaterThanOrEqual(1);
  });

  it("supports workspace member, invitation, and role administration flows", async () => {
    const { baseUrl, workspaceRepository } = await startServer();
    const owner = await registerAndLogin(baseUrl, { username: "workspace.admin.owner.2", email: "admin-owner2@example.com" });
    const member = await registerAndLogin(baseUrl, { username: "workspace.admin.member.2", email: "admin-member2@example.com" });
    await seedWorkspaceAdmin(workspaceRepository, {
      workspaceId: "workspace:alpha",
      ownerUserIdentityId: owner.userIdentityId,
    });

    const addMember = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        targetUserIdentityId: member.userIdentityId,
        initialStatus: "active",
        roles: ["member"],
      }),
    });
    expect(addMember.status).toBe(200);
    const addMemberBody = await addMember.json();
    expect(addMemberBody.ok).toBe(true);
    expect(addMemberBody.data.membership.userIdentityId).toBe(member.userIdentityId);

    const listMembers = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/members`, {
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
      },
    });
    expect(listMembers.status).toBe(200);
    const listMembersBody = await listMembers.json();
    expect(listMembersBody.ok).toBe(true);
    expect(listMembersBody.data.memberships.some((entry: { userIdentityId: string }) => entry.userIdentityId === member.userIdentityId)).toBe(true);

    const assignRole = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/roles/assign`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        targetUserIdentityId: member.userIdentityId,
        role: "viewer",
        reason: "temporary",
      }),
    });
    expect(assignRole.status).toBe(200);
    const assignRoleBody = await assignRole.json();
    expect(assignRoleBody.ok).toBe(true);
    expect(assignRoleBody.data.roleAssignment.role).toBe("viewer");

    const issueInvitation = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        invitedEmail: "viewer@example.com",
        invitedRoles: ["viewer"],
      }),
    });
    expect(issueInvitation.status).toBe(200);
    const issueInvitationBody = await issueInvitation.json();
    expect(issueInvitationBody.ok).toBe(true);

    const listInvitations = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
      },
    });
    expect(listInvitations.status).toBe(200);
    const listInvitationsBody = await listInvitations.json();
    expect(listInvitationsBody.ok).toBe(true);
    expect(listInvitationsBody.data.invitations.length).toBeGreaterThanOrEqual(1);

    const cancelInvitation = await fetch(
      `${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations/${encodeURIComponent(issueInvitationBody.data.invitation.invitationId)}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(cancelInvitation.status).toBe(200);
    const cancelInvitationBody = await cancelInvitation.json();
    expect(cancelInvitationBody.ok).toBe(true);
    expect(cancelInvitationBody.data.invitation.status === "revoked" || cancelInvitationBody.data.invitation.status === "expired").toBe(true);
  });

  it("returns stable auth and validation failures for workspace admin routes", async () => {
    const { baseUrl } = await startServer();

    const missingAuth = await fetch(`${baseUrl}/api/v1/workspaces`);
    expect(missingAuth.status).toBe(401);
    const missingAuthBody = await missingAuth.json();
    expect(missingAuthBody.ok).toBe(false);
    expect(missingAuthBody.error.code).toBe("authentication-failed");

    const owner = await registerAndLogin(baseUrl, { username: "workspace.admin.owner.3", email: "admin-owner3@example.com" });

    const invalidCreate = await fetch(`${baseUrl}/api/v1/workspaces`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        slug: "",
        displayName: "",
      }),
    });
    expect(invalidCreate.status).toBe(400);
    const invalidCreateBody = await invalidCreate.json();
    expect(invalidCreateBody.ok).toBe(false);
    expect(invalidCreateBody.error.code).toBe("invalid-request");
    expect(Array.isArray(invalidCreateBody.error.validationErrors)).toBe(true);
  });

  it("denies workspace access mutations for non-admin members", async () => {
    const { baseUrl, workspaceRepository } = await startServer();
    const owner = await registerAndLogin(baseUrl, { username: "workspace.admin.owner.4", email: "admin-owner4@example.com" });
    const member = await registerAndLogin(baseUrl, { username: "workspace.admin.member.4", email: "admin-member4@example.com" });
    await seedWorkspaceAdmin(workspaceRepository, {
      workspaceId: "workspace:alpha",
      ownerUserIdentityId: owner.userIdentityId,
      memberUserIdentityId: member.userIdentityId,
    });

    const mutationResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/roles/assign`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${member.sessionToken}`,
      },
      body: JSON.stringify({
        targetUserIdentityId: owner.userIdentityId,
        role: "viewer",
        reason: "unauthorized attempt",
      }),
    });
    expect(mutationResponse.status).toBe(403);
    const mutationBody = await mutationResponse.json();
    expect(mutationBody.ok).toBe(false);
    expect(mutationBody.error.code).toBe("forbidden");

    const memberListResponse = await fetch(`${baseUrl}/api/v1/workspaces`, {
      headers: {
        authorization: `Bearer ${member.sessionToken}`,
      },
    });
    expect(memberListResponse.status).toBe(200);
    const memberListBody = await memberListResponse.json();
    expect(memberListBody.ok).toBe(true);
    expect(memberListBody.data.workspaces[0].actorAccess.capabilities.canManageWorkspaceSettings).toBe(false);
    expect(memberListBody.data.workspaces[0].actorAccess.capabilities.canManageMembers).toBe(false);
    expect(memberListBody.data.workspaces[0].actorAccess.capabilities.canManageInvitations).toBe(false);
    expect(memberListBody.data.workspaces[0].actorAccess.capabilities.canManageRoles).toBe(false);
  });
});
