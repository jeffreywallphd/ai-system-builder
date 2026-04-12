import type { URLSearchParams } from "node:url";

export interface AuditRouteAuthenticatedWorkspaceContext {
  readonly actor: {
    readonly userIdentityId: string;
  };
  readonly workspace: {
    readonly workspaceId: string;
  };
}

export function toAuditLedgerListApiRequest(
  context: AuditRouteAuthenticatedWorkspaceContext,
  query: unknown,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actorUserIdentityId: context.actor.userIdentityId,
    workspaceId: context.workspace.workspaceId,
    query,
  });
}

export function toAuditLedgerDetailApiRequest(
  context: AuditRouteAuthenticatedWorkspaceContext,
  eventId: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actorUserIdentityId: context.actor.userIdentityId,
    workspaceId: context.workspace.workspaceId,
    eventId,
  });
}

export function toAuditLedgerQueryLogPayload(searchParams: URLSearchParams): Readonly<Record<string, unknown>> {
  return Object.freeze({
    query: Object.fromEntries(searchParams.entries()),
  });
}

