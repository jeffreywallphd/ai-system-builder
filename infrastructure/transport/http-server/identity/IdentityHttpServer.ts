import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { z } from "zod";
import type { IdentityAuthBackendApi } from "../../../api/identity/IdentityAuthBackendApi";
import type { WorkspaceInvitationBackendApi } from "../../../api/workspaces/WorkspaceInvitationBackendApi";
import type { WorkspaceAdministrationBackendApi } from "../../../api/workspaces/WorkspaceAdministrationBackendApi";
import {
  ChangeLocalPasswordCredentialVerificationModes,
  IdentityAuthApiErrorCodes,
  type ChangeLocalPasswordCredentialApiRequest,
  type AuthenticatedIdentityPrincipalApiResponse,
  type GetIdentityAdminAccountStatusApiRequest,
  type GetIdentityAdminAccountStatusApiResponse,
  type ListTrustedDevicesApiRequest,
  type ListTrustedDevicesApiResponse,
  type IdentityAuthApiResponse,
  type ListIdentityAdminAccountsApiRequest,
  type ListIdentityAdminAccountsApiResponse,
  type LoginLocalIdentityApiRequest,
  type CompleteTrustedDevicePairingApiRequest,
  type CompleteTrustedDevicePairingApiResponse,
  type GetTrustedDeviceApiRequest,
  type GetTrustedDeviceApiResponse,
  type InitiateTrustedDevicePairingApiRequest,
  type InitiateTrustedDevicePairingApiResponse,
  type RevokeTrustedDeviceApiRequest,
  type RevokeTrustedDeviceApiResponse,
  type RevokeIdentityAdminTrustedDeviceApiRequest,
  type RevokeIdentityAdminTrustedDeviceApiResponse,
  type RevokeIdentitySessionApiRequest,
  type ResolveAuthenticatedSessionApiResponse,
  type RegisterLocalIdentityApiRequest,
  type SetIdentityAdminAccountStatusApiRequest,
  type SetIdentityAdminAccountStatusApiResponse,
  type UpdateTrustedDeviceDisplayNameApiRequest,
  type UpdateTrustedDeviceDisplayNameApiResponse,
  type ValidateTrustedDevicePairingApiRequest,
  type ValidateTrustedDevicePairingApiResponse,
} from "../../../api/identity/sdk/PublicIdentityAuthApiContract";
import {
  WorkspaceInvitationApiErrorCodes,
  type AcceptWorkspaceInvitationOnboardingApiRequest,
  type IssueWorkspaceInvitationApiRequest,
  type WorkspaceInvitationApiResponse,
} from "../../../api/workspaces/sdk/PublicWorkspaceInvitationApiContract";
import {
  WorkspaceAdministrationApiErrorCodes,
  type WorkspaceAdministrationApiResponse,
} from "../../../api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import { redactSensitiveAuthPayload, redactSensitiveText } from "../../../api/identity/IdentityAuthRedaction";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

const RegisterRequestSchema: z.ZodType<RegisterLocalIdentityApiRequest> = z.object({
  username: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  providerSubject: z.string().min(1).optional(),
  credentialPolicyId: z.string().min(1).optional(),
  credential: z.object({
    candidate: z.string().min(1),
  }).strict(),
}).strict();

const LoginRequestSchema: z.ZodType<LoginLocalIdentityApiRequest> = z.object({
  providerId: z.string().min(1).optional(),
  providerSubject: z.string().min(1),
  accessChannel: z.enum(["desktop", "thin-client"]).optional(),
  sessionTrustRequirement: z.enum(["allow-untrusted", "allow-pairing", "require-trusted"]).optional(),
  client: z.object({
    userAgent: z.string().min(1).optional(),
    ipAddress: z.string().min(1).optional(),
    deviceId: z.string().min(1).optional(),
    deviceTrustContext: z.object({
      trustedDeviceId: z.string().min(1).optional(),
      issuedOnTrustedDevice: z.boolean().optional(),
      sessionAssuranceLevel: z.enum([
        "authenticated-untrusted",
        "authenticated-trusted",
        "authenticated-restricted",
      ]).optional(),
      trustStateSnapshot: z.object({
        state: z.enum([
          "unknown",
          "untrusted",
          "trusted",
          "pending-pairing",
          "revoked",
          "expired",
        ]),
        evaluatedAt: z.string().datetime(),
      }).strict().optional(),
      invalidationReasons: z.array(z.enum([
        "trusted-device-revoked",
        "trusted-device-trust-lost",
        "trusted-device-expired",
        "trusted-device-mismatch",
      ])).optional(),
      trustedDeviceBindingId: z.string().min(1).optional(),
      trustMarker: z.string().min(1).optional(),
    }).strict().optional(),
    trustedDeviceBindingId: z.string().min(1).optional(),
    trustMarker: z.string().min(1).optional(),
  }).strict().optional(),
  credential: z.object({
    candidate: z.string().min(1),
  }).strict(),
}).strict();

