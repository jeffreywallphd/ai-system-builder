
import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

interface AuthenticatedWorkspaceContext {
  readonly actor: { readonly userIdentityId: string };
  readonly workspace: { readonly workspaceId: string };
  readonly session: { readonly authenticatedAt: string };
}

interface AuthenticatedNodeContext {
  readonly nodeId: string;
}

interface CreateRunRouteFamilyHandlerDependencies {
  readonly options: {
    readonly authoritativeRunSubmissionBackendApi?: { submitRun(request: Readonly<Record<string, unknown>>): Promise<unknown> };
    readonly authoritativeRunQueryBackendApi?: {
      listRuns(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      getExecutionReadiness(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      getRunDetail(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      getRunStatus(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      listQueueStatus(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      listStaleSchedulingReservations(request: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
    readonly authoritativeRunMutationBackendApi?: {
      cancelRun(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      retryRun(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      releaseStaleSchedulingReservation(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      reevaluateDeferredSchedulingRuns(request: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
    readonly authoritativeRunExecutionUpdateBackendApi?: {
      ingestExecutionUpdate(request: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
    readonly nodeTrustBackendApi?: unknown;
    readonly backendApi: unknown;
    readonly transportTrust?: unknown;
  };
  readonly maxBodyBytes: number;
  readonly resolveRequestSearchParams: (requestUrl: string | undefined) => URLSearchParams;
  readonly requireAuthenticatedWorkspaceSession: (
    request: IncomingMessage,
    response: ServerResponse,
    requestId: string,
    backendApi: unknown,
    logger: unknown,
    transportTrust: unknown,
    workspaceOptions: {
      readonly missingWorkspaceMessage: string;
      readonly buildInvalidResponse: (message: string) => unknown;
    },
    handler: (context: AuthenticatedWorkspaceContext) => Promise<void>,
  ) => Promise<void>;
  readonly requireAuthenticatedNodeTransport: (
    request: IncomingMessage,
    response: ServerResponse,
    requestId: string,
    backendApi: unknown,
    nodeTrustBackendApi: unknown,
    logger: unknown,
    transportTrust: unknown,
    expectedNodeId: string,
    handler: (context: AuthenticatedNodeContext) => Promise<void>,
  ) => Promise<void>;
  readonly parseAndValidateRuntimeMutationBody: (
    request: IncomingMessage,
    maxBodyBytes: number,
    allowEmptyObject?: boolean,
  ) => Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly body: unknown }>;
  readonly parseAndValidateAuthoritativeRunSubmissionMutationRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, any>> } | { readonly ok: false; readonly body: unknown };
  readonly parseAndValidateAuthoritativeRunListReadRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly statusCode: number; readonly body: unknown };
  readonly parseAndValidateExecutionReadinessReadRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly statusCode: number; readonly body: unknown };
  readonly parseAndValidateAuthoritativeRunCancellationMutationRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly body: unknown };
  readonly parseAndValidateAuthoritativeRunRetryMutationRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly body: unknown };
  readonly parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, any>> } | { readonly ok: false; readonly body: unknown };
  readonly parseAndValidateAuthoritativeRunQueueStatusReadRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly statusCode: number; readonly body: unknown };
  readonly parseAndValidateSchedulingAdminStaleReservationsReadRequest: (
    input: Readonly<Record<string, unknown>>,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly statusCode: number; readonly body: unknown };
  readonly parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest: (
    payload: unknown,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, any>> } | { readonly ok: false; readonly body: unknown };
  readonly parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest: (
    payload: unknown,
  ) => { readonly ok: true; readonly data: Readonly<Record<string, any>> } | { readonly ok: false; readonly body: unknown };
  readonly decodePathTail: (path: string, prefix: string, suffix?: string) => string | undefined;
  readonly asRecord: (value: unknown) => Record<string, unknown> | undefined;
  readonly mapRunSubmissionStatusCode: (apiResponse: unknown) => number;
  readonly buildRuntimeInvalidRequestResponse: (message: string) => unknown;
  readonly writeJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  readonly logResponse: (
    logger: unknown,
    requestId: string,
    request: IncomingMessage,
    statusCode: number,
    requestPayload: unknown,
    responsePayload: unknown,
  ) => void;
  readonly runRoutes: {
    readonly startRun: string;
    readonly listRuns: string;
    readonly getExecutionReadiness: string;
    readonly listQueueStatus: string;
    readonly listSchedulingStaleReservations: string;
    readonly releaseSchedulingStaleReservation: string;
    readonly reevaluateSchedulingDeferredRuns: string;
  };
  readonly imageRunRoutes: {
    readonly listRuns: string;
  };
}

function buildAuthorization(context: AuthenticatedWorkspaceContext): Readonly<Record<string, string>> {
  return Object.freeze({
    actorUserIdentityId: context.actor.userIdentityId,
    activeWorkspaceId: context.workspace.workspaceId,
    authenticatedAt: context.session.authenticatedAt,
  });
}

export function createRunSubmissionRouteFamilyHandler(
  deps: CreateRunRouteFamilyHandlerDependencies,
): IdentityHttpRouteFamilyHandler {
  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!deps.options.authoritativeRunSubmissionBackendApi) {
      return Object.freeze({ handled: false });
    }
    if (method === "POST" && path === deps.runRoutes.startRun) {
      await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
      }, async (context) => {
        const parsedBody = await deps.parseAndValidateRuntimeMutationBody(request, deps.maxBodyBytes);
        if (!parsedBody.ok) {
          deps.writeJson(response, 400, parsedBody.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedBody.body);
          return;
        }
        const parsedRequest = deps.parseAndValidateAuthoritativeRunSubmissionMutationRequest({
          payload: parsedBody.value,
          actorUserIdentityId: context.actor.userIdentityId,
          workspaceId: context.workspace.workspaceId,
        });
        if (!parsedRequest.ok) {
          deps.writeJson(response, 400, parsedRequest.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedRequest.body);
          return;
        }
        const apiResponse = await deps.options.authoritativeRunSubmissionBackendApi!.submitRun({
          actorUserIdentityId: context.actor.userIdentityId,
          workspaceId: context.workspace.workspaceId,
          submission: parsedRequest.data,
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({
          workspaceId: context.workspace.workspaceId,
          actorUserIdentityId: context.actor.userIdentityId,
          runId: (apiResponse as any).data?.run?.runId,
          systemId: parsedRequest.data.runtimeTarget?.systemId,
          versionId: parsedRequest.data.runtimeTarget?.versionId,
        }), apiResponse);
      });
      return Object.freeze({ handled: true });
    }
    if (method === "POST" && path.startsWith("/api/v1/image-systems/") && path.endsWith("/runs")) {
      await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
      }, async (context) => {
        const systemId = deps.decodePathTail(path, "/api/v1/image-systems/", "/runs");
        if (!systemId) {
          const invalid = deps.buildRuntimeInvalidRequestResponse("workspaceId and systemId are required.");
          deps.writeJson(response, 400, invalid);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
          return;
        }
        const parsedBody = await deps.parseAndValidateRuntimeMutationBody(request, deps.maxBodyBytes);
        if (!parsedBody.ok) {
          deps.writeJson(response, 400, parsedBody.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, systemId }), parsedBody.body);
          return;
        }
        const payloadRecord = deps.asRecord(parsedBody.value);
        const runtimeTarget = deps.asRecord(payloadRecord?.runtimeTarget);
        const requestedSystemId = typeof runtimeTarget?.systemId === "string" ? runtimeTarget.systemId.trim() : undefined;
        if (requestedSystemId && requestedSystemId !== systemId) {
          const invalid = deps.buildRuntimeInvalidRequestResponse("runtimeTarget.systemId must match the systemId route parameter.");
          deps.writeJson(response, 400, invalid);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, systemId }), invalid);
          return;
        }
        const parsedRequest = deps.parseAndValidateAuthoritativeRunSubmissionMutationRequest({
          payload: Object.freeze({
            ...(payloadRecord ?? {}),
            runtimeTarget: Object.freeze({
              ...(runtimeTarget ?? {}),
              systemId,
            }),
          }),
          actorUserIdentityId: context.actor.userIdentityId,
          workspaceId: context.workspace.workspaceId,
        });
        if (!parsedRequest.ok) {
          deps.writeJson(response, 400, parsedRequest.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, systemId }), parsedRequest.body);
          return;
        }
        const apiResponse = await deps.options.authoritativeRunSubmissionBackendApi!.submitRun({
          actorUserIdentityId: context.actor.userIdentityId,
          workspaceId: context.workspace.workspaceId,
          submission: parsedRequest.data,
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({
          workspaceId: context.workspace.workspaceId,
          actorUserIdentityId: context.actor.userIdentityId,
          runId: (apiResponse as any).data?.run?.runId,
          systemId,
          versionId: parsedRequest.data.runtimeTarget?.versionId,
        }), apiResponse);
      });
      return Object.freeze({ handled: true });
    }
    return Object.freeze({ handled: false });
  };
}

