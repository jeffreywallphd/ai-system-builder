import { describe, expect, it } from "bun:test";
import { HttpWorkspaceAdministrationClient } from "../WorkspaceAdministrationClient";

describe("HttpWorkspaceAdministrationClient", () => {
  it("calls workspace administration and invitation API endpoints with bearer auth", async () => {
    const requests: ReadonlyArray<{ method: string; url: string; body: string; authorization?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      (requests as Array<{ method: string; url: string; body: string; authorization?: string }>).push({
        method: String(init?.method ?? "GET"),
        url: input,
        body: String(init?.body ?? ""),
        authorization: headers?.authorization,
      });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new HttpWorkspaceAdministrationClient("http://127.0.0.1:8788/");
    await client.listWorkspaces({
      statuses: ["active", "suspended"],
      visibility: "team",
      limit: 25,
      offset: 10,
    }, "token-1");
    await client.createWorkspace({
      slug: "team-alpha",
      displayName: "Team Alpha",
      visibility: "private",
      status: "active",
    }, "token-2");
    await client.readWorkspaceAdministrationView({
      workspaceId: "workspace:alpha",
      asOf: "2026-04-05T10:00:00.000Z",
    }, "token-3");
    await client.updateWorkspace({
      workspaceId: "workspace:alpha",
      displayName: "Team Alpha Updated",
      visibility: "team",
    }, "token-4");
    await client.transitionWorkspaceLifecycle({
      workspaceId: "workspace:alpha",
      action: "suspend",
    }, "token-5");
    await client.listWorkspaceMemberships({
      workspaceId: "workspace:alpha",
      statuses: ["active", "pending"],
      limit: 50,
      offset: 0,
    }, "token-6");
    await client.addWorkspaceMember({
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:beta",
      roles: ["member"],
    }, "token-7");
    await client.changeWorkspaceMembershipStatus({
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:beta",
      status: "suspended",
    }, "token-8");
    await client.removeWorkspaceMember({
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:beta",
    }, "token-9");
    await client.listWorkspaceInvitations({
      workspaceId: "workspace:alpha",
      statuses: ["pending"],
      activeOnly: true,
      limit: 10,
      offset: 5,
    }, "token-10");
    await client.issueWorkspaceInvitation({
      workspaceId: "workspace:alpha",
      invitedEmail: "invitee@example.com",
      invitedRoles: ["member"],
      expiresInMs: 3600000,
    }, "token-11");
    await client.cancelWorkspaceInvitation({
      workspaceId: "workspace:alpha",
      invitationId: "invitation:1",
    }, "token-12");
    await client.listWorkspaceRoleAssignments({
      workspaceId: "workspace:alpha",
      roles: ["admin", "member"],
      statuses: ["active"],
      limit: 20,
      offset: 0,
    }, "token-13");
    await client.assignWorkspaceRole({
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:beta",
      role: "admin",
    }, "token-14");
    await client.reassignWorkspaceRole({
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:beta",
      fromRole: "member",
      toRole: "viewer",
    }, "token-15");
    await client.revokeWorkspaceRole({
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:beta",
      role: "viewer",
    }, "token-16");

    expect(requests.map((entry) => entry.method)).toEqual([
      "GET",
      "POST",
      "GET",
      "PATCH",
      "POST",
      "GET",
      "POST",
      "POST",
      "DELETE",
      "GET",
      "POST",
      "DELETE",
      "GET",
      "POST",
      "POST",
      "POST",
    ]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/workspaces?status=active&status=suspended&visibility=team&limit=25&offset=10",
      "http://127.0.0.1:8788/api/v1/workspaces",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/admin-view?asOf=2026-04-05T10%3A00%3A00.000Z",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/lifecycle",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/members?status=active&status=pending&limit=50&offset=0",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/members",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/members/user%3Abeta/status",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/members/user%3Abeta",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/invitations?status=pending&activeOnly=true&limit=10&offset=5",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/invitations",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/invitations/invitation%3A1",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/roles?role=admin&role=member&status=active&limit=20&offset=0",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/roles/assign",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/roles/reassign",
      "http://127.0.0.1:8788/api/v1/workspaces/workspace%3Aalpha/roles/revoke",
    ]);
    for (const [index, request] of requests.entries()) {
      expect(request.authorization).toBe(`Bearer token-${index + 1}`);
    }
  });
});
