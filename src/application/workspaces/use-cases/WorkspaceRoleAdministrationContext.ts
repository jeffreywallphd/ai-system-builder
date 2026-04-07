import type { WorkspaceIdNamespace } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";

export interface WorkspaceRoleAdministrationAuditContext {
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceRoleAdministrationClock {
  now(): Date;
}

export interface WorkspaceRoleAdministrationIdGenerator {
  nextId(namespace: WorkspaceIdNamespace): string;
}

export function normalizeWorkspaceRoleAdministrationAuditContext(
  audit?: WorkspaceRoleAdministrationAuditContext,
): WorkspaceRoleAdministrationAuditContext | undefined {
  if (!audit) {
    return undefined;
  }

  const reason = normalizeOptional(audit.reason);
  const correlationId = normalizeOptional(audit.correlationId);
  const metadata = audit.metadata && Object.keys(audit.metadata).length > 0
    ? Object.freeze({ ...audit.metadata })
    : undefined;

  if (!reason && !correlationId && !metadata) {
    return undefined;
  }

  return Object.freeze({
    reason,
    correlationId,
    metadata,
  });
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