const RevokeSessionRequestSchema: z.ZodType<Pick<RevokeIdentitySessionApiRequest, "sessionId" | "reason">> = z.object({
  sessionId: z.string().min(1),
  reason: z.enum(["logout", "security", "rotation", "admin"]).optional(),
}).strict();

const AdminAccountStatusValues = z.enum([
  "pending-activation",
  "active",
  "suspended",
  "locked",
  "deactivated",
]);

const SetAdminAccountStatusRequestSchema: z.ZodType<Pick<SetIdentityAdminAccountStatusApiRequest, "action" | "providerId">> = z.object({
  action: z.enum(["enable", "disable"]),
  providerId: z.string().min(1).optional(),
}).strict();

const ChangeCredentialCurrentVerificationSchema = z.object({
  mode: z.literal(ChangeLocalPasswordCredentialVerificationModes.currentCredential).optional(),
  currentCredential: z.string().min(1),
}).strict();

const ChangeCredentialResetVerificationSchema = z.object({
  mode: z.literal(ChangeLocalPasswordCredentialVerificationModes.resetAssertion),
  resetAssertion: z.string().min(1),
}).strict();

const ChangeCredentialVerificationSchema = z.union([
  ChangeCredentialCurrentVerificationSchema,
  ChangeCredentialResetVerificationSchema,
]);

const ChangeCredentialRequestSchema: z.ZodType<ChangeLocalPasswordCredentialApiRequest> = z.object({
  providerId: z.string().min(1).optional(),
  providerSubject: z.string().min(1).optional(),
  credentialPolicyId: z.string().min(1).optional(),
  newCredential: z.object({
    candidate: z.string().min(1),
  }).strict(),
  verification: ChangeCredentialVerificationSchema,
}).strict();

const TrustedDeviceStatusValues = z.enum(["pending-pairing", "trusted", "revoked", "expired"]);
const TrustedDevicePairingMethodValues = z.enum([
  "one-time-code",
  "qr-code",
  "passkey",
  "admin-provisioned",
  "recovery-flow",
]);
const TrustedDeviceRevocationReasonValues = z.enum([
  "user-request",
  "admin-action",
  "lost-device",
  "suspected-compromise",
  "workspace-access-removed",
  "policy-violation",
]);

const RevokeTrustedDeviceRequestSchema: z.ZodType<
  Pick<RevokeTrustedDeviceApiRequest, "reason" | "note" | "revokedAt">
> = z.object({
  reason: TrustedDeviceRevocationReasonValues,
  note: z.string().min(1).max(1024).optional(),
  revokedAt: z.string().datetime().optional(),
}).strict();

const RevokeIdentityAdminTrustedDeviceRequestSchema: z.ZodType<
  Pick<RevokeIdentityAdminTrustedDeviceApiRequest, "reason" | "note" | "revokedAt">
> = z.object({
  reason: TrustedDeviceRevocationReasonValues,
  note: z.string().min(1).max(1024).optional(),
  revokedAt: z.string().datetime().optional(),
}).strict();

const UpdateTrustedDeviceDisplayNameRequestSchema: z.ZodType<
  Pick<UpdateTrustedDeviceDisplayNameApiRequest, "displayName" | "updatedAt">
> = z.object({
  displayName: z.string().min(1).max(80),
  updatedAt: z.string().datetime().optional(),
}).strict();

const InitiateTrustedDevicePairingRequestSchema: z.ZodType<InitiateTrustedDevicePairingApiRequest> = z.object({
  trustedDeviceId: z.string().min(1),
  userIdentityId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  artifactType: z.enum(["one-time-code", "qr-payload"]),
  actorBinding: z.object({
    scope: z.enum(["same-user", "workspace-admin", "bootstrap-admin", "session-bound"]),
    userIdentityId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
  }).strict(),
  issuance: z.object({
    issuedByUserIdentityId: z.string().min(1).optional(),
    issuedFromIpAddress: z.string().min(1).optional(),
    issuedFromUserAgent: z.string().min(1).optional(),
    channelHint: z.string().min(1).optional(),
  }).strict().optional(),
  maxValidationAttempts: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime(),
}).strict();