export function createRunReadRouteFamilyHandler(
  deps: CreateRunRouteFamilyHandlerDependencies,
): IdentityHttpRouteFamilyHandler {
  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!deps.options.authoritativeRunQueryBackendApi) {
      return Object.freeze({ handled: false });
    }
    const searchParams = deps.resolveRequestSearchParams(request.url);
    if (method === "GET" && path === deps.runRoutes.listRuns) {
      await handleRunListRequest(deps, request, response, requestId, logger, searchParams);
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path === deps.imageRunRoutes.listRuns) {
      await handleRunListRequest(deps, request, response, requestId, logger, searchParams);
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path === deps.runRoutes.getExecutionReadiness) {
      await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
      }, async (context) => {
        const parsedRequest = deps.parseAndValidateExecutionReadinessReadRequest({
          workspaceId: context.workspace.workspaceId,
          searchParams,
        });
        if (!parsedRequest.ok) {
          deps.writeJson(response, parsedRequest.statusCode, parsedRequest.body);
          deps.logResponse(logger, requestId, request, parsedRequest.statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedRequest.body);
          return;
        }
        const apiResponse = await deps.options.authoritativeRunQueryBackendApi!.getExecutionReadiness({
          ...parsedRequest.data,
          authorization: buildAuthorization(context),
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, query: Object.fromEntries(searchParams.entries()) }), apiResponse);
      });
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path.startsWith("/api/v1/image-runs/") && !path.endsWith("/status") && !path.endsWith("/cancel") && !path.endsWith("/events")) {
      await handleRunDetailRequest(deps, request, response, requestId, logger, path, "/api/v1/image-runs/");
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path.startsWith("/api/v1/runtime/runs/") && !path.endsWith("/status") && !path.endsWith("/result") && !path.endsWith("/trace") && !path.endsWith("/cancel") && !path.endsWith("/retry") && !path.endsWith("/lifecycle") && !path.endsWith("/start")) {
      await handleRunDetailRequest(deps, request, response, requestId, logger, path, "/api/v1/runtime/runs/");
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path.startsWith("/api/v1/runtime/runs/") && path.endsWith("/status")) {
      await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
      }, async (context) => {
        const runId = deps.decodePathTail(path, "/api/v1/runtime/runs/", "/status");
        if (!runId) {
          const invalid = deps.buildRuntimeInvalidRequestResponse("workspaceId and runId are required.");
          deps.writeJson(response, 400, invalid);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
          return;
        }
        const apiResponse = await deps.options.authoritativeRunQueryBackendApi!.getRunStatus({
          runId,
          workspaceId: context.workspace.workspaceId,
          authorization: buildAuthorization(context),
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ runId, workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), apiResponse);
      });
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path === deps.runRoutes.listQueueStatus) {
      await handleQueueStatusRequest(deps, request, response, requestId, logger, searchParams);
      return Object.freeze({ handled: true });
    }
    if (method === "GET" && path === deps.runRoutes.listSchedulingStaleReservations) {
      await handleSchedulingStaleReservationsRequest(deps, request, response, requestId, logger, searchParams);
      return Object.freeze({ handled: true });
    }
    return Object.freeze({ handled: false });
  };
}

