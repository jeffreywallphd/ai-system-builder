export interface RunRouteAuthenticatedWorkspaceContext {
  readonly actor: { readonly userIdentityId: string };
  readonly workspace: { readonly workspaceId: string };
  readonly session: { readonly authenticatedAt: string };
}

export function buildRunAuthorization(
  context: RunRouteAuthenticatedWorkspaceContext,
): Readonly<Record<string, string>> {
  return Object.freeze({
    actorUserIdentityId: context.actor.userIdentityId,
    activeWorkspaceId: context.workspace.workspaceId,
    authenticatedAt: context.session.authenticatedAt,
  });
}

export function toRunSubmissionApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  submission: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actorUserIdentityId: context.actor.userIdentityId,
    workspaceId: context.workspace.workspaceId,
    submission,
  });
}

export function toRunQueryApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  request: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...request,
    authorization: buildRunAuthorization(context),
  });
}

export function toRunDetailApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  runId: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    runId,
    workspaceId: context.workspace.workspaceId,
    authorization: buildRunAuthorization(context),
  });
}

export function toRunStatusApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  runId: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    runId,
    workspaceId: context.workspace.workspaceId,
    authorization: buildRunAuthorization(context),
  });
}

export function toRunCancellationApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  cancellation: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    workspaceId: context.workspace.workspaceId,
    authorization: buildRunAuthorization(context),
    cancellation,
  });
}

export function toRunRetryApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  retry: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    workspaceId: context.workspace.workspaceId,
    authorization: buildRunAuthorization(context),
    retry,
  });
}

export function toRunReleaseStaleReservationApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  release: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    workspaceId: context.workspace.workspaceId,
    authorization: buildRunAuthorization(context),
    release,
  });
}

export function toRunReevaluateDeferredRunsApiRequest(
  context: RunRouteAuthenticatedWorkspaceContext,
  reevaluate: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    workspaceId: context.workspace.workspaceId,
    authorization: buildRunAuthorization(context),
    reevaluate,
  });
}

export function toRunExecutionUpdateApiRequest(
  runId: string,
  senderNodeId: string,
  update: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    runId,
    senderNodeId,
    update,
  });
}