const ValidateTrustedDevicePairingRequestSchema: z.ZodType<ValidateTrustedDevicePairingApiRequest> = z.object({
  pairingSessionId: z.string().min(1),
  pairingTokenId: z.string().min(1).optional(),
  trustedDeviceId: z.string().min(1),
  userIdentityId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  presentedToken: z.string().min(1),
  attemptedAt: z.string().datetime().optional(),
}).strict();

const CompleteTrustedDevicePairingRequestSchema: z.ZodType<CompleteTrustedDevicePairingApiRequest> = z.object({
  pairingSessionId: z.string().min(1),
  pairingTokenId: z.string().min(1),
  trustedDeviceId: z.string().min(1),
  userIdentityId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  trustedDeviceRegistration: z.object({
    displayName: z.string().min(1).max(80),
    fingerprint: z.object({
      algorithm: z.enum(["sha256", "sha512", "opaque"]),
      value: z.string().min(1),
      capturedAt: z.string().datetime(),
    }).strict(),
    pairingMethod: TrustedDevicePairingMethodValues,
    metadata: z.object({
      platform: z.string().min(1).optional(),
      osVersion: z.string().min(1).optional(),
      appVersion: z.string().min(1).optional(),
      deviceModel: z.string().min(1).optional(),
      locale: z.string().min(1).optional(),
      lastIpAddress: z.string().min(1).optional(),
    }).strict().optional(),
    registeredAt: z.string().datetime().optional(),
  }).strict().optional(),
  presentedToken: z.string().min(1),
  completedAt: z.string().datetime().optional(),
  completedByUserIdentityId: z.string().min(1).optional(),
  trustMaterialRef: z.object({
    materialId: z.string().min(1),
    kind: z.enum(["session-signing-key", "attestation-key", "opaque-marker"]),
    version: z.string().min(1).optional(),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
  }).strict().optional(),
  trustMaterialRegistration: z.object({
    materialKind: z.enum(["session-signing-key", "attestation-key", "opaque-marker"]),
    pinReference: z.string().min(1),
    publicKeyFingerprint: z.string().min(1).optional(),
  }).strict().optional(),
}).strict();

const WorkspaceRoleValues = z.enum(["owner", "admin", "member", "viewer"]);
const WorkspaceStatusValues = z.enum(["provisioning", "active", "suspended", "archived"]);
const WorkspaceVisibilityValues = z.enum(["private", "team", "public"]);
const WorkspaceMembershipStatusValues = z.enum(["pending", "active", "suspended", "removed"]);
const WorkspaceRoleAssignmentStatusValues = z.enum(["active", "revoked"]);
const WorkspaceInvitationStatusValues = z.enum(["pending", "accepted", "declined", "revoked", "expired"]);
const WorkspaceLifecycleActionValues = z.enum(["archive", "reactivate", "suspend", "activate"]);

const IssueWorkspaceInvitationRequestSchema: z.ZodType<Pick<
  IssueWorkspaceInvitationApiRequest,
  "invitedEmail" | "invitedRoles" | "expiresAt" | "expiresInMs" | "targetUserIdentityIdHint" | "onboardingMetadata"
>> = z.object({
  invitedEmail: z.string().email(),
  invitedRoles: z.array(WorkspaceRoleValues).min(1),
  expiresAt: z.string().datetime().optional(),
  expiresInMs: z.number().int().positive().optional(),
  targetUserIdentityIdHint: z.string().min(1).optional(),
  onboardingMetadata: z.record(z.unknown()).optional(),
}).strict();

const AcceptWorkspaceInvitationOnboardingRequestSchema: z.ZodType<Pick<
  AcceptWorkspaceInvitationOnboardingApiRequest,
  "invitationToken" | "onboardingMetadata"
>> = z.object({
  invitationToken: z.string().min(1),
  onboardingMetadata: z.record(z.unknown()).optional(),
}).strict();

