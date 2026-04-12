import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

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
          const listRequestPayload = Object.freeze({
            nodeIds: deps.parseOptionalStringList(searchParams, "nodeId", "nodeIds"),
            nodeTypes: deps.parseOptionalStringList(searchParams, "nodeType", "nodeTypes"),
            approvalStatuses: deps.parseOptionalStringList(searchParams, "approvalStatus", "approvalStatuses"),
            trustStates: deps.parseOptionalStringList(searchParams, "trustState", "trustStates"),
            activationStatuses: deps.parseOptionalStringList(searchParams, "activationStatus", "activationStatuses"),
            healthStatuses: deps.parseOptionalStringList(searchParams, "healthStatus", "healthStatuses"),
            operationalAvailabilityModes: deps.parseOptionalStringList(
              searchParams,
              "operationalAvailabilityMode",
              "operationalAvailabilityModes",
            ),
            backendFamilies: deps.parseOptionalStringList(searchParams, "backendFamily", "backendFamilies"),
            executionTargets: deps.parseOptionalStringList(searchParams, "executionTarget", "executionTargets"),
            requiredCapabilitiesAnyOf: deps.parseOptionalStringList(
              searchParams,
              "requiredCapability",
              "requiredCapabilitiesAnyOf",
            ),
            supportsRemoteScheduling: deps.parseOptionalBoolean(searchParams.get("supportsRemoteScheduling")),
            deploymentTagAnyOf: deps.parseOptionalStringList(searchParams, "deploymentTag", "deploymentTagAnyOf"),
            includeRevoked: deps.parseOptionalBoolean(searchParams.get("includeRevoked")),
            lastSeenAfter: deps.normalizeOptionalString(searchParams.get("lastSeenAfter")),
            lastSeenBefore: deps.normalizeOptionalString(searchParams.get("lastSeenBefore")),
            limit: deps.parseOptionalInteger(searchParams.get("limit")),
            offset: deps.parseOptionalInteger(searchParams.get("offset")),
          });

          try {
            const parsedListRequest = deps.parseExecutionNodeListRequestDto(listRequestPayload);
            const apiRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedListRequest,
            });
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
          const readinessRequestPayload = Object.freeze({
            workspaceId: deps.normalizeOptionalString(searchParams.get("workspaceId")),
            workflowId: deps.normalizeOptionalString(searchParams.get("workflowId")),
            runId: deps.normalizeOptionalString(searchParams.get("runId")),
            candidateNodeIds: deps.parseOptionalStringList(searchParams, "candidateNodeId", "candidateNodeIds"),
            requiredBackendFamilies: deps.parseOptionalStringList(searchParams, "requiredBackendFamily", "requiredBackendFamilies"),
            requiredExecutionTarget: deps.normalizeOptionalString(searchParams.get("requiredExecutionTarget")),
            requiredNodeCapabilities: deps.parseOptionalStringList(searchParams, "requiredNodeCapability", "requiredNodeCapabilities"),
            requiresRemoteScheduling: deps.parseOptionalBoolean(searchParams.get("requiresRemoteScheduling")),
            requiredOperationKind: deps.normalizeOptionalString(searchParams.get("requiredOperationKind")),
            requiredOperationCapability: deps.normalizeOptionalString(searchParams.get("requiredOperationCapability")),
            requiredInputKinds: deps.parseOptionalStringList(searchParams, "requiredInputKind", "requiredInputKinds"),
            requiredOutputKinds: deps.parseOptionalStringList(searchParams, "requiredOutputKind", "requiredOutputKinds"),
            requiredTranslationContractVersion: deps.normalizeOptionalString(searchParams.get("requiredTranslationContractVersion")),
            preferredResourceClassHints: deps.parseOptionalStringList(searchParams, "preferredResourceClassHint", "preferredResourceClassHints"),
            allowDegraded: deps.parseOptionalBoolean(searchParams.get("allowDegraded")),
            maxLastSeenAgeMs: deps.parseOptionalInteger(searchParams.get("maxLastSeenAgeMs")),
            now: deps.normalizeOptionalString(searchParams.get("now")),
          });

          try {
            const parsedReadinessRequest = deps.parseExecutionNodeReadinessCheckRequestDto(readinessRequestPayload);
            const apiRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedReadinessRequest,
            });
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
          const eligibilityRequestPayload = Object.freeze({
            workspaceId: deps.normalizeOptionalString(searchParams.get("workspaceId")),
            workflowId: deps.normalizeOptionalString(searchParams.get("workflowId")),
            runId: deps.normalizeOptionalString(searchParams.get("runId")),
            candidateNodeIds: deps.parseOptionalStringList(searchParams, "candidateNodeId", "candidateNodeIds"),
            requiredBackendFamilies: deps.parseOptionalStringList(searchParams, "requiredBackendFamily", "requiredBackendFamilies"),
            requiredExecutionTarget: deps.normalizeOptionalString(searchParams.get("requiredExecutionTarget")),
            requiredNodeCapabilities: deps.parseOptionalStringList(searchParams, "requiredNodeCapability", "requiredNodeCapabilities"),
            requiresRemoteScheduling: deps.parseOptionalBoolean(searchParams.get("requiresRemoteScheduling")),
            requiredOperationKind: deps.normalizeOptionalString(searchParams.get("requiredOperationKind")),
            requiredOperationCapability: deps.normalizeOptionalString(searchParams.get("requiredOperationCapability")),
            requiredInputKinds: deps.parseOptionalStringList(searchParams, "requiredInputKind", "requiredInputKinds"),
            requiredOutputKinds: deps.parseOptionalStringList(searchParams, "requiredOutputKind", "requiredOutputKinds"),
            requiredTranslationContractVersion: deps.normalizeOptionalString(searchParams.get("requiredTranslationContractVersion")),
            preferredResourceClassHints: deps.parseOptionalStringList(searchParams, "preferredResourceClassHint", "preferredResourceClassHints"),
            allowDegraded: deps.parseOptionalBoolean(searchParams.get("allowDegraded")),
            maxLastSeenAgeMs: deps.parseOptionalInteger(searchParams.get("maxLastSeenAgeMs")),
            now: deps.normalizeOptionalString(searchParams.get("now")),
          });

          try {
            const parsedEligibilityRequest = deps.parseExecutionNodeEligibilityCheckRequestDto(eligibilityRequestPayload);
            const apiRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedEligibilityRequest,
            });
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
          const availabilityRequestPayload = Object.freeze({
            backendFamilies: deps.parseOptionalStringList(searchParams, "backendFamily", "backendFamilies"),
            executionTarget: deps.normalizeOptionalString(searchParams.get("executionTarget")),
            includeUnavailable: deps.parseOptionalBoolean(searchParams.get("includeUnavailable")),
          });

          try {
            const parsedAvailabilityRequest = deps.parseExecutionNodeBackendAvailabilityReadRequestDto(availabilityRequestPayload);
            const apiRequest = Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedAvailabilityRequest,
            });
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

          const getRequest = Object.freeze({
            actorUserIdentityId: context.principal.userIdentityId,
            nodeId,
          });

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
