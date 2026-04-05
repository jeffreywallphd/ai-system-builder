import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuthProvider, CredentialPolicy } from "../../../src/domain/identity/IdentityDomain";
import { IdentityProviderAccountPolicyConfig } from "../../../infrastructure/config/IdentityProviderAccountPolicyConfig";
import { SqliteWorkspacePersistenceAdapter } from "../../../src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
} from "../../../src/domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../../src/shared/workspaces/WorkspaceOwnership";
import { applyIdentityStartupConfiguration, startIdentityServerHost } from "../IdentityServerHost";

class InMemoryIdentityDefaultConfigurationRepository {
  public readonly providers = new Map<string, AuthProvider>();
  public readonly policies = new Map<string, CredentialPolicy>();

  public async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.providers.set(provider.id, provider);
    return provider;
  }

  public async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.policies.set(policy.id, policy);
    return policy;
  }
}

describe("IdentityServerHost", () => {
  it("applies default startup identity configuration", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig();

    await applyIdentityStartupConfiguration(repository, policies);

    const provider = repository.providers.get("provider:local-password");
    const credentialPolicy = repository.policies.get("policy:local-password");
    expect(provider?.status).toBe("active");
    expect(provider?.displayName).toBe("Local Password");
    expect(credentialPolicy?.minLength).toBe(12);
    expect(credentialPolicy?.maxFailedAttempts).toBe(5);
  });

  it("seeds a disabled local provider and overridden credential policy defaults when configured", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig({
      localProviderEnabled: false,
      allowLocalRegistration: false,
      localCredentialPolicyDefaults: {
        minLength: 16,
        passwordHistoryCount: 20,
        blockedSubstrings: ["admin", "password"],
      },
    });

    await applyIdentityStartupConfiguration(repository, policies);

    const provider = repository.providers.get("provider:local-password");
    const credentialPolicy = repository.policies.get("policy:local-password");
    expect(provider?.status).toBe("disabled");
    expect(credentialPolicy?.minLength).toBe(16);
    expect(credentialPolicy?.passwordHistoryCount).toBe(20);
    expect(credentialPolicy?.blockedSubstrings).toEqual(["admin", "password"]);
  });

  it("does not seed provider or policy records when startup seeding is disabled", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig({
      bootstrapSeedDefaults: false,
    });

    await applyIdentityStartupConfiguration(repository, policies);

    expect(repository.providers.size).toBe(0);
    expect(repository.policies.size).toBe(0);
  });

  it("boots the runtime host with seeded local provider/policy and serves lifecycle endpoints", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-host-test-"));
    const databasePath = join(tempDirectory, "identity-host.sqlite");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
    });

    try {
      const loginBeforeRegister = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "host.lifecycle.user",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(loginBeforeRegister.status).toBe(401);

      const register = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "host.lifecycle.user",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(register.status).toBe(200);
      const registerBody = await register.json();
      expect(registerBody.ok).toBe(true);
      expect(registerBody.data.providerId).toBe("provider:local-password");
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("exposes workspace invitation issuance and onboarding routes on the runtime host", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-workspace-host-test-"));
    const databasePath = join(tempDirectory, "identity-workspace-host.sqlite");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
    });

    try {
      const ownerRegisterResponse = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "workspace.owner.host",
          email: "owner.host@example.com",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const ownerRegisterBody = await ownerRegisterResponse.json();

      const ownerLoginResponse = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerSubject: "workspace.owner.host",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const ownerLoginBody = await ownerLoginResponse.json();

      const memberRegisterResponse = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "workspace.member.host",
          email: "member.host@example.com",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const memberRegisterBody = await memberRegisterResponse.json();
      expect(memberRegisterBody.ok).toBe(true);

      const workspaceRepository = new SqliteWorkspacePersistenceAdapter(databasePath);
      const now = new Date("2026-04-05T11:00:00.000Z");
      await workspaceRepository.saveWorkspace(createWorkspace({
        id: "workspace:alpha",
        slug: "host-workspace-alpha",
        displayName: "Host Workspace Alpha",
        ownerUserId: ownerRegisterBody.data.userIdentityId,
        createdBy: ownerRegisterBody.data.userIdentityId,
        visibility: WorkspaceVisibilities.team,
        status: WorkspaceStatuses.active,
        now,
      }));
      await workspaceRepository.saveMembership(createWorkspaceMembership({
        id: "workspace-membership:owner",
        workspaceId: "workspace:alpha",
        userIdentityId: ownerRegisterBody.data.userIdentityId,
        status: WorkspaceMembershipStatuses.active,
        joinedAt: now.toISOString(),
        createdBy: ownerRegisterBody.data.userIdentityId,
        now,
      }));
      await workspaceRepository.saveRoleAssignment(createWorkspaceRoleAssignment({
        id: "workspace-role-assignment:owner",
        workspaceId: "workspace:alpha",
        userIdentityId: ownerRegisterBody.data.userIdentityId,
        role: WorkspaceRoles.owner,
        status: WorkspaceRoleAssignmentStatuses.active,
        assignedBy: ownerRegisterBody.data.userIdentityId,
        assignedAt: now.toISOString(),
      }));
      workspaceRepository.dispose();

      const listWorkspacesResponse = await fetch(`http://${host.address}/api/v1/workspaces`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${ownerLoginBody.data.sessionToken}`,
        },
      });
      expect(listWorkspacesResponse.status).toBe(200);
      const listWorkspacesBody = await listWorkspacesResponse.json();
      expect(listWorkspacesBody.ok).toBe(true);
      expect(listWorkspacesBody.data.workspaces[0].workspaceId).toBe("workspace:alpha");

      const workspaceAdminViewResponse = await fetch(`http://${host.address}/api/v1/workspaces/workspace%3Aalpha/admin-view`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${ownerLoginBody.data.sessionToken}`,
        },
      });
      expect(workspaceAdminViewResponse.status).toBe(200);
      const workspaceAdminViewBody = await workspaceAdminViewResponse.json();
      expect(workspaceAdminViewBody.ok).toBe(true);
      expect(workspaceAdminViewBody.data.workspace.workspaceId).toBe("workspace:alpha");

      const issueResponse = await fetch(`http://${host.address}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ownerLoginBody.data.sessionToken}`,
        },
        body: JSON.stringify({
          invitedEmail: "member.host@example.com",
          invitedRoles: ["member"],
        }),
      });
      expect(issueResponse.status).toBe(200);
      const issueBody = await issueResponse.json();
      expect(issueBody.ok).toBe(true);

      const memberLoginResponse = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerSubject: "workspace.member.host",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const memberLoginBody = await memberLoginResponse.json();

      const acceptResponse = await fetch(`http://${host.address}/api/v1/workspaces/workspace%3Aalpha/onboarding/accept`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${memberLoginBody.data.sessionToken}`,
        },
        body: JSON.stringify({
          invitationToken: issueBody.data.invitationToken,
        }),
      });
      expect(acceptResponse.status).toBe(200);
      const acceptBody = await acceptResponse.json();
      expect(acceptBody.ok).toBe(true);
      expect(acceptBody.data.invitation.status).toBe("accepted");
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
