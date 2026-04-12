import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";
import {
  toAuditLedgerDetailApiRequest,
  toAuditLedgerListApiRequest,
  toAuditLedgerQueryLogPayload,
  type AuditRouteAuthenticatedWorkspaceContext,
} from "../dto/AuditRouteDtoMapper";

type AuthenticatedWorkspaceContext = AuditRouteAuthenticatedWorkspaceContext;

interface CreateAuditLedgerRouteFamilyHandlerDependencies {
  readonly options: {
    readonly auditLedgerBackendApi?: {
      listAuditEvents(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      listGovernanceAuditEvents(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      getAuditEventDetail(request: Readonly<Record<string, unknown>>): Promise<unknown>;
      getGovernanceAuditEventDetail(request: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
    readonly backendApi: unknown;
    readonly transportTrust?: unknown;
  };
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
  readonly parseAndValidateAuditLedgerListQuery: (
    searchParams: URLSearchParams,
  ) => { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly statusCode: number; readonly body: unknown };
  readonly resolveRequestSearchParams: (requestUrl: string | undefined) => URLSearchParams;
  readonly decodePathTail: (path: string, prefix: string, suffix?: string) => string | undefined;
  readonly buildAuditLedgerInvalidRequestResponse: (message: string) => unknown;
  readonly mapAuditLedgerStatusCode: (apiResponse: unknown) => number;
  readonly writeJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  readonly logResponse: (
    logger: unknown,
    requestId: string,
    request: IncomingMessage,
    statusCode: number,
    requestPayload: unknown,
    responsePayload: unknown,
  ) => void;
}

export function createAuditLedgerRouteFamilyHandler(
  deps: CreateAuditLedgerRouteFamilyHandlerDependencies,
): IdentityHttpRouteFamilyHandler {
  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!deps.options.auditLedgerBackendApi) {
      return Object.freeze({ handled: false });
    }

    const searchParams = deps.resolveRequestSearchParams(request.url);

    if (method === "GET" && path === "/api/v1/audit/events") {
      await deps.requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: deps.buildAuditLedgerInvalidRequestResponse,
        },
        async (context) => {
          const parsedQuery = deps.parseAndValidateAuditLedgerListQuery(searchParams);
          if (!parsedQuery.ok) {
            deps.writeJson(response, parsedQuery.statusCode, parsedQuery.body);
            deps.logResponse(
              logger,
              requestId,
              request,
              parsedQuery.statusCode,
              toAuditLedgerQueryLogPayload(searchParams),
              parsedQuery.body,
            );
            return;
          }

          const apiRequest = toAuditLedgerListApiRequest(context, parsedQuery.data);
          const apiResponse = await deps.options.auditLedgerBackendApi!.listAuditEvents(apiRequest);
          const statusCode = deps.mapAuditLedgerStatusCode(apiResponse);
          deps.writeJson(response, statusCode, apiResponse);
          deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === "/api/v1/audit/governance/events") {
      await deps.requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: deps.buildAuditLedgerInvalidRequestResponse,
        },
        async (context) => {
          const parsedQuery = deps.parseAndValidateAuditLedgerListQuery(searchParams);
          if (!parsedQuery.ok) {
            deps.writeJson(response, parsedQuery.statusCode, parsedQuery.body);
            deps.logResponse(
              logger,
              requestId,
              request,
              parsedQuery.statusCode,
              toAuditLedgerQueryLogPayload(searchParams),
              parsedQuery.body,
            );
            return;
          }

          const apiRequest = toAuditLedgerListApiRequest(context, parsedQuery.data);
          const apiResponse = await deps.options.auditLedgerBackendApi!.listGovernanceAuditEvents(apiRequest);
          const statusCode = deps.mapAuditLedgerStatusCode(apiResponse);
          deps.writeJson(response, statusCode, apiResponse);
          deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/audit/events/")) {
      await deps.requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and eventId are required.",
          buildInvalidResponse: deps.buildAuditLedgerInvalidRequestResponse,
        },
        async (context) => {
          const eventId = deps.decodePathTail(path, "/api/v1/audit/events/");
          if (!eventId || eventId.includes("/")) {
            const invalid = deps.buildAuditLedgerInvalidRequestResponse("workspaceId and eventId are required.");
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const apiRequest = toAuditLedgerDetailApiRequest(context, eventId);
          const apiResponse = await deps.options.auditLedgerBackendApi!.getAuditEventDetail(apiRequest);
          const statusCode = deps.mapAuditLedgerStatusCode(apiResponse);
          deps.writeJson(response, statusCode, apiResponse);
          deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/audit/governance/events/")) {
      await deps.requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        deps.options.backendApi,
        logger,
        deps.options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and eventId are required.",
          buildInvalidResponse: deps.buildAuditLedgerInvalidRequestResponse,
        },
        async (context) => {
          const eventId = deps.decodePathTail(path, "/api/v1/audit/governance/events/");
          if (!eventId || eventId.includes("/")) {
            const invalid = deps.buildAuditLedgerInvalidRequestResponse("workspaceId and eventId are required.");
            deps.writeJson(response, 400, invalid);
            deps.logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const apiRequest = toAuditLedgerDetailApiRequest(context, eventId);
          const apiResponse = await deps.options.auditLedgerBackendApi!.getGovernanceAuditEventDetail(apiRequest);
          const statusCode = deps.mapAuditLedgerStatusCode(apiResponse);
          deps.writeJson(response, statusCode, apiResponse);
          deps.logResponse(logger, requestId, request, statusCode, apiRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
}
