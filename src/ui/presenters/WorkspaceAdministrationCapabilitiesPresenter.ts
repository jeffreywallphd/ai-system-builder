import type { WorkspaceAdminListItemApiRecord } from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";

export interface WorkspaceAdministrationCapabilityViewModel {
  readonly canManageWorkspaceSettings: boolean;
  readonly canManageMembers: boolean;
  readonly canManageInvitations: boolean;
  readonly canManageRoles: boolean;
  readonly canAdministrate: boolean;
}

const deniedCapabilities: WorkspaceAdministrationCapabilityViewModel = Object.freeze({
  canManageWorkspaceSettings: false,
  canManageMembers: false,
  canManageInvitations: false,
  canManageRoles: false,
  canAdministrate: false,
});

export function presentWorkspaceAdministrationCapabilities(
  workspace: WorkspaceAdminListItemApiRecord | undefined,
): WorkspaceAdministrationCapabilityViewModel {
  if (!workspace) {
    return deniedCapabilities;
  }

  const fallback = workspace.actorAccess.canAdministrate;
  const capabilities = workspace.actorAccess.capabilities;

  const canManageWorkspaceSettings = capabilities?.canManageWorkspaceSettings ?? fallback;
  const canManageMembers = capabilities?.canManageMembers ?? fallback;
  const canManageInvitations = capabilities?.canManageInvitations ?? fallback;
  const canManageRoles = capabilities?.canManageRoles ?? fallback;

  return Object.freeze({
    canManageWorkspaceSettings,
    canManageMembers,
    canManageInvitations,
    canManageRoles,
    canAdministrate: canManageWorkspaceSettings || canManageMembers || canManageInvitations || canManageRoles,
  });
}

