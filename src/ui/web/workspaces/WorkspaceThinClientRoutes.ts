export function buildWorkspaceInvitationAcceptPath(workspaceId: string, invitationToken: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationToken)}/accept`;
}