async function handleRunListRequest(
  deps: CreateRunRouteFamilyHandlerDependencies,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  logger: unknown,
  searchParams: URLSearchParams,
): Promise<void> {
  await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
    missingWorkspaceMessage: "workspaceId is required.",
    buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
  }, async (context) => {
    const parsedRequest = deps.parseAndValidateAuthoritativeRunListReadRequest({
      workspaceId: context.workspace.workspaceId,
      searchParams,
    });
    if (!parsedRequest.ok) {
      deps.writeJson(response, parsedRequest.statusCode, parsedRequest.body);
      deps.logResponse(logger, requestId, request, parsedRequest.statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedRequest.body);
      return;
    }
    const apiResponse = await deps.options.authoritativeRunQueryBackendApi!.listRuns({
      ...parsedRequest.data,
      authorization: buildAuthorization(context),
    });
    const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
    deps.writeJson(response, statusCode, apiResponse);
    deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, query: Object.fromEntries(searchParams.entries()) }), apiResponse);
  });
}

async function handleRunDetailRequest(
  deps: CreateRunRouteFamilyHandlerDependencies,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  logger: unknown,
  path: string,
  prefix: string,
): Promise<void> {
  await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
    missingWorkspaceMessage: "workspaceId is required.",
    buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
  }, async (context) => {
    const runId = deps.decodePathTail(path, prefix);
    if (!runId) {
      const invalid = deps.buildRuntimeInvalidRequestResponse("workspaceId and runId are required.");
      deps.writeJson(response, 400, invalid);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
      return;
    }
    const apiResponse = await deps.options.authoritativeRunQueryBackendApi!.getRunDetail({
      runId,
      workspaceId: context.workspace.workspaceId,
      authorization: buildAuthorization(context),
    });
    const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
    deps.writeJson(response, statusCode, apiResponse);
    deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ runId, workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), apiResponse);
  });
}