const CreateWorkspaceRequestSchema = z.object({
  slug: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  visibility: WorkspaceVisibilityValues.optional(),
  status: WorkspaceStatusValues.optional(),
}).strict();

const UpdateWorkspaceRequestSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  visibility: WorkspaceVisibilityValues.optional(),
}).strict();

const TransitionWorkspaceLifecycleRequestSchema = z.object({
  action: WorkspaceLifecycleActionValues,
}).strict();

const AddWorkspaceMemberRequestSchema = z.object({
  targetUserIdentityId: z.string().min(1),
  initialStatus: WorkspaceMembershipStatusValues.optional(),
  roles: z.array(WorkspaceRoleValues).min(1).optional(),
}).strict();

const ChangeWorkspaceMembershipStatusRequestSchema = z.object({
  status: WorkspaceMembershipStatusValues,
}).strict();

const WorkspaceRoleAuditSchema = z.object({
  reason: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const AssignWorkspaceRoleRequestSchema = z.object({
  targetUserIdentityId: z.string().min(1),
  role: WorkspaceRoleValues,
  reason: WorkspaceRoleAuditSchema.shape.reason,
  correlationId: WorkspaceRoleAuditSchema.shape.correlationId,
  metadata: WorkspaceRoleAuditSchema.shape.metadata,
}).strict();

const ReassignWorkspaceRoleRequestSchema = z.object({
  targetUserIdentityId: z.string().min(1),
  fromRole: WorkspaceRoleValues,
  toRole: WorkspaceRoleValues,
  reason: WorkspaceRoleAuditSchema.shape.reason,
  correlationId: WorkspaceRoleAuditSchema.shape.correlationId,
  metadata: WorkspaceRoleAuditSchema.shape.metadata,
}).strict();

const RevokeWorkspaceRoleRequestSchema = z.object({
  targetUserIdentityId: z.string().min(1),
  role: WorkspaceRoleValues,
  reason: WorkspaceRoleAuditSchema.shape.reason,
  correlationId: WorkspaceRoleAuditSchema.shape.correlationId,
  metadata: WorkspaceRoleAuditSchema.shape.metadata,
}).strict();

export interface IdentityHttpServerLogEvent {
  readonly event: string;
  readonly requestId: string;
  readonly method?: string;
  readonly path?: string;
  readonly statusCode?: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IdentityHttpServerLogger {
  info(event: IdentityHttpServerLogEvent): void;
  warn(event: IdentityHttpServerLogEvent): void;
  error(event: IdentityHttpServerLogEvent): void;
}

export interface IdentityHttpServerOptions {
  readonly backendApi: IdentityAuthBackendApi;
  readonly workspaceBackendApi?: WorkspaceInvitationBackendApi;
  readonly workspaceAdministrationBackendApi?: WorkspaceAdministrationBackendApi;
  readonly logger?: IdentityHttpServerLogger;
  readonly maxBodyBytes?: number;
}

interface AuthenticatedRequestContext {
  readonly principal: AuthenticatedIdentityPrincipalApiResponse;
  readonly session: ResolveAuthenticatedSessionApiResponse["session"];
  readonly sessionToken: string;
  readonly sessionTrust: {
    readonly assuranceLevel: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
    readonly isTrusted: boolean;
  };
}

export function createIdentityHttpServer(options: IdentityHttpServerOptions): Server {
  const logger = options.logger ?? new ConsoleIdentityHttpServerLogger();
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    logger.info(Object.freeze({
      event: "identity-http.request.received",
      requestId,
      method: request.method,
      path,
    }));

    try {
      if (request.method === "POST" && path === "/api/v1/identity/register") {
        await handleRegister(request, response, requestId, options.backendApi, logger, maxBodyBytes);
        return;
      }
      if (request.method === "POST" && path === "/api/v1/identity/login") {
        await handleLogin(request, response, requestId, options.backendApi, logger, maxBodyBytes);
        return;
      }
      if (request.method === "GET" && path === "/api/v1/identity/session") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          undefined,
          async (context) => {
            const responseBody: IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse> = Object.freeze({
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
      if (request.method === "POST" && path === "/api/v1/identity/credential/change") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          {
            minimumAssuranceLevel: "authenticated-trusted",
          },
          async (context) => {
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
          {
            minimumAssuranceLevel: "authenticated-trusted",
          },
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const includeStatuses = url.searchParams.getAll("status");
            const limit = parseOptionalInteger(url.searchParams.get("limit"));
            const offset = parseOptionalInteger(url.searchParams.get("offset"));
            const providerId = normalizeOptionalString(url.searchParams.get("providerId"));

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
              limit,
              offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              providerId,
              includeStatuses: statusValidation.data,
              limit,
              offset,
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
          {
            minimumAssuranceLevel: "authenticated-trusted",
          },
          async (context) => {
            const userIdentityId = decodePathTail(path, "/api/v1/identity/admin/accounts/");
            if (!userIdentityId) {
              const invalid = buildInvalidRequestResponse("userIdentityId is required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const providerId = normalizeOptionalString(new URL(request.url ?? "/", "http://localhost").searchParams.get("providerId"));
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
          {
            minimumAssuranceLevel: "authenticated-trusted",
          },
          async (context) => {
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

      if (request.method === "GET" && path === "/api/v1/identity/admin/trusted-devices") {
        await requireAuthenticatedSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          {
            minimumAssuranceLevel: "authenticated-trusted",
          },
          async (context) => {
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
            const limit = parseOptionalInteger(url.searchParams.get("limit"));
            const offset = parseOptionalInteger(url.searchParams.get("offset"));
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
              limit,
              offset,
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              context: buildAdminContext(context.principal.userIdentityId),
              userIdentityId,
              workspaceId,
              includeStatuses: statusValidation.data,
              limit,
              offset,
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
          {
            minimumAssuranceLevel: "authenticated-trusted",
          },
          async (context) => {
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
          undefined,
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const includeStatuses = url.searchParams.getAll("status");
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
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
            });
            const statusCode = mapStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              userIdentityId: context.principal.userIdentityId,
              workspaceId: normalizeOptionalString(url.searchParams.get("workspaceId")),
              includeStatuses: statusValidation.data,
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
            const url = new URL(request.url ?? "/", "http://localhost");
            const statuses = url.searchParams.getAll("status");
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaces({
              actorUserIdentityId: context.principal.userIdentityId,
              ownerUserIdentityId: normalizeOptionalString(url.searchParams.get("ownerUserIdentityId")),
              statuses: statuses.length > 0 ? statuses.filter((status) => WorkspaceStatusValues.safeParse(status).success) as Array<z.infer<typeof WorkspaceStatusValues>> : undefined,
              visibility: parseOptionalEnum(url.searchParams.get("visibility"), WorkspaceVisibilityValues.options),
              slugPrefix: normalizeOptionalString(url.searchParams.get("slugPrefix")),
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaceMemberships({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              userIdentityId: normalizeOptionalString(url.searchParams.get("userIdentityId")),
              statuses: statuses.length > 0 ? statuses : undefined,
              invitationId: normalizeOptionalString(url.searchParams.get("invitationId")),
              invitedByUserIdentityId: normalizeOptionalString(url.searchParams.get("invitedByUserIdentityId")),
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
            const apiResponse = await options.workspaceAdministrationBackendApi.listWorkspaceRoleAssignments({
              workspaceId,
              actorUserIdentityId: context.principal.userIdentityId,
              userIdentityId: normalizeOptionalString(url.searchParams.get("userIdentityId")),
              roles: roles.length > 0 ? roles : undefined,
              statuses: statuses.length > 0 ? statuses : undefined,
              limit: parseOptionalInteger(url.searchParams.get("limit")),
              offset: parseOptionalInteger(url.searchParams.get("offset")),
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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
          undefined,
          async (context) => {
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

      writeJson(response, 404, {
        ok: false,
        error: {
          code: IdentityAuthApiErrorCodes.invalidRequest,
          message: "Route not found.",
        },
      });
      logger.warn(Object.freeze({
        event: "identity-http.request.not-found",
        requestId,
        method: request.method,
        path,
        statusCode: 404,
      }));
    } catch (error) {
      writeJson(response, 500, {
        ok: false,
        error: {
          code: IdentityAuthApiErrorCodes.internal,
          message: "Unexpected identity HTTP transport failure.",
        },
      });
      logger.error(Object.freeze({
        event: "identity-http.request.unhandled-error",
        requestId,
        method: request.method,
        path,
        statusCode: 500,
        details: {
          error: normalizeError(error),
        },
      }));
    }
  });
}

async function handleRegister(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  backendApi: IdentityAuthBackendApi,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<void> {
  const parsedRequest = await parseAndValidateRequest(
    request,
    RegisterRequestSchema,
    requestId,
    logger,
    maxBodyBytes,
  );
  if (!parsedRequest.ok) {
    writeJson(response, parsedRequest.statusCode, parsedRequest.body);
    return;
  }

  const apiResponse = await backendApi.registerLocalAccount(parsedRequest.data);
  const statusCode = mapStatusCode(apiResponse);
  writeJson(response, statusCode, apiResponse);
  logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
}

async function requireAuthenticatedSession(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  backendApi: IdentityAuthBackendApi,
  logger: IdentityHttpServerLogger,
  options: {
    readonly minimumAssuranceLevel?: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
  } | undefined,
  onAuthenticated: (context: AuthenticatedRequestContext) => Promise<void>,
): Promise<void> {
  const sessionToken = extractBearerToken(request.headers.authorization);
  if (!sessionToken) {
    const authFailure = buildAuthenticationFailedResponse("Missing Authorization bearer token.");
    writeJson(response, 401, authFailure);
    logResponse(logger, requestId, request, 401, Object.freeze({}), authFailure);
    return;
  }

  const resolvedSession = await backendApi.resolveAuthenticatedSession({ sessionToken });
  if (!resolvedSession.ok) {
    const statusCode = mapStatusCode(resolvedSession);
    writeJson(response, statusCode, resolvedSession);
    logResponse(logger, requestId, request, statusCode, Object.freeze({ sessionToken }), resolvedSession);
    return;
  }
  if (!resolvedSession.data) {
    const internalFailure: IdentityAuthApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.internal,
        message: "Session resolution returned no payload.",
      },
    });
    writeJson(response, 500, internalFailure);
    logResponse(logger, requestId, request, 500, Object.freeze({ sessionToken }), internalFailure);
    return;
  }

  const sessionAssuranceLevel = normalizeSessionAssuranceLevel(resolvedSession.data.session.deviceTrustContext?.sessionAssuranceLevel);
  if (options?.minimumAssuranceLevel && !isSessionAssuranceAllowed(sessionAssuranceLevel, options.minimumAssuranceLevel)) {
    const forbidden: IdentityAuthApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.forbidden,
        message: "Session trust level is insufficient for this route.",
      },
    });
    writeJson(response, 403, forbidden);
    logResponse(logger, requestId, request, 403, Object.freeze({
      sessionToken,
      sessionAssuranceLevel,
      minimumAssuranceLevel: options.minimumAssuranceLevel,
    }), forbidden);
    return;
  }

  await onAuthenticated(Object.freeze({
    principal: resolvedSession.data.principal,
    session: resolvedSession.data.session,
    sessionToken,
    sessionTrust: Object.freeze({
      assuranceLevel: sessionAssuranceLevel,
      isTrusted: sessionAssuranceLevel === "authenticated-trusted",
    }),
  }));
}

async function handleLogin(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  backendApi: IdentityAuthBackendApi,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<void> {
  const parsedRequest = await parseAndValidateRequest(
    request,
    LoginRequestSchema,
    requestId,
    logger,
    maxBodyBytes,
  );
  if (!parsedRequest.ok) {
    writeJson(response, parsedRequest.statusCode, parsedRequest.body);
    return;
  }

  const apiResponse = await backendApi.loginLocalAccount(parsedRequest.data);
  const statusCode = mapStatusCode(apiResponse);
  writeJson(response, statusCode, apiResponse);
  logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
}

async function parseAndValidateRequest<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: IdentityAuthApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.invalidRequest,
        message: parsedBody.error,
      },
    });
    logger.warn(Object.freeze({
      event: "identity-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const validation = schema.safeParse(parsedBody.value);
  if (!validation.success) {
    const body = Object.freeze({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(validation.error.issues.map((issue) => Object.freeze({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        }))),
      },
    });
    logger.warn(Object.freeze({
      event: "identity-http.request.validation-failed",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
        issues: body.error.validationErrors,
      },
    }));
    return { ok: false, statusCode: 400, body };
  }

  return { ok: true, data: validation.data };
}

async function parseAndValidateWorkspaceRequest<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: WorkspaceInvitationApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildWorkspaceInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "workspace-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const validation = schema.safeParse(parsedBody.value);
  if (!validation.success) {
    const body: WorkspaceInvitationApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: WorkspaceInvitationApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(validation.error.issues.map((issue) => Object.freeze({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        }))),
      },
    });
    logger.warn(Object.freeze({
      event: "workspace-http.request.validation-failed",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
        issues: body.error?.validationErrors,
      },
    }));
    return { ok: false, statusCode: 400, body };
  }

  return { ok: true, data: validation.data };
}

async function parseAndValidateWorkspaceAdministrationRequest<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: WorkspaceAdministrationApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildWorkspaceAdministrationInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "workspace-admin-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const validation = schema.safeParse(parsedBody.value);
  if (!validation.success) {
    const body: WorkspaceAdministrationApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: WorkspaceAdministrationApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(validation.error.issues.map((issue) => Object.freeze({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        }))),
      },
    });
    logger.warn(Object.freeze({
      event: "workspace-admin-http.request.validation-failed",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
        issues: body.error?.validationErrors,
      },
    }));
    return { ok: false, statusCode: 400, body };
  }

  return { ok: true, data: validation.data };
}

