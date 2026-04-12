import { z } from "zod";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createAuthorizationRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const requireAuthenticatedSession = d.requireAuthenticatedSession;
  const decodeAuthorizationResourcePath = d.decodeAuthorizationResourcePath;
  const buildAuthorizationManagementInvalidRequestResponse = d.buildAuthorizationManagementInvalidRequestResponse;
  const writeJson = d.writeJson;
  const logResponse = d.logResponse;
  const parseAndValidateAuthorizationManagementRequest = d.parseAndValidateAuthorizationManagementRequest;
  const AuthorizationUpdateVisibilityRequestSchema = d.AuthorizationUpdateVisibilityRequestSchema;
  const mapAuthorizationManagementStatusCode = d.mapAuthorizationManagementStatusCode;
  const AuthorizationGrantSharingRequestSchema = d.AuthorizationGrantSharingRequestSchema;
  const decodeAuthorizationResourceAndGrantPath = d.decodeAuthorizationResourceAndGrantPath;
  const AuthorizationRevokeSharingRequestSchema = d.AuthorizationRevokeSharingRequestSchema;
  const AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema = d.AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema;
  const parseOptionalBoolean = d.parseOptionalBoolean;
  const normalizeOptionalString = d.normalizeOptionalString;
  const decodeAuthorizationWorkspaceReportingPath = d.decodeAuthorizationWorkspaceReportingPath;
  const parseOptionalInteger = d.parseOptionalInteger;

  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
      if (
        options.authorizationManagementBackendApi
        && request.method === "PATCH"
        && path.endsWith("/visibility")
        && path.startsWith("/api/v1/authorization/resources/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const resource = decodeAuthorizationResourcePath(path, "/visibility");
            if (!resource) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse(
                "resourceFamily, resourceType, and resourceId are required.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateAuthorizationManagementRequest(
              request,
              AuthorizationUpdateVisibilityRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.authorizationManagementBackendApi.updateVisibility({
              actorUserIdentityId: context.principal.userIdentityId,
              resource,
              ...parsedRequest.data,
            });
            const statusCode = mapAuthorizationManagementStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              resource,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.authorizationManagementBackendApi
        && request.method === "POST"
        && path.endsWith("/sharing-grants")
        && path.startsWith("/api/v1/authorization/resources/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const resource = decodeAuthorizationResourcePath(path, "/sharing-grants");
            if (!resource) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse(
                "resourceFamily, resourceType, and resourceId are required.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateAuthorizationManagementRequest(
              request,
              AuthorizationGrantSharingRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.authorizationManagementBackendApi.grantSharingAccess({
              actorUserIdentityId: context.principal.userIdentityId,
              resource,
              ...parsedRequest.data,
            });
            const statusCode = mapAuthorizationManagementStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              resource,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.authorizationManagementBackendApi
        && request.method === "DELETE"
        && path.includes("/sharing-grants/")
        && path.startsWith("/api/v1/authorization/resources/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const pathParams = decodeAuthorizationResourceAndGrantPath(path);
            if (!pathParams) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse(
                "resourceFamily, resourceType, resourceId, and grantId are required.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateAuthorizationManagementRequest(
              request,
              AuthorizationRevokeSharingRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
              {
                allowEmptyBody: true,
              },
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.authorizationManagementBackendApi.revokeSharingAccess({
              actorUserIdentityId: context.principal.userIdentityId,
              resource: pathParams.resource,
              grantId: pathParams.grantId,
              ...parsedRequest.data,
            });
            const statusCode = mapAuthorizationManagementStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              resource: pathParams.resource,
              grantId: pathParams.grantId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.authorizationManagementBackendApi
        && request.method === "POST"
        && path === "/api/v1/authorization/sharing-grants/workspace-role/bulk-upsert"
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const parsedRequest = await parseAndValidateAuthorizationManagementRequest(
              request,
              AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.authorizationManagementBackendApi.bulkGrantWorkspaceRoleAccess({
              actorUserIdentityId: context.principal.userIdentityId,
              workspaceId: parsedRequest.data.workspaceId,
              roleKey: parsedRequest.data.roleKey,
              resources: parsedRequest.data.resources,
              permissionKeys: parsedRequest.data.permissionKeys,
              reason: parsedRequest.data.reason,
              correlationId: parsedRequest.data.correlationId,
              metadata: parsedRequest.data.metadata,
            });
            const statusCode = mapAuthorizationManagementStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              workspaceId: parsedRequest.data.workspaceId,
              roleKey: parsedRequest.data.roleKey,
              resourceCount: parsedRequest.data.resources.length,
              permissionKeys: parsedRequest.data.permissionKeys,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.authorizationManagementBackendApi
        && request.method === "GET"
        && path.endsWith("/access-state")
        && path.startsWith("/api/v1/authorization/resources/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const resource = decodeAuthorizationResourcePath(path, "/access-state");
            if (!resource) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse(
                "resourceFamily, resourceType, and resourceId are required.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const url = new URL(request.url ?? "/", "http://localhost");
            const includeDenied = parseOptionalBoolean(url.searchParams.get("includeDenied"));
            const includeRevokedSharingGrants = parseOptionalBoolean(url.searchParams.get("includeRevokedSharingGrants"));
            const asOf = normalizeOptionalString(url.searchParams.get("asOf"));
            const inspectedActorUserIdentityId = normalizeOptionalString(url.searchParams.get("inspectedActorUserIdentityId"));

            if (asOf && !z.string().datetime({ offset: true }).safeParse(asOf).success) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse("asOf must be a valid ISO-8601 timestamp.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                actorUserIdentityId: context.principal.userIdentityId,
                resource,
                asOf,
              }), invalid);
              return;
            }

            const apiResponse = await options.authorizationManagementBackendApi.readAccessState({
              actorUserIdentityId: context.principal.userIdentityId,
              inspectedActorUserIdentityId,
              resource,
              asOf,
              includeDenied,
              includeRevokedSharingGrants,
            });
            const statusCode = mapAuthorizationManagementStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              resource,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.authorizationManagementBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/authorization/reporting/workspaces/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const workspaceId = decodeAuthorizationWorkspaceReportingPath(path);
            if (!workspaceId) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const url = new URL(request.url ?? "/", "http://localhost");
            const asOf = normalizeOptionalString(url.searchParams.get("asOf"));
            const includeRevokedRoleAssignments = parseOptionalBoolean(url.searchParams.get("includeRevokedRoleAssignments"));
            const includeRevokedSharingGrants = parseOptionalBoolean(url.searchParams.get("includeRevokedSharingGrants"));
            const recentSharingMutationsLimit = parseOptionalInteger(url.searchParams.get("recentSharingMutationsLimit"));

            if (asOf && !z.string().datetime({ offset: true }).safeParse(asOf).success) {
              const invalid = buildAuthorizationManagementInvalidRequestResponse("asOf must be a valid ISO-8601 timestamp.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                actorUserIdentityId: context.principal.userIdentityId,
                workspaceId,
                asOf,
              }), invalid);
              return;
            }

            const apiResponse = await options.authorizationManagementBackendApi.readWorkspaceSharingReport({
              actorUserIdentityId: context.principal.userIdentityId,
              workspaceId,
              asOf,
              includeRevokedRoleAssignments,
              includeRevokedSharingGrants,
              recentSharingMutationsLimit,
            });
            const statusCode = mapAuthorizationManagementStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              workspaceId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

    return Object.freeze({ handled: false });
  };
}