async function handleQueueStatusRequest(
  deps: CreateRunRouteFamilyHandlerDependencies,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  logger: unknown,
  searchParams: URLSearchParams,
): Promise<void> {
  await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
    missingWorkspaceMessage: "workspaceId is required.",
    buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
  }, async (context) => {
    const parsedRequest = deps.parseAndValidateAuthoritativeRunQueueStatusReadRequest({
      workspaceId: context.workspace.workspaceId,
      searchParams,
    });
    if (!parsedRequest.ok) {
      deps.writeJson(response, parsedRequest.statusCode, parsedRequest.body);
      deps.logResponse(logger, requestId, request, parsedRequest.statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId }), parsedRequest.body);
      return;
    }
    const apiResponse = await deps.options.authoritativeRunQueryBackendApi!.listQueueStatus({
      ...parsedRequest.data,
      authorization: buildAuthorization(context),
    });
    const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
    deps.writeJson(response, statusCode, apiResponse);
    deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, query: Object.fromEntries(searchParams.entries()) }), apiResponse);
  });
}

async function handleSchedulingStaleReservationsRequest(
  deps: CreateRunRouteFamilyHandlerDependencies,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  logger: unknown,
  searchParams: URLSearchParams,
): Promise<void> {
  await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
    missingWorkspaceMessage: "workspaceId is required.",
    buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
  }, async (context) => {
    const parsedRequest = deps.parseAndValidateSchedulingAdminStaleReservationsReadRequest({
      workspaceId: context.workspace.workspaceId,
      searchParams,
    });
    if (!parsedRequest.ok) {
      deps.writeJson(response, parsedRequest.statusCode, parsedRequest.body);
      deps.logResponse(logger, requestId, request, parsedRequest.statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId }), parsedRequest.body);
      return;
    }
    const apiResponse = await deps.options.authoritativeRunQueryBackendApi!.listStaleSchedulingReservations({
      ...parsedRequest.data,
      authorization: buildAuthorization(context),
    });
    const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
    deps.writeJson(response, statusCode, apiResponse);
    deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, query: Object.fromEntries(searchParams.entries()) }), apiResponse);
  });
}

