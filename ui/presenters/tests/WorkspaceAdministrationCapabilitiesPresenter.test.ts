import { describe, expect, it } from "bun:test";
import type { WorkspaceAdminListItemApiRecord } from "../../../infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import { presentWorkspaceAdministrationCapabilities } from "../WorkspaceAdministrationCapabilitiesPresenter";

describe("WorkspaceAdministrationCapabilitiesPresenter", () => {
  it("returns denied capabilities when workspace context is missing", () => {
    const presented = presentWorkspaceAdministrationCapabilities(undefined);
    expect(presented.canAdministrate).toBe(false);
    expect(presented.canManageMembers).toBe(false);
  });

  it("uses actor capability flags when available", () => {
    const workspace = {
      actorAccess: {
        canAdministrate: false,
        capabilities: {
          canManageWorkspaceSettings: true,
          canManageMembers: true,
          canManageInvitations: false,
          canManageRoles: true,
        },
      },
    } as unknown as WorkspaceAdminListItemApiRecord;

    const presented = presentWorkspaceAdministrationCapabilities(workspace);
    expect(presented.canManageWorkspaceSettings).toBe(true);
    expect(presented.canManageMembers).toBe(true);
    expect(presented.canManageInvitations).toBe(false);
    expect(presented.canManageRoles).toBe(true);
    expect(presented.canAdministrate).toBe(true);
  });

  it("falls back to canAdministrate when capability flags are not present", () => {
    const workspace = {
      actorAccess: {
        canAdministrate: true,
      },
    } as unknown as WorkspaceAdminListItemApiRecord;

    const presented = presentWorkspaceAdministrationCapabilities(workspace);
    expect(presented.canManageWorkspaceSettings).toBe(true);
    expect(presented.canManageMembers).toBe(true);
    expect(presented.canManageInvitations).toBe(true);
    expect(presented.canManageRoles).toBe(true);
  });
});
