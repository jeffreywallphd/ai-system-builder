import { z } from "zod";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createWorkspaceRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const requireAuthenticatedSession = d.requireAuthenticatedSession;
  const parseSharedListPaginationFromQuery = d.parseSharedListPaginationFromQuery;
  const parseOptionalBoolean = d.parseOptionalBoolean;
  const buildWorkspaceAdministrationQueryValidationError = d.buildWorkspaceAdministrationQueryValidationError;
  const writeJson = d.writeJson;
  const logResponse = d.logResponse;
  const normalizeOptionalString = d.normalizeOptionalString;
  const WorkspaceStatusValues = d.WorkspaceStatusValues;
  const parseOptionalEnum = d.parseOptionalEnum;
  const WorkspaceVisibilityValues = d.WorkspaceVisibilityValues;
  const mapWorkspaceAdministrationStatusCode = d.mapWorkspaceAdministrationStatusCode;
  const parseAndValidateWorkspaceAdministrationRequest = d.parseAndValidateWorkspaceAdministrationRequest;
  const CreateWorkspaceRequestSchema = d.CreateWorkspaceRequestSchema;
  const decodePathTail = d.decodePathTail;
  const buildWorkspaceAdministrationInvalidRequestResponse = d.buildWorkspaceAdministrationInvalidRequestResponse;
  const UpdateWorkspaceRequestSchema = d.UpdateWorkspaceRequestSchema;
  const TransitionWorkspaceLifecycleRequestSchema = d.TransitionWorkspaceLifecycleRequestSchema;
  const WorkspaceMembershipStatusValues = d.WorkspaceMembershipStatusValues;
  const AddWorkspaceMemberRequestSchema = d.AddWorkspaceMemberRequestSchema;
  const decodeWorkspaceUserScopedPath = d.decodeWorkspaceUserScopedPath;
  const ChangeWorkspaceMembershipStatusRequestSchema = d.ChangeWorkspaceMembershipStatusRequestSchema;
  const WorkspaceInvitationStatusValues = d.WorkspaceInvitationStatusValues;
  const decodeWorkspaceEntityPath = d.decodeWorkspaceEntityPath;
  const WorkspaceRoleValues = d.WorkspaceRoleValues;
  const WorkspaceRoleAssignmentStatusValues = d.WorkspaceRoleAssignmentStatusValues;
  const AssignWorkspaceRoleRequestSchema = d.AssignWorkspaceRoleRequestSchema;
  const ReassignWorkspaceRoleRequestSchema = d.ReassignWorkspaceRoleRequestSchema;
  const RevokeWorkspaceRoleRequestSchema = d.RevokeWorkspaceRoleRequestSchema;
  const buildWorkspaceInvalidRequestResponse = d.buildWorkspaceInvalidRequestResponse;
  const parseAndValidateWorkspaceRequest = d.parseAndValidateWorkspaceRequest;
  const IssueWorkspaceInvitationRequestSchema = d.IssueWorkspaceInvitationRequestSchema;
  const mapWorkspaceStatusCode = d.mapWorkspaceStatusCode;
  const AcceptWorkspaceInvitationOnboardingRequestSchema = d.AcceptWorkspaceInvitationOnboardingRequestSchema;

  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
      if (
        options.workspaceAdministrationBackendApi
        && request.method === "GET"
        && path === "/api/v1/workspaces"
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
            const url = new URL(request.url ?? "/", "http://localhost");
            const statuses = url.searchParams.getAll("status");
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const invalid = buildWorkspaceAdministrationQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaces({
              actorUserIdentityId: context.principal.userIdentityId,
              ownerUserIdentityId: normalizeOptionalString(url.searchParams.get("ownerUserIdentityId")),
              statuses: statuses.length > 0 ? statuses.filter((status) => WorkspaceStatusValues.safeParse(status).success) as Array<z.infer<typeof WorkspaceStatusValues>> : undefined,
              visibility: parseOptionalEnum(url.searchParams.get("visibility"), WorkspaceVisibilityValues.options),
              slugPrefix: normalizeOptionalString(url.searchParams.get("slugPrefix")),
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path === "/api/v1/workspaces"
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
            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              CreateWorkspaceRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.createWorkspace({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "GET"
        && path.endsWith("/admin-view")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/admin-view");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const url = new URL(request.url ?? "/", "http://localhost");
            const apiResponse = await options.workspaceAdministrationBackendApi.readWorkspaceAdministrationView({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              asOf: normalizeOptionalString(url.searchParams.get("asOf")),
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "PATCH"
        && path.startsWith("/api/v1/workspaces/")
        && !path.endsWith("/lifecycle")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              UpdateWorkspaceRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.updateWorkspace({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path.endsWith("/lifecycle")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/lifecycle");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              TransitionWorkspaceLifecycleRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.transitionWorkspaceLifecycle({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              action: parsedRequest.data.action,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              action: parsedRequest.data.action,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "GET"
        && path.endsWith("/members")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/members");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const url = new URL(request.url ?? "/", "http://localhost");
            const statuses = url.searchParams.getAll("status")
              .filter((status) => WorkspaceMembershipStatusValues.safeParse(status).success) as Array<z.infer<typeof WorkspaceMembershipStatusValues>>;
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const invalid = buildWorkspaceAdministrationQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaceMemberships({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              userIdentityId: normalizeOptionalString(url.searchParams.get("userIdentityId")),
              statuses: statuses.length > 0 ? statuses : undefined,
              invitationId: normalizeOptionalString(url.searchParams.get("invitationId")),
              invitedByUserIdentityId: normalizeOptionalString(url.searchParams.get("invitedByUserIdentityId")),
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path.endsWith("/members")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/members");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              AddWorkspaceMemberRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.addWorkspaceMember({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path.endsWith("/status")
        && path.includes("/members/")
        && path.startsWith("/api/v1/workspaces/")
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
            const pathParams = decodeWorkspaceUserScopedPath(path, "/members/", "/status");
            if (!pathParams) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId and userIdentityId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              ChangeWorkspaceMembershipStatusRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.changeWorkspaceMembershipStatus({
              workspaceId: pathParams.workspaceId,
              targetUserIdentityId: pathParams.userIdentityId,
              actorUserIdentityId: context.principal.userIdentityId,
              status: parsedRequest.data.status,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId: pathParams.workspaceId,
              targetUserIdentityId: pathParams.userIdentityId,
              actorUserIdentityId: context.principal.userIdentityId,
              status: parsedRequest.data.status,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "DELETE"
        && path.includes("/members/")
        && path.startsWith("/api/v1/workspaces/")
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
            const pathParams = decodeWorkspaceUserScopedPath(path, "/members/");
            if (!pathParams) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId and userIdentityId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.removeWorkspaceMember({
              workspaceId: pathParams.workspaceId,
              targetUserIdentityId: pathParams.userIdentityId,
              actorUserIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId: pathParams.workspaceId,
              targetUserIdentityId: pathParams.userIdentityId,
              actorUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "GET"
        && path.endsWith("/invitations")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/invitations");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const url = new URL(request.url ?? "/", "http://localhost");
            const statuses = url.searchParams.getAll("status")
              .filter((status) => WorkspaceInvitationStatusValues.safeParse(status).success) as Array<z.infer<typeof WorkspaceInvitationStatusValues>>;
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const invalid = buildWorkspaceAdministrationQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaceInvitations({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              invitedEmail: normalizeOptionalString(url.searchParams.get("invitedEmail")),
              invitedByUserIdentityId: normalizeOptionalString(url.searchParams.get("invitedByUserIdentityId")),
              statuses: statuses.length > 0 ? statuses : undefined,
              activeOnly: parseOptionalBoolean(url.searchParams.get("activeOnly")),
              expiresBefore: normalizeOptionalString(url.searchParams.get("expiresBefore")),
              expiresAfter: normalizeOptionalString(url.searchParams.get("expiresAfter")),
              asOf: normalizeOptionalString(url.searchParams.get("asOf")),
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "DELETE"
        && path.includes("/invitations/")
        && path.startsWith("/api/v1/workspaces/")
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
            const pathParams = decodeWorkspaceEntityPath(path, "/invitations/");
            if (!pathParams) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId and invitationId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.cancelWorkspaceInvitation({
              workspaceId: pathParams.workspaceId,
              invitationId: pathParams.entityId,
              actorUserIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId: pathParams.workspaceId,
              invitationId: pathParams.entityId,
              actorUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "GET"
        && path.endsWith("/roles")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/roles");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const url = new URL(request.url ?? "/", "http://localhost");
            const roles = url.searchParams.getAll("role")
              .filter((role) => WorkspaceRoleValues.safeParse(role).success) as Array<z.infer<typeof WorkspaceRoleValues>>;
            const statuses = url.searchParams.getAll("status")
              .filter((status) => WorkspaceRoleAssignmentStatusValues.safeParse(status).success) as Array<z.infer<typeof WorkspaceRoleAssignmentStatusValues>>;
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const invalid = buildWorkspaceAdministrationQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaceRoleAssignments({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              userIdentityId: normalizeOptionalString(url.searchParams.get("userIdentityId")),
              roles: roles.length > 0 ? roles : undefined,
              statuses: statuses.length > 0 ? statuses : undefined,
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              query: Object.fromEntries(url.searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path.endsWith("/roles/assign")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/roles/assign");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              AssignWorkspaceRoleRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.assignWorkspaceRole({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path.endsWith("/roles/reassign")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/roles/reassign");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              ReassignWorkspaceRoleRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.reassignWorkspaceRole({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceAdministrationBackendApi
        && request.method === "POST"
        && path.endsWith("/roles/revoke")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/roles/revoke");
            if (!workspaceId) {
              const invalid = buildWorkspaceAdministrationInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceAdministrationRequest(
              request,
              RevokeWorkspaceRoleRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceAdministrationBackendApi.revokeWorkspaceRole({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapWorkspaceAdministrationStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceBackendApi
        && request.method === "POST"
        && path.endsWith("/invitations")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/invitations");
            if (!workspaceId) {
              const invalid = buildWorkspaceInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceRequest(
              request,
              IssueWorkspaceInvitationRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceBackendApi.issueWorkspaceInvitation({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              invitedEmail: parsedRequest.data.invitedEmail,
              invitedRoles: parsedRequest.data.invitedRoles,
              expiresAt: parsedRequest.data.expiresAt,
              expiresInMs: parsedRequest.data.expiresInMs,
              targetUserIdentityIdHint: parsedRequest.data.targetUserIdentityIdHint,
              onboardingMetadata: parsedRequest.data.onboardingMetadata,
            });
            const statusCode = mapWorkspaceStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        options.workspaceBackendApi
        && request.method === "POST"
        && path.endsWith("/onboarding/accept")
        && path.startsWith("/api/v1/workspaces/")
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
            const workspaceId = decodePathTail(path, "/api/v1/workspaces/", "/onboarding/accept");
            if (!workspaceId) {
              const invalid = buildWorkspaceInvalidRequestResponse("workspaceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const actorEmail = normalizeOptionalString(context.principal.email ?? null);
            if (!actorEmail) {
              const invalid = buildWorkspaceInvalidRequestResponse(
                "Authenticated principal email is required for invitation onboarding acceptance.",
              );
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({ workspaceId }), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateWorkspaceRequest(
              request,
              AcceptWorkspaceInvitationOnboardingRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.workspaceBackendApi.acceptWorkspaceInvitationOnboarding({
              workspaceId,
              invitationToken: parsedRequest.data.invitationToken,
              onboardingMetadata: parsedRequest.data.onboardingMetadata,
              session: Object.freeze({
                sessionId: context.session.sessionId,
                userIdentityId: context.principal.userIdentityId,
                email: actorEmail,
                assuranceLevel: context.session.deviceTrustContext?.sessionAssuranceLevel,
                trustedDeviceId: context.session.deviceTrustContext?.trustedDeviceId,
                externalIdentityProvider: context.session.providerId,
                metadata: Object.freeze({
                  accessChannel: context.session.accessChannel,
                  deviceId: context.session.deviceId,
                }),
              }),
            });
            const statusCode = mapWorkspaceStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId,
              invitationToken: parsedRequest.data.invitationToken,
              sessionId: context.session.sessionId,
              userIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

    return Object.freeze({ handled: false });
  };
}