export function createRunMutationRouteFamilyHandler(
  deps: CreateRunRouteFamilyHandlerDependencies,
): IdentityHttpRouteFamilyHandler {
  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!deps.options.authoritativeRunMutationBackendApi) {
      return Object.freeze({ handled: false });
    }
    if (method === "POST" && path.startsWith("/api/v1/image-runs/") && path.endsWith("/cancel")) {
      await cancelOrRetryRun("cancel", "/api/v1/image-runs/", request, response, requestId, logger, path, deps);
      return Object.freeze({ handled: true });
    }
    if (method === "POST" && path.startsWith("/api/v1/runtime/runs/") && path.endsWith("/cancel")) {
      await cancelOrRetryRun("cancel", "/api/v1/runtime/runs/", request, response, requestId, logger, path, deps);
      return Object.freeze({ handled: true });
    }
    if (method === "POST" && path.startsWith("/api/v1/runtime/runs/") && path.endsWith("/retry")) {
      await cancelOrRetryRun("retry", "/api/v1/runtime/runs/", request, response, requestId, logger, path, deps);
      return Object.freeze({ handled: true });
    }
    if (method === "POST" && path === deps.runRoutes.releaseSchedulingStaleReservation) {
      await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
      }, async (context) => {
        const parsedBody = await deps.parseAndValidateRuntimeMutationBody(request, deps.maxBodyBytes);
        if (!parsedBody.ok) {
          deps.writeJson(response, 400, parsedBody.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedBody.body);
          return;
        }
        const parsedRequest = deps.parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest(parsedBody.value);
        if (!parsedRequest.ok) {
          deps.writeJson(response, 400, parsedRequest.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedRequest.body);
          return;
        }
        const apiResponse = await deps.options.authoritativeRunMutationBackendApi!.releaseStaleSchedulingReservation({
          workspaceId: context.workspace.workspaceId,
          authorization: buildAuthorization(context),
          release: parsedRequest.data,
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, runId: parsedRequest.data.runId }), apiResponse);
      });
      return Object.freeze({ handled: true });
    }
    if (method === "POST" && path === deps.runRoutes.reevaluateSchedulingDeferredRuns) {
      await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
      }, async (context) => {
        const parsedBody = await deps.parseAndValidateRuntimeMutationBody(request, deps.maxBodyBytes, true);
        if (!parsedBody.ok) {
          deps.writeJson(response, 400, parsedBody.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedBody.body);
          return;
        }
        const parsedRequest = deps.parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest(parsedBody.value);
        if (!parsedRequest.ok) {
          deps.writeJson(response, 400, parsedRequest.body);
          deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId }), parsedRequest.body);
          return;
        }
        const apiResponse = await deps.options.authoritativeRunMutationBackendApi!.reevaluateDeferredSchedulingRuns({
          workspaceId: context.workspace.workspaceId,
          authorization: buildAuthorization(context),
          reevaluate: parsedRequest.data,
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({
          workspaceId: context.workspace.workspaceId,
          actorUserIdentityId: context.actor.userIdentityId,
          queueId: parsedRequest.data.queueId,
          runIds: parsedRequest.data.runIds,
        }), apiResponse);
      });
      return Object.freeze({ handled: true });
    }
    return Object.freeze({ handled: false });
  };
}

