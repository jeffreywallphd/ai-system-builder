import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";
import {
  buildExecutionNodeBackendAvailabilityRequestPayload,
  buildExecutionNodeListRequestPayload,
  buildExecutionNodeReadinessRequestPayload,
  toExecutionNodeActorScopedApiRequest,
  toExecutionNodeGetApiRequest,
} from "../dto/ExecutionNodeManagementRouteDtoMapper";

interface AuthenticatedSessionContext {
  readonly principal: {
    readonly userIdentityId: string;
  };
}

interface CreateExecutionNodeManagementRouteFamilyHandlerDependencies {
  readonly options: {
    readonly executionNodeManagementBackendApi?: {
      listNodes(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      checkReadiness(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      checkEligibility(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      listBackendAvailability(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      setAvailabilityOverride(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      getNode(request: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
    readonly backendApi: unknown;
    readonly transportTrust?: unknown;
  };
  readonly maxBodyBytes: number;
  readonly resolveRequestSearchParams: (requestUrl: string | undefined) => URLSearchParams;
  readonly parseOptionalStringList: (searchParams: URLSearchParams, singularKey: string, pluralKey: string) => ReadonlyArray<string> | undefined;
  readonly parseOptionalBoolean: (value: string | null | undefined) => boolean | undefined;
  readonly parseOptionalInteger: (value: string | null | undefined) => number | undefined;
  readonly normalizeOptionalString: (value: string | null | undefined) => string | undefined;
  readonly requireAuthenticatedSession: (
    request: IncomingMessage,
    response: ServerResponse,
    requestId: string,
    backendApi: unknown,
    logger: unknown,
    transportTrust: unknown,
    sessionOptions: unknown,
    handler: (context: AuthenticatedSessionContext) => Promise<void>,
  ) => Promise<void>;
  readonly parseExecutionNodeListRequestDto: (payload: unknown) => Readonly<Record<string, unknown>>;
  readonly parseExecutionNodeReadinessCheckRequestDto: (payload: unknown) => Readonly<Record<string, unknown>>;
  readonly parseExecutionNodeEligibilityCheckRequestDto: (payload: unknown) => Readonly<Record<string, unknown>>;
  readonly parseExecutionNodeBackendAvailabilityReadRequestDto: (payload: unknown) => Readonly<Record<string, unknown>>;
  readonly parseAndValidateExecutionNodeSetAvailabilityOverrideRequest: (
    request: IncomingMessage,
    actorUserIdentityId: string,
    nodeId: string,
    requestId: string,
    logger: unknown,
    maxBodyBytes: number,
  ) => Promise<{ readonly ok: true; readonly data: Readonly<Record<string, unknown>> } | { readonly ok: false; readonly statusCode: number; readonly body: unknown }>;
  readonly buildExecutionNodeManagementValidationErrorResponse: (error: unknown) => unknown;
  readonly buildExecutionNodeManagementInvalidRequestResponse: (message: string) => unknown;
  readonly mapExecutionNodeManagementStatusCode: (apiResponse: unknown) => number;
  readonly decodePathTail: (path: string, prefix: string, suffix?: string) => string | undefined;
  readonly writeJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  readonly logResponse: (
    logger: unknown,
    requestId: string,
    request: IncomingMessage,
    statusCode: number,
    requestPayload: unknown,
    responsePayload: unknown,
  ) => void;
  readonly executionNodeRoutes: {
    readonly listNodes: string;
    readonly checkReadiness: string;
    readonly checkEligibility: string;
    readonly listBackendAvailability: string;
  };
}

export function createExecutionNodeManagementRouteFamilyHandler(
  deps: CreateExecutionNodeManagementRouteFamilyHandlerDependencies,
): IdentityHttpRouteFamilyHandler {
  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!deps.options.executionNodeManagementBackendApi) {
      return Object.freeze({ handled: false });
    }

    const searchParams = deps.resolveRequestSearchParams(request.url);

    if (method === "GET" && path === deps.executionNodeRoutes.listNodes) {
      await deps.requireAuthenticatedSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        undefined,
        async (context) => {
          const listRequestPayload = buildExecutionNodeListRequestPayload(searchParams, deps);

          try {
            const parsedListRequest = deps.parseExecutionNodeListRequestDto(listRequestPayload);
            const apiRequest = toExecutionNodeActorScopedApiRequest(context.principal.userIdentityId, parsedListRequest);
            const apiResponse = await deps.options.executionNodeManagementBackendApi!.listNodes(apiRequest);
            const statusCode = deps.mapExecutionNodeManagementStatusCode(apiResponse);
            deps.writeJson(response, statusCode, apiResponse);
            deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
          } catch (error) {
            const invalid = deps.buildExecutionNodeManagementValidationErrorResponse(error);
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, listRequestPayload, invalid);
          }
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === deps.executionNodeRoutes.checkReadiness) {
      await deps.requireAuthenticatedSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        undefined,
        async (context) => {
          const readinessRequestPayload = buildExecutionNodeReadinessRequestPayload(searchParams, deps);

          try {
            const parsedReadinessRequest = deps.parseExecutionNodeReadinessCheckRequestDto(readinessRequestPayload);
            const apiRequest = toExecutionNodeActorScopedApiRequest(
              context.principal.userIdentityId,
              parsedReadinessRequest,
            );
            const apiResponse = await deps.options.executionNodeManagementBackendApi!.checkReadiness(apiRequest);
            const statusCode = deps.mapExecutionNodeManagementStatusCode(apiResponse);
            deps.writeJson(response, statusCode, apiResponse);
            deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
          } catch (error) {
            const invalid = deps.buildExecutionNodeManagementValidationErrorResponse(error);
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, readinessRequestPayload, invalid);
          }
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === deps.executionNodeRoutes.checkEligibility) {
      await deps.requireAuthenticatedSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        undefined,
        async (context) => {
          const eligibilityRequestPayload = buildExecutionNodeReadinessRequestPayload(searchParams, deps);

          try {
            const parsedEligibilityRequest = deps.parseExecutionNodeEligibilityCheckRequestDto(eligibilityRequestPayload);
            const apiRequest = toExecutionNodeActorScopedApiRequest(
              context.principal.userIdentityId,
              parsedEligibilityRequest,
            );
            const apiResponse = await deps.options.executionNodeManagementBackendApi!.checkEligibility(apiRequest);
            const statusCode = deps.mapExecutionNodeManagementStatusCode(apiResponse);
            deps.writeJson(response, statusCode, apiResponse);
            deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
          } catch (error) {
            const invalid = deps.buildExecutionNodeManagementValidationErrorResponse(error);
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, eligibilityRequestPayload, invalid);
          }
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === deps.executionNodeRoutes.listBackendAvailability) {
      await deps.requireAuthenticatedSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        undefined,
        async (context) => {
          const availabilityRequestPayload = buildExecutionNodeBackendAvailabilityRequestPayload(searchParams, deps);

          try {
            const parsedAvailabilityRequest = deps.parseExecutionNodeBackendAvailabilityReadRequestDto(availabilityRequestPayload);
            const apiRequest = toExecutionNodeActorScopedApiRequest(
              context.principal.userIdentityId,
              parsedAvailabilityRequest,
            );
            const apiResponse = await deps.options.executionNodeManagementBackendApi!.listBackendAvailability(apiRequest);
            const statusCode = deps.mapExecutionNodeManagementStatusCode(apiResponse);
            deps.writeJson(response, statusCode, apiResponse);
            deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
          } catch (error) {
            const invalid = deps.buildExecutionNodeManagementValidationErrorResponse(error);
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, availabilityRequestPayload, invalid);
          }
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/execution-nodes/") && path.endsWith("/availability")) {
      await deps.requireAuthenticatedSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        undefined,
        async (context) => {
          const nodeId = deps.decodePathTail(path, "/api/v1/execution-nodes/", "/availability");
          if (!nodeId || nodeId.includes("/")) {
            const invalid = deps.buildExecutionNodeManagementInvalidRequestResponse("nodeId is required.");
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const parsedRequest = await deps.parseAndValidateExecutionNodeSetAvailabilityOverrideRequest(
            request,
            context.principal.userIdentityId,
            nodeId,
            requestId,
            logger,
            deps.maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            deps.writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }

          const apiResponse = await deps.options.executionNodeManagementBackendApi!.setAvailabilityOverride(parsedRequest.data);
          const statusCode = deps.mapExecutionNodeManagementStatusCode(apiResponse);
          deps.writeJson(response, statusCode, apiResponse);
          deps.logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/execution-nodes/")) {
      await deps.requireAuthenticatedSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        undefined,
        async (context) => {
          const nodeId = deps.decodePathTail(path, "/api/v1/execution-nodes/");
          if (!nodeId || nodeId.includes("/")) {
            const invalid = deps.buildExecutionNodeManagementInvalidRequestResponse("nodeId is required.");
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const getRequest = toExecutionNodeGetApiRequest(context.principal.userIdentityId, nodeId);

          const apiResponse = await deps.options.executionNodeManagementBackendApi!.getNode(getRequest);
          const statusCode = deps.mapExecutionNodeManagementStatusCode(apiResponse);
          deps.writeJson(response, statusCode, apiResponse);
          deps.logResponse(logger, requestId, request, statusCode, getRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
}
