export const WorkspaceAdministrationAuditEventTypes = Object.freeze({
  workspaceCreated: "workspace-created",
  workspaceUpdated: "workspace-updated",
  workspaceLifecycleTransitioned: "workspace-lifecycle-transitioned",
  membershipAdded: "workspace-membership-added",
  membershipStatusChanged: "workspace-membership-status-changed",
  roleAssigned: "workspace-role-assigned",
  roleReassigned: "workspace-role-reassigned",
  roleRevoked: "workspace-role-revoked",
  invitationIssued: "workspace-invitation-issued",
  invitationAccepted: "workspace-invitation-accepted",
});

export type WorkspaceAdministrationAuditEventType =
  typeof WorkspaceAdministrationAuditEventTypes[keyof typeof WorkspaceAdministrationAuditEventTypes];

export interface WorkspaceAdministrationAuditEvent {
  readonly type: WorkspaceAdministrationAuditEventType;
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly occurredAt: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceAdministrationAuditSink {
  recordWorkspaceAdministrationEvent(event: WorkspaceAdministrationAuditEvent): Promise<void>;
}

export async function publishWorkspaceAdministrationAuditEventBestEffort(
  auditSink: WorkspaceAdministrationAuditSink | undefined,
  event: WorkspaceAdministrationAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordWorkspaceAdministrationEvent(event);
  } catch {
    // Intentionally best-effort until the audit pipeline is integrated in a dedicated story.
  }
}