async function cancelOrRetryRun(
  action: "cancel" | "retry",
  routePrefix: string,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  logger: unknown,
  path: string,
  deps: CreateRunRouteFamilyHandlerDependencies,
): Promise<void> {
  await deps.requireAuthenticatedWorkspaceSession(request, response, requestId, deps.options.backendApi, logger, deps.options.transportTrust, {
    missingWorkspaceMessage: "workspaceId is required.",
    buildInvalidResponse: deps.buildRuntimeInvalidRequestResponse,
  }, async (context) => {
    const runId = deps.decodePathTail(path, routePrefix, action === "cancel" ? "/cancel" : "/retry");
    if (!runId) {
      const invalid = deps.buildRuntimeInvalidRequestResponse("workspaceId and runId are required.");
      deps.writeJson(response, 400, invalid);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
      return;
    }
    const parsedBody = await deps.parseAndValidateRuntimeMutationBody(request, deps.maxBodyBytes, true);
    if (!parsedBody.ok) {
      deps.writeJson(response, 400, parsedBody.body);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, runId }), parsedBody.body);
      return;
    }
    const parsedRequest = action === "cancel"
      ? deps.parseAndValidateAuthoritativeRunCancellationMutationRequest({ payload: parsedBody.value, runId, actorUserIdentityId: context.actor.userIdentityId })
      : deps.parseAndValidateAuthoritativeRunRetryMutationRequest({ payload: parsedBody.value, runId, actorUserIdentityId: context.actor.userIdentityId });
    if (!parsedRequest.ok) {
      deps.writeJson(response, 400, parsedRequest.body);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, runId }), parsedRequest.body);
      return;
    }
    const apiResponse = action === "cancel"
      ? await deps.options.authoritativeRunMutationBackendApi!.cancelRun({ workspaceId: context.workspace.workspaceId, authorization: buildAuthorization(context), cancellation: parsedRequest.data })
      : await deps.options.authoritativeRunMutationBackendApi!.retryRun({ workspaceId: context.workspace.workspaceId, authorization: buildAuthorization(context), retry: parsedRequest.data });
    const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
    deps.writeJson(response, statusCode, apiResponse);
    deps.logResponse(logger, requestId, request, statusCode, Object.freeze({ workspaceId: context.workspace.workspaceId, actorUserIdentityId: context.actor.userIdentityId, runId }), apiResponse);
  });
}

export function createRunExecutionUpdateRouteFamilyHandler(
  deps: CreateRunRouteFamilyHandlerDependencies,
): IdentityHttpRouteFamilyHandler {
  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!deps.options.authoritativeRunExecutionUpdateBackendApi || !deps.options.nodeTrustBackendApi) {
      return Object.freeze({ handled: false });
    }
    if (method !== "POST" || !path.startsWith("/api/v1/runtime/runs/") || !path.endsWith("/lifecycle")) {
      return Object.freeze({ handled: false });
    }
    const runId = deps.decodePathTail(path, "/api/v1/runtime/runs/", "/lifecycle");
    if (!runId) {
      const invalid = deps.buildRuntimeInvalidRequestResponse("runId is required.");
      deps.writeJson(response, 400, invalid);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
      return Object.freeze({ handled: true });
    }
    const parsedBody = await deps.parseAndValidateRuntimeMutationBody(request, deps.maxBodyBytes);
    if (!parsedBody.ok) {
      deps.writeJson(response, 400, parsedBody.body);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({ runId }), parsedBody.body);
      return Object.freeze({ handled: true });
    }
    const parsedRequest = deps.parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest({ payload: parsedBody.value, runId });
    if (!parsedRequest.ok) {
      deps.writeJson(response, 400, parsedRequest.body);
      deps.logResponse(logger, requestId, request, 400, Object.freeze({ runId }), parsedRequest.body);
      return Object.freeze({ handled: true });
    }
    await deps.requireAuthenticatedNodeTransport(
      request,
      response,
      requestId,
      deps.options.backendApi,
      deps.options.nodeTrustBackendApi,
      logger,
      deps.options.transportTrust,
      parsedRequest.data.senderNodeId,
      async (context) => {
        const apiResponse = await deps.options.authoritativeRunExecutionUpdateBackendApi!.ingestExecutionUpdate({
          runId,
          senderNodeId: context.nodeId,
          update: parsedRequest.data,
        });
        const statusCode = deps.mapRunSubmissionStatusCode(apiResponse);
        deps.writeJson(response, statusCode, apiResponse);
        deps.logResponse(logger, requestId, request, statusCode, Object.freeze({
          runId,
          senderNodeId: context.nodeId,
          toState: parsedRequest.data.toState,
          hasProgress: Boolean(parsedRequest.data.progress),
          hasHeartbeat: Boolean(parsedRequest.data.heartbeatAt || parsedRequest.data.execution?.heartbeatAt),
        }), apiResponse);
      },
    );
    return Object.freeze({ handled: true });
  };
}
