import { describe, expect, it } from "bun:test";
import {
  parseAssignWorkspaceRoleRequest,
  parseCreateWorkspaceRequest,
  parseListWorkspacesRequest,
  parseWorkspaceAdministrationViewResponse,
  WorkspaceTransportSchemaValidationError,
} from "../WorkspaceTransportSchemaContracts";

describe("WorkspaceTransportSchemaContracts", () => {
  it("parses list/create workspace requests", () => {
    const listRequest = parseListWorkspacesRequest({
      actorUserIdentityId: "user:admin",
      statuses: ["active"],
      visibility: "team",
      limit: 25,
      offset: 0,
    });
    expect(listRequest.visibility).toBe("team");

    const createRequest = parseCreateWorkspaceRequest({
      actorUserIdentityId: "user:admin",
      slug: "studio-alpha",
      displayName: "Studio Alpha",
      visibility: "private",
      status: "active",
    });
    expect(createRequest.slug).toBe("studio-alpha");
  });

  it("parses workspace admin view responses", () => {
    const serialized = JSON.stringify({
      ok: true,
      data: {
        workspace: {
          workspaceId: "workspace:alpha",
          slug: "studio-alpha",
          displayName: "Studio Alpha",
          status: "active",
          ownerUserIdentityId: "user:owner",
          visibility: "private",
          createdAt: "2026-04-06T10:00:00.000Z",
          lastModifiedAt: "2026-04-06T10:10:00.000Z",
        },
      },
    });
    const response = parseWorkspaceAdministrationViewResponse(JSON.parse(serialized));
    expect(response.data?.workspace.workspaceId).toBe("workspace:alpha");
  });

  it("rejects invalid workspace role assignment payloads", () => {
    expect(() => parseAssignWorkspaceRoleRequest({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace:alpha",
      targetUserIdentityId: "user:member",
      role: "invalid",
    })).toThrow(WorkspaceTransportSchemaValidationError);
  });
});
