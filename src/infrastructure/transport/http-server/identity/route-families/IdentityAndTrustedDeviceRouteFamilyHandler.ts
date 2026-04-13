import { z } from "zod";
import type { IdentityHttpRouteFamilyHandler, IdentityHttpRouteFamilyHandlerResult } from "../IdentityHttpServer";

export function createIdentityAndTrustedDeviceRouteFamilyHandler(deps: Record<string, unknown>): IdentityHttpRouteFamilyHandler {
  const d = deps as any;
  const options = d.options;
  const maxBodyBytes = d.maxBodyBytes;
  const handleRegister = d.handleRegister;
  const handleLogin = d.handleLogin;
  const handleDevLogin = d.handleDevLogin;
  const requireAuthenticatedSession = d.requireAuthenticatedSession;
  const writeJson = d.writeJson;
  const logResponse = d.logResponse;
  const normalizeOptionalString = d.normalizeOptionalString;
  const mapStatusCode = d.mapStatusCode;
  const parseAndValidateRequest = d.parseAndValidateRequest;
  const parseSharedListPaginationFromQuery = d.parseSharedListPaginationFromQuery;
  const buildQueryValidationError = d.buildQueryValidationError;
  const IdentitySessionStatusValues = d.IdentitySessionStatusValues;
  const IdentitySessionAccessChannelValues = d.IdentitySessionAccessChannelValues;
  const ChangeCredentialRequestSchema = d.ChangeCredentialRequestSchema;
  const AdminAccountStatusValues = d.AdminAccountStatusValues;
  const buildAdminContext = d.buildAdminContext;
  const SetAdminAccountStatusRequestSchema = d.SetAdminAccountStatusRequestSchema;
  const RevokeSessionByPathRequestSchema = d.RevokeSessionByPathRequestSchema;
  const TrustedDeviceStatusValues = d.TrustedDeviceStatusValues;
  const RevokeIdentityAdminTrustedDeviceRequestSchema = d.RevokeIdentityAdminTrustedDeviceRequestSchema;
  const decodePathTail = d.decodePathTail;
  const buildInvalidRequestResponse = d.buildInvalidRequestResponse;
  const buildForbiddenResponse = d.buildForbiddenResponse;
  const RevokeTrustedDeviceRequestSchema = d.RevokeTrustedDeviceRequestSchema;
  const UpdateTrustedDeviceDisplayNameRequestSchema = d.UpdateTrustedDeviceDisplayNameRequestSchema;
  const InitiateTrustedDevicePairingRequestSchema = d.InitiateTrustedDevicePairingRequestSchema;
  const ValidateTrustedDevicePairingRequestSchema = d.ValidateTrustedDevicePairingRequestSchema;
  const CompleteTrustedDevicePairingRequestSchema = d.CompleteTrustedDevicePairingRequestSchema;
  const resolveRequestSearchParams = d.resolveRequestSearchParams;
  const resolveSessionActorContextWorkspaceId = d.resolveSessionActorContextWorkspaceId;
  const normalizeSessionAssuranceLevel = d.normalizeSessionAssuranceLevel;
  const RevokeSessionRequestSchema = d.RevokeSessionRequestSchema;

  return async ({ request, response, requestId, logger, path, method }): Promise<IdentityHttpRouteFamilyHandlerResult> => {
      if (request.method === "POST" && path === "/api/v1/identity/register") {
        await handleRegister(request, response, requestId, options.backendApi, logger, maxBodyBytes);
        return;
      }
      if (request.method === "POST" && path === "/api/v1/identity/login") {
        await handleLogin(request, response, requestId, options.backendApi, logger, maxBodyBytes);
        return;
      }
      if (request.method === "POST" && path === "/api/v1/identity/dev-login" && options.development?.enableDevLoginRoute) {
        await handleDevLogin(request, response, requestId, options.backendApi, logger, maxBodyBytes);
        return;
      }
      if (request.method === "GET" && path === "/api/v1/identity/session") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const responseBody = Object.freeze({
              ok: true,
              data: Object.freeze({
                principal: context.principal,
                session: context.session,
              }),
            });
            writeJson(response, 200, responseBody);
            logResponse(logger, requestId, request, 200, Object.freeze({
              principal: context.principal,
              session: context.session,
              sessionToken: context.sessionToken,
              transport: context.transport,
            }), responseBody);
          },
        );
        return;
      }
      if (request.method === "GET" && path === "/api/v1/identity/session/context") {
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
            const requestedWorkspaceId = normalizeOptionalString(url.searchParams.get("workspaceId"));

            const trustedDeviceId = context.session.deviceTrustContext?.trustedDeviceId
              ?? context.session.trustedDeviceBindingId;
            let trustedDevice;
            if (trustedDeviceId) {
              const trustedDeviceResponse = await options.backendApi.getTrustedDevice({
                trustedDeviceId,
              });
              if (
                trustedDeviceResponse.ok
                && trustedDeviceResponse.data
                && trustedDeviceResponse.data.trustedDevice.userIdentityId === context.principal.userIdentityId
              ) {
                trustedDevice = trustedDeviceResponse.data.trustedDevice;
              }
            }

            let workspaces = Object.freeze([]);
            const sessionContextWorkspaceApi = options.sessionContextWorkspaceApi ?? options.workspaceAdministrationBackendApi;
            if (sessionContextWorkspaceApi) {
              const workspaceResponse = await sessionContextWorkspaceApi.listWorkspaces({
                actorUserIdentityId: context.principal.userIdentityId,
                limit: 200,
                offset: 0,
              });
              if (workspaceResponse.ok && workspaceResponse.data) {
                workspaces = Object.freeze(workspaceResponse.data.workspaces.map((workspace) => Object.freeze({
                  workspaceId: workspace.workspaceId,
                  slug: workspace.slug,
                  displayName: workspace.displayName,
                  status: workspace.status,
                  visibility: workspace.visibility,
                  membershipStatus: workspace.actorAccess.membershipStatus,
                  effectiveRoles: workspace.actorAccess.effectiveRoles,
                  canAdministrate: workspace.actorAccess.canAdministrate,
                  isWorkspaceOwner: workspace.actorAccess.isWorkspaceOwner,
                })));
              }
            }

            const workspaceCreationApi = options.workspaceAdministrationBackendApi
              ?? options.sessionContextWorkspaceApi;
            const workspaceCreationApiSource = options.workspaceAdministrationBackendApi
              ? "workspaceAdministrationBackendApi"
              : "sessionContextWorkspaceApi";
            if (workspaces.length === 0 && workspaceCreationApi?.createWorkspace) {
              logger.info({
                event: "identity.session-context.default-workspace.ensure.started",
                requestId,
                details: Object.freeze({
                  actorUserIdentityId: context.principal.userIdentityId,
                  existingWorkspaceCount: workspaces.length,
                  apiSource: workspaceCreationApiSource,
                }),
              });
              workspaces = await ensureDefaultWorkspaceForAuthenticatedSession({
                workspaceAdministrationBackendApi: workspaceCreationApi,
                actorUserIdentityId: context.principal.userIdentityId,
                username: context.principal.username,
                existingWorkspaces: workspaces,
                onDiagnostics: (event) => logger.info({
                  event: event.event,
                  requestId,
                  details: event.details,
                }),
              });
            }

            const resolvedWorkspaceId = resolveSessionActorContextWorkspaceId(requestedWorkspaceId, workspaces);
            const sessionAssuranceLevel = normalizeSessionAssuranceLevel(
              context.session.deviceTrustContext?.sessionAssuranceLevel,
            );

            const responseBody = Object.freeze({
              ok: true,
              data: Object.freeze({
                actor: context.principal,
                session: Object.freeze({
                  sessionId: context.session.sessionId,
                  providerId: context.session.providerId,
                  accessChannel: context.session.accessChannel,
                  deviceId: context.session.deviceId,
                  issuedAt: context.session.issuedAt,
                  expiresAt: context.session.expiresAt,
                  assuranceLevel: sessionAssuranceLevel,
                  trustedDeviceId: context.session.deviceTrustContext?.trustedDeviceId,
                  issuedOnTrustedDevice: context.session.deviceTrustContext?.issuedOnTrustedDevice,
                  trustState: context.session.deviceTrustContext?.trustStateSnapshot?.state,
                  trustEvaluatedAt: context.session.deviceTrustContext?.trustStateSnapshot?.evaluatedAt,
                  trustInvalidationReasons: context.session.deviceTrustContext?.invalidationReasons,
                }),
                trustedDevice,
                workspaceContext: Object.freeze({
                  requestedWorkspaceId,
                  resolvedWorkspaceId,
                  workspaces,
                }),
              }),
            });

            writeJson(response, 200, responseBody);
            logResponse(logger, requestId, request, 200, Object.freeze({
              actorUserIdentityId: context.actor.userIdentityId,
              sessionId: context.session.sessionId,
              requestedWorkspaceId,
              resolvedWorkspaceId,
              transport: context.transport,
            }), responseBody);
          },
        );
        return;
      }
      if (request.method === "POST" && path === "/api/v1/identity/logout") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const apiResponse = await options.backendApi.logoutAuthenticatedSession({
              sessionToken: context.sessionToken,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({ sessionToken: context.sessionToken }), apiResponse);
          },
        );
        return;
      }
      if (request.method === "POST" && path === "/api/v1/identity/session/revoke") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const parsedRequest = await parseAndValidateRequest(
              request,
              RevokeSessionRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.revokeIdentitySession({
              sessionId: parsedRequest.data.sessionId,
              reason: parsedRequest.data.reason,
              actorUserIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              sessionToken: context.sessionToken,
              ...parsedRequest.data,
              actorUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
      if (request.method === "GET" && path === "/api/v1/identity/sessions") {
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
            const includeStatuses = url.searchParams.getAll("status");
            const includeAccessChannels = url.searchParams.getAll("accessChannel");
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const validationError = buildQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }
            const statusValidation = z.array(IdentitySessionStatusValues).safeParse(includeStatuses);
            if (!statusValidation.success) {
              const validationError = buildQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }
            const accessChannelValidation = z.array(IdentitySessionAccessChannelValues).safeParse(includeAccessChannels);
            if (!accessChannelValidation.success) {
              const validationError = buildQueryValidationError("accessChannel", "accessChannel values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const apiResponse = await options.backendApi.listIdentitySessions({
              userIdentityId: context.principal.userIdentityId,
              includeStatuses: statusValidation.data,
              includeAccessChannels: accessChannelValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              userIdentityId: context.principal.userIdentityId,
              includeStatuses: statusValidation.data,
              includeAccessChannels: accessChannelValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            }), apiResponse);
          },
        );
        return;
      }
      if (request.method === "POST" && path === "/api/v1/identity/credential/change") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const parsedRequest = await parseAndValidateRequest(
              request,
              ChangeCredentialRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.changeLocalPasswordCredential({
              userIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              sessionToken: context.sessionToken,
              userIdentityId: context.principal.userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }
      if (request.method === "GET" && path === "/api/v1/identity/admin/accounts") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const includeStatuses = url.searchParams.getAll("status");
            const providerId = normalizeOptionalString(url.searchParams.get("providerId"));
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const validationError = buildQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const statusValidation = z.array(AdminAccountStatusValues).safeParse(includeStatuses);
            if (!statusValidation.success) {
              const validationError = buildQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const apiResponse = await options.backendApi.listIdentityAdminAccounts({
              context: buildAdminContext(context.principal.userIdentityId),
              providerId,
              includeStatuses: statusValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              providerId,
              includeStatuses: statusValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "GET" && path.startsWith("/api/v1/identity/admin/accounts/")) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const userIdentityId = decodePathTail(path, "/api/v1/identity/admin/accounts/");
            if (!userIdentityId) {
              const invalid = buildInvalidRequestResponse("userIdentityId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const providerId = normalizeOptionalString(resolveRequestSearchParams(request.url).get("providerId"));
            const apiResponse = await options.backendApi.getIdentityAdminAccountStatus({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              providerId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              providerId,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "POST" && path.endsWith("/status") && path.startsWith("/api/v1/identity/admin/accounts/")) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const userIdentityId = decodePathTail(path, "/api/v1/identity/admin/accounts/", "/status");
            if (!userIdentityId) {
              const invalid = buildInvalidRequestResponse("userIdentityId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateRequest(
              request,
              SetAdminAccountStatusRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.setIdentityAdminAccountStatus({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              action: parsedRequest.data.action,
              providerId: parsedRequest.data.providerId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "GET" && path === "/api/v1/identity/admin/sessions") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const userIdentityId = normalizeOptionalString(url.searchParams.get("userIdentityId"));
            if (!userIdentityId) {
              const invalid = buildInvalidRequestResponse("userIdentityId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const includeStatuses = url.searchParams.getAll("status");
            const includeAccessChannels = url.searchParams.getAll("accessChannel");
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const validationError = buildQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }
            const statusValidation = z.array(IdentitySessionStatusValues).safeParse(includeStatuses);
            if (!statusValidation.success) {
              const validationError = buildQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }
            const accessChannelValidation = z.array(IdentitySessionAccessChannelValues).safeParse(includeAccessChannels);
            if (!accessChannelValidation.success) {
              const validationError = buildQueryValidationError("accessChannel", "accessChannel values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const apiResponse = await options.backendApi.listIdentityAdminSessions({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              includeStatuses: statusValidation.data,
              includeAccessChannels: accessChannelValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              includeStatuses: statusValidation.data,
              includeAccessChannels: accessChannelValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        request.method === "POST"
        && path.endsWith("/revoke")
        && path.startsWith("/api/v1/identity/admin/sessions/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const sessionId = decodePathTail(path, "/api/v1/identity/admin/sessions/", "/revoke");
            if (!sessionId) {
              const invalid = buildInvalidRequestResponse("sessionId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const parsedRequest = await parseAndValidateRequest(
              request,
              RevokeSessionByPathRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.revokeIdentityAdminSession({
              context: buildAdminContext(context.principal.userIdentityId),
              sessionId,
              reason: parsedRequest.data.reason,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              sessionId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "GET" && path === "/api/v1/identity/admin/trusted-devices") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const userIdentityId = normalizeOptionalString(url.searchParams.get("userIdentityId"));
            if (!userIdentityId) {
              const invalid = buildInvalidRequestResponse("userIdentityId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const workspaceId = normalizeOptionalString(url.searchParams.get("workspaceId"));
            const includeStatuses = url.searchParams.getAll("status");
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const validationError = buildQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }
            const statusValidation = z.array(TrustedDeviceStatusValues).safeParse(includeStatuses);
            if (!statusValidation.success) {
              const validationError = buildQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const apiResponse = await options.backendApi.listIdentityAdminTrustedDevices({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              workspaceId,
              includeStatuses: statusValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              workspaceId,
              includeStatuses: statusValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        request.method === "POST"
        && path.endsWith("/revoke")
        && path.startsWith("/api/v1/identity/admin/trusted-devices/")
      ) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            sessionAssuranceRequirement: "require-trusted",
          },
          async (context: any) => {
            const trustedDeviceId = decodePathTail(path, "/api/v1/identity/admin/trusted-devices/", "/revoke");
            if (!trustedDeviceId) {
              const invalid = buildInvalidRequestResponse("trustedDeviceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const parsedRequest = await parseAndValidateRequest(
              request,
              RevokeIdentityAdminTrustedDeviceRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.revokeIdentityAdminTrustedDevice({
              context: buildAdminContext(context.principal.userIdentityId),
              trustedDeviceId,
              reason: parsedRequest.data.reason,
              note: parsedRequest.data.note,
              revokedAt: parsedRequest.data.revokedAt,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              trustedDeviceId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "GET" && path === "/api/v1/identity/trusted-devices") {
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
            const includeStatuses = url.searchParams.getAll("status");
            const pagination = parseSharedListPaginationFromQuery(url.searchParams);
            if (!pagination.ok) {
              const validationError = buildQueryValidationError(pagination.issue.path, pagination.issue.message);
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }
            const statusValidation = z.array(TrustedDeviceStatusValues).safeParse(includeStatuses);
            if (!statusValidation.success) {
              const validationError = buildQueryValidationError("status", "status values are invalid.");
              writeJson(response, 400, validationError);
              logResponse(logger, requestId, request, 400, Object.freeze({}), validationError);
              return;
            }

            const apiResponse = await options.backendApi.listTrustedDevices({
              userIdentityId: context.principal.userIdentityId,
              workspaceId: normalizeOptionalString(url.searchParams.get("workspaceId")),
              includeStatuses: statusValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              userIdentityId: context.principal.userIdentityId,
              workspaceId: normalizeOptionalString(url.searchParams.get("workspaceId")),
              includeStatuses: statusValidation.data,
              limit: pagination.limit,
              offset: pagination.offset,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "GET" && path.startsWith("/api/v1/identity/trusted-devices/")) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const trustedDeviceId = decodePathTail(path, "/api/v1/identity/trusted-devices/");
            if (!trustedDeviceId) {
              const invalid = buildInvalidRequestResponse("trustedDeviceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const apiResponse = await options.backendApi.getTrustedDevice({
              trustedDeviceId,
            });
            if (apiResponse.ok && apiResponse.data?.trustedDevice.userIdentityId !== context.principal.userIdentityId) {
              const forbidden = buildForbiddenResponse("Trusted device is not available for this account.");
              writeJson(response, 403, forbidden);
              logResponse(logger, requestId, request, 403, Object.freeze({
                trustedDeviceId,
                actorUserIdentityId: context.principal.userIdentityId,
              }), forbidden);
              return;
            }
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              trustedDeviceId,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "POST" && path.endsWith("/revoke") && path.startsWith("/api/v1/identity/trusted-devices/")) {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const trustedDeviceId = decodePathTail(path, "/api/v1/identity/trusted-devices/", "/revoke");
            if (!trustedDeviceId) {
              const invalid = buildInvalidRequestResponse("trustedDeviceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const authorizedDevice = await options.backendApi.getTrustedDevice({ trustedDeviceId });
            if (authorizedDevice.ok && authorizedDevice.data?.trustedDevice.userIdentityId !== context.principal.userIdentityId) {
              const forbidden = buildForbiddenResponse("Trusted device is not available for this account.");
              writeJson(response, 403, forbidden);
              logResponse(logger, requestId, request, 403, Object.freeze({
                trustedDeviceId,
                actorUserIdentityId: context.principal.userIdentityId,
              }), forbidden);
              return;
            }

            const parsedRequest = await parseAndValidateRequest(
              request,
              RevokeTrustedDeviceRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.revokeTrustedDevice({
              trustedDeviceId,
              reason: parsedRequest.data.reason,
              note: parsedRequest.data.note,
              revokedAt: parsedRequest.data.revokedAt,
              revokedByUserIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              trustedDeviceId,
              ...parsedRequest.data,
              revokedByUserIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

      if (
        request.method === "POST"
        && path.endsWith("/display-name")
        && path.startsWith("/api/v1/identity/trusted-devices/")
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
            const trustedDeviceId = decodePathTail(path, "/api/v1/identity/trusted-devices/", "/display-name");
            if (!trustedDeviceId) {
              const invalid = buildInvalidRequestResponse("trustedDeviceId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const authorizedDevice = await options.backendApi.getTrustedDevice({ trustedDeviceId });
            if (authorizedDevice.ok && authorizedDevice.data?.trustedDevice.userIdentityId !== context.principal.userIdentityId) {
              const forbidden = buildForbiddenResponse("Trusted device is not available for this account.");
              writeJson(response, 403, forbidden);
              logResponse(logger, requestId, request, 403, Object.freeze({
                trustedDeviceId,
                actorUserIdentityId: context.principal.userIdentityId,
              }), forbidden);
              return;
            }

            const parsedRequest = await parseAndValidateRequest(
              request,
              UpdateTrustedDeviceDisplayNameRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.updateTrustedDeviceDisplayName({
              trustedDeviceId,
              displayName: parsedRequest.data.displayName,
              updatedAt: parsedRequest.data.updatedAt,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              trustedDeviceId,
              ...parsedRequest.data,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "POST" && path === "/api/v1/identity/trusted-devices/pairing/initiate") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const parsedRequest = await parseAndValidateRequest(
              request,
              InitiateTrustedDevicePairingRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.initiateTrustedDevicePairing({
              ...parsedRequest.data,
              userIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              ...parsedRequest.data,
              userIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "POST" && path === "/api/v1/identity/trusted-devices/pairing/validate") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const parsedRequest = await parseAndValidateRequest(
              request,
              ValidateTrustedDevicePairingRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.validateTrustedDevicePairing({
              ...parsedRequest.data,
              userIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              ...parsedRequest.data,
              userIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "POST" && path === "/api/v1/identity/trusted-devices/pairing/complete") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          undefined,
          async (context: any) => {
            const parsedRequest = await parseAndValidateRequest(
              request,
              CompleteTrustedDevicePairingRequestSchema,
              requestId,
              logger,
              maxBodyBytes,
            );
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              return;
            }

            const apiResponse = await options.backendApi.completeTrustedDevicePairing({
              ...parsedRequest.data,
              userIdentityId: context.principal.userIdentityId,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              ...parsedRequest.data,
              userIdentityId: context.principal.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
    return Object.freeze({ handled: false });
  };
}

async function ensureDefaultWorkspaceForAuthenticatedSession(input: {
  readonly workspaceAdministrationBackendApi: {
    createWorkspace(request: {
      readonly actorUserIdentityId: string;
      readonly slug: string;
      readonly displayName: string;
      readonly visibility: "private";
      readonly status: "active";
    }): Promise<{
      readonly ok: boolean;
      readonly data?: {
        readonly workspace: {
          readonly workspaceId: string;
          readonly slug: string;
          readonly displayName: string;
          readonly status: string;
          readonly visibility: string;
          readonly actorAccess: {
            readonly membershipStatus?: string;
            readonly effectiveRoles: ReadonlyArray<string>;
            readonly canAdministrate: boolean;
            readonly isWorkspaceOwner: boolean;
          };
        };
      };
    }>;
  };
  readonly actorUserIdentityId: string;
  readonly username?: string;
  readonly existingWorkspaces: ReadonlyArray<{
    readonly workspaceId: string;
    readonly slug: string;
    readonly displayName: string;
    readonly status: string;
    readonly visibility: string;
    readonly membershipStatus?: string;
    readonly effectiveRoles: ReadonlyArray<string>;
    readonly canAdministrate: boolean;
    readonly isWorkspaceOwner: boolean;
  }>;
  readonly onDiagnostics?: (event: {
    readonly event: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }) => void;
}): Promise<ReadonlyArray<{
  readonly workspaceId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly status: string;
  readonly visibility: string;
  readonly membershipStatus?: string;
  readonly effectiveRoles: ReadonlyArray<string>;
  readonly canAdministrate: boolean;
  readonly isWorkspaceOwner: boolean;
}>> {
  const baseSlug = buildDefaultWorkspaceSlug(input.username, input.actorUserIdentityId);
  const baseDisplayName = buildDefaultWorkspaceDisplayName(input.username);
  const attempts = [baseSlug, `${baseSlug}-${Date.now().toString(36).slice(-4)}`];
  for (let index = 0; index < attempts.length; index += 1) {
    const slug = attempts[index];
    const created = await input.workspaceAdministrationBackendApi.createWorkspace({
      actorUserIdentityId: input.actorUserIdentityId,
      slug,
      displayName: baseDisplayName,
      visibility: "private",
      status: "active",
    });
    if (created.ok && created.data?.workspace) {
      input.onDiagnostics?.({
        event: "identity.session-context.default-workspace.ensure.completed",
        details: Object.freeze({
          created: true,
          resultingWorkspaceCount: 1,
          resolvedWorkspaceIdCandidate: created.data.workspace.workspaceId,
          createdWorkspaceId: created.data.workspace.workspaceId,
          createdWorkspaceSlug: created.data.workspace.slug,
        }),
      });
      return Object.freeze([
        Object.freeze({
          workspaceId: created.data.workspace.workspaceId,
          slug: created.data.workspace.slug,
          displayName: created.data.workspace.displayName,
          status: created.data.workspace.status,
          visibility: created.data.workspace.visibility,
          membershipStatus: created.data.workspace.actorAccess.membershipStatus,
          effectiveRoles: Object.freeze([...created.data.workspace.actorAccess.effectiveRoles]),
          canAdministrate: created.data.workspace.actorAccess.canAdministrate,
          isWorkspaceOwner: created.data.workspace.actorAccess.isWorkspaceOwner,
        }),
      ]);
    }
  }
  input.onDiagnostics?.({
    event: "identity.session-context.default-workspace.ensure.completed",
    details: Object.freeze({
      created: false,
      resultingWorkspaceCount: input.existingWorkspaces.length,
      resolvedWorkspaceIdCandidate: input.existingWorkspaces[0]?.workspaceId,
    }),
  });
  return input.existingWorkspaces;
}

function buildDefaultWorkspaceSlug(username: string | undefined, actorUserIdentityId: string): string {
  const usernameToken = normalizeWorkspaceSlugToken(username);
  if (usernameToken) {
    return `${usernameToken}-workspace`;
  }
  const identityToken = normalizeWorkspaceSlugToken(actorUserIdentityId) ?? "default-workspace";
  return `${identityToken}-workspace`;
}

function buildDefaultWorkspaceDisplayName(username: string | undefined): string {
  const normalized = normalizeDisplayNameToken(username);
  if (!normalized) {
    return "My Workspace";
  }
  return `${normalized}'s Workspace`;
}

function normalizeWorkspaceSlugToken(value: string | undefined): string | undefined {
  const normalized = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized.length > 0 ? normalized.slice(0, 42) : undefined;
}

function normalizeDisplayNameToken(value: string | undefined): string | undefined {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}
