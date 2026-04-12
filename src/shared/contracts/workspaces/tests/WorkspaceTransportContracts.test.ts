import { describe, expect, it } from "bun:test";
import { WorkspaceTransportRoutes } from "../WorkspaceTransportContracts";

describe("WorkspaceTransportContracts", () => {
  it("defines canonical workspace transport routes", () => {
    expect(WorkspaceTransportRoutes.listWorkspaces).toBe("/api/v1/workspaces");
    expect(WorkspaceTransportRoutes.readWorkspaceAdministrationView).toContain(":workspaceId");
    expect(WorkspaceTransportRoutes.assignWorkspaceRole).toBe("/api/v1/workspaces/:workspaceId/roles/assign");
  });
});