async function parseJsonBody(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;
    if (totalBytes > maxBodyBytes) {
      return {
        ok: false,
        error: `Request body exceeds limit of ${maxBodyBytes} bytes.`,
      };
    }
    chunks.push(bufferChunk);
  }

  if (chunks.length === 0) {
    return { ok: false, error: "Request body is required." };
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, error: "Request body must be valid JSON." };
  }
}

function mapStatusCode(response: IdentityAuthApiResponse<unknown>): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error?.code) {
    case IdentityAuthApiErrorCodes.invalidRequest:
      return 400;
    case IdentityAuthApiErrorCodes.conflict:
      return 409;
    case IdentityAuthApiErrorCodes.authenticationFailed:
      return 401;
    case IdentityAuthApiErrorCodes.accountInactive:
      return 403;
    case IdentityAuthApiErrorCodes.forbidden:
      return 403;
    case IdentityAuthApiErrorCodes.unsupportedProvider:
      return 422;
    case IdentityAuthApiErrorCodes.notFound:
      return 404;
    default:
      return 500;
  }
}

function mapWorkspaceStatusCode(response: WorkspaceInvitationApiResponse<unknown>): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error?.code) {
    case WorkspaceInvitationApiErrorCodes.invalidRequest:
      return 400;
    case WorkspaceInvitationApiErrorCodes.authenticationFailed:
      return 401;
    case WorkspaceInvitationApiErrorCodes.forbidden:
      return 403;
    case WorkspaceInvitationApiErrorCodes.notFound:
      return 404;
    case WorkspaceInvitationApiErrorCodes.conflict:
      return 409;
    case WorkspaceInvitationApiErrorCodes.invalidInvite:
      return 400;
    default:
      return 500;
  }
}

