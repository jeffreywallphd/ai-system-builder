import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";
import { WorkspaceInvitationBackendApi } from "../../../../api/workspaces/WorkspaceInvitationBackendApi";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { SqliteWorkspacePersistenceAdapter } from "@infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import {
  IssueWorkspaceInvitationUseCase,
  type WorkspaceInvitationIssuanceClock,
  type WorkspaceInvitationIssuanceIdGenerator,
  type WorkspaceInvitationTokenIssuer,
  type WorkspaceInvitationTokenReference,
} from "@application/workspaces/use-cases/IssueWorkspaceInvitationUseCase";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  type WorkspaceInvitationLifecycleClock,
  type WorkspaceInvitationLifecycleIdGenerator,
} from "@application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  type AuthenticatedWorkspaceOnboardingClock,
} from "@application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";
import type { WorkspaceIdNamespace } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
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
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-workspace-http-"));
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

  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    workspaceBackendApi,
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

describe("IdentityHttpServer workspace invitation routes", () => {
  it("issues workspace invitations for authorized admins and accepts onboarding joins", async () => {
    const { baseUrl, workspaceRepository } = await startServer();
    const owner = await registerAndLogin(baseUrl, { username: "workspace.owner", email: "owner@example.com" });
    const member = await registerAndLogin(baseUrl, { username: "workspace.member", email: "member@example.com" });
    await seedWorkspaceAdmin(workspaceRepository, {
      workspaceId: "workspace:alpha",
      ownerUserIdentityId: owner.userIdentityId,
    });

    const issueResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        invitedEmail: "member@example.com",
        invitedRoles: ["member"],
      }),
    });
    expect(issueResponse.status).toBe(200);
    const issueBody = await issueResponse.json();
    expect(issueBody.ok).toBe(true);
    expect(issueBody.data.invitation.status).toBe("pending");
    expect(issueBody.data.invitation.invitationId).toBeDefined();
    expect(issueBody.data.invitation.invitationTokenHash).toBeUndefined();
    expect(issueBody.data.invitationToken).toBe("tok_join_123");

    const joinResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/onboarding/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${member.sessionToken}`,
      },
      body: JSON.stringify({
        invitationToken: "tok_join_123",
      }),
    });
    expect(joinResponse.status).toBe(200);
    const joinBody = await joinResponse.json();
    expect(joinBody.ok).toBe(true);
    expect(joinBody.data.invitation.status).toBe("accepted");
    expect(joinBody.data.membership.status).toBe("active");
    expect(joinBody.data.createdRoleAssignments).toHaveLength(1);
    expect(joinBody.data.createdRoleAssignments[0].role).toBe("member");
  });

  it("enforces workspace admin authorization when issuing invitations", async () => {
    const { baseUrl, workspaceRepository } = await startServer();
    const owner = await registerAndLogin(baseUrl, { username: "workspace.owner.2", email: "owner2@example.com" });
    const member = await registerAndLogin(baseUrl, { username: "workspace.member.2", email: "member2@example.com" });
    await seedWorkspaceAdmin(workspaceRepository, {
      workspaceId: "workspace:alpha",
      ownerUserIdentityId: owner.userIdentityId,
      memberUserIdentityId: member.userIdentityId,
    });

    const issueResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${member.sessionToken}`,
      },
      body: JSON.stringify({
        invitedEmail: "viewer@example.com",
        invitedRoles: ["viewer"],
      }),
    });
    expect(issueResponse.status).toBe(403);
    const issueBody = await issueResponse.json();
    expect(issueBody.ok).toBe(false);
    expect(issueBody.error.code).toBe("forbidden");
  });

  it("returns validation and auth failures with stable response shape", async () => {
    const { baseUrl } = await startServer();

    const missingAuth = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invitedEmail: "member@example.com",
        invitedRoles: ["member"],
      }),
    });
    expect(missingAuth.status).toBe(401);
    const missingAuthBody = await missingAuth.json();
    expect(missingAuthBody.ok).toBe(false);
    expect(missingAuthBody.error.code).toBe("authentication-failed");

    const owner = await registerAndLogin(baseUrl, { username: "workspace.owner.3", email: "owner3@example.com" });

    const invalidRequest = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.sessionToken}`,
      },
      body: JSON.stringify({
        invitedEmail: "not-an-email",
        invitedRoles: [],
      }),
    });
    expect(invalidRequest.status).toBe(400);
    const invalidBody = await invalidRequest.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
    expect(Array.isArray(invalidBody.error.validationErrors)).toBe(true);
  });

  it("maps bad onboarding token attempts to invalid-invite", async () => {
    const { baseUrl, workspaceRepository } = await startServer();
    const owner = await registerAndLogin(baseUrl, { username: "workspace.owner.4", email: "owner4@example.com" });
    const member = await registerAndLogin(baseUrl, { username: "workspace.member.4", email: "member4@example.com" });
    await seedWorkspaceAdmin(workspaceRepository, {
      workspaceId: "workspace:alpha",
      ownerUserIdentityId: owner.userIdentityId,
    });

    const joinResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace%3Aalpha/onboarding/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${member.sessionToken}`,
      },
      body: JSON.stringify({
        invitationToken: "tok_missing",
      }),
    });
    expect(joinResponse.status).toBe(400);
    const joinBody = await joinResponse.json();
    expect(joinBody.ok).toBe(false);
    expect(joinBody.error.code).toBe("invalid-invite");
  });
});