function mapWorkspaceAdministrationStatusCode(response: WorkspaceAdministrationApiResponse<unknown>): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error?.code) {
    case WorkspaceAdministrationApiErrorCodes.invalidRequest:
      return 400;
    case WorkspaceAdministrationApiErrorCodes.authenticationFailed:
      return 401;
    case WorkspaceAdministrationApiErrorCodes.forbidden:
      return 403;
    case WorkspaceAdministrationApiErrorCodes.notFound:
      return 404;
    case WorkspaceAdministrationApiErrorCodes.conflict:
      return 409;
    case WorkspaceAdministrationApiErrorCodes.invalidTransition:
      return 422;
    default:
      return 500;
  }
}

function parseOptionalInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function parseOptionalEnum<TValue extends string>(
  value: string | null,
  enumeration: ReadonlyArray<TValue>,
): TValue | undefined {
  if (!value) {
    return undefined;
  }
  return enumeration.includes(value as TValue) ? (value as TValue) : undefined;
}

function normalizeOptionalString(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function buildAdminContext(actorUserIdentityId: string): ListIdentityAdminAccountsApiRequest["context"] {
  return Object.freeze({ actorUserIdentityId });
}

function decodePathTail(path: string, prefix: string, suffix = ""): string | undefined {
  if (!path.startsWith(prefix) || (suffix && !path.endsWith(suffix))) {
    return undefined;
  }

  const tail = suffix
    ? path.slice(prefix.length, path.length - suffix.length)
    : path.slice(prefix.length);

  const decoded = decodeURIComponent(tail).trim();
  return decoded ? decoded : undefined;
}

function decodeWorkspaceEntityPath(
  path: string,
  separator: string,
): { readonly workspaceId: string; readonly entityId: string } | undefined {
  if (!path.startsWith("/api/v1/workspaces/") || !path.includes(separator)) {
    return undefined;
  }

  const markerIndex = path.indexOf(separator, "/api/v1/workspaces/".length);
  if (markerIndex < 0) {
    return undefined;
  }

  const workspaceRaw = path.slice("/api/v1/workspaces/".length, markerIndex);
  const entityRaw = path.slice(markerIndex + separator.length);
  const workspaceId = decodeURIComponent(workspaceRaw).trim();
  const entityId = decodeURIComponent(entityRaw).trim();
  if (!workspaceId || !entityId) {
    return undefined;
  }

  return Object.freeze({
    workspaceId,
    entityId,
  });
}

function decodeWorkspaceUserScopedPath(
  path: string,
  separator: "/members/",
  suffix?: "/status",
): { readonly workspaceId: string; readonly userIdentityId: string } | undefined {
  const withEntity = decodeWorkspaceEntityPath(path, separator);
  if (!withEntity) {
    return undefined;
  }

  const userIdentityId = suffix
    ? withEntity.entityId.endsWith(suffix)
      ? withEntity.entityId.slice(0, withEntity.entityId.length - suffix.length).trim()
      : ""
    : withEntity.entityId;

  if (!userIdentityId) {
    return undefined;
  }

  return Object.freeze({
    workspaceId: withEntity.workspaceId,
    userIdentityId,
  });
}

function buildInvalidRequestResponse(message: string): IdentityAuthApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: IdentityAuthApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildWorkspaceInvalidRequestResponse(message: string): WorkspaceInvitationApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: WorkspaceInvitationApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildWorkspaceAdministrationInvalidRequestResponse(message: string): WorkspaceAdministrationApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: WorkspaceAdministrationApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildForbiddenResponse(message: string): IdentityAuthApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: IdentityAuthApiErrorCodes.forbidden,
      message,
    },
  });
}

function buildQueryValidationError(path: string, message: string): IdentityAuthApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: IdentityAuthApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze([Object.freeze({
        path,
        code: "invalid_enum_value",
        message,
      })]),
    },
  });
}

function extractBearerToken(authorizationHeader: string | string[] | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!value) {
    return undefined;
  }

  const match = value.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (!match) {
    return undefined;
  }

  const token = match[1]?.trim();
  return token ? token : undefined;
}

function buildAuthenticationFailedResponse(message: string): IdentityAuthApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: IdentityAuthApiErrorCodes.authenticationFailed,
      message,
    },
  });
}

function logResponse<TRequest extends Record<string, unknown>>(
  logger: IdentityHttpServerLogger,
  requestId: string,
  request: IncomingMessage,
  statusCode: number,
  requestPayload: TRequest,
  responsePayload: unknown,
): void {
  const event = Object.freeze({
    event: "identity-http.request.completed",
    requestId,
    method: request.method,
    path: request.url,
    statusCode,
    details: {
      request: redactSensitiveAuthPayload(requestPayload),
      response: redactSensitiveAuthPayload(responsePayload),
    },
  });

  if (statusCode >= 500) {
    logger.error(event);
    return;
  }
  if (statusCode >= 400) {
    logger.warn(event);
    return;
  }

  logger.info(event);
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveText(error.message);
  }
  return "Unknown error";
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function normalizeSessionAssuranceLevel(
  value: ResolveAuthenticatedSessionApiResponse["session"]["deviceTrustContext"] extends { readonly sessionAssuranceLevel?: infer T } ? T : never,
): "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted" {
  if (value === "authenticated-trusted" || value === "authenticated-restricted") {
    return value;
  }
  return "authenticated-untrusted";
}

function isSessionAssuranceAllowed(
  actual: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted",
  minimum: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted",
): boolean {
  const order = Object.freeze({
    "authenticated-untrusted": 1,
    "authenticated-restricted": 2,
    "authenticated-trusted": 3,
  });
  return order[actual] >= order[minimum];
}

class ConsoleIdentityHttpServerLogger implements IdentityHttpServerLogger {
  public info(event: IdentityHttpServerLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: IdentityHttpServerLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: IdentityHttpServerLogEvent): void {
    console.error(JSON.stringify(event));
  }
}
