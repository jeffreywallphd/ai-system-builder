import {
  createServer as createHttpServer,
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerResponse,
} from "node:http";
import type { Server as HttpsServer } from "node:https";
import { createHash, randomUUID } from "node:crypto";
import type { Socket } from "node:net";
import { URL } from "node:url";
import { z } from "zod";
import type { IdentityAuthBackendApi } from "../../../api/identity/IdentityAuthBackendApi";
import type { AuthorizationManagementBackendApi } from "../../../api/authorization/AuthorizationManagementBackendApi";
import type { AuditLedgerBackendApi } from "../../../api/audit/AuditLedgerBackendApi";
import type { NodeTrustBackendApi } from "../../../api/nodes/NodeTrustBackendApi";
import type { ExecutionNodeManagementBackendApi } from "../../../api/nodes/ExecutionNodeManagementBackendApi";
import type { CertificateOperationsBackendApi } from "../../../api/security/CertificateOperationsBackendApi";
import type { SecretMetadataBackendApi } from "../../../api/security/SecretMetadataBackendApi";
import type { StorageManagementBackendApi } from "../../../api/storage/StorageManagementBackendApi";
import type { AssetManagementBackendApi } from "../../../api/assets/AssetManagementBackendApi";
import type { ImageAssetManagementBackendApi } from "../../../api/image-assets/ImageAssetManagementBackendApi";
import type { GeneratedResultManagementBackendApi } from "../../../api/generated-results/GeneratedResultManagementBackendApi";
import type { DeploymentPolicyReadBackendApi } from "../../../api/deployment/DeploymentPolicyReadBackendApi";
import type { DeploymentPolicyWriteBackendApi } from "../../../api/deployment/DeploymentPolicyWriteBackendApi";
import type { WorkspaceInvitationBackendApi } from "../../../api/workspaces/WorkspaceInvitationBackendApi";
import type { WorkspaceAdministrationBackendApi } from "../../../api/workspaces/WorkspaceAdministrationBackendApi";
import type { SystemRuntimeBackendApi } from "../../../api/system-runtime/SystemRuntimeBackendApi";
import type { AuthoritativeRunSubmissionBackendApi } from "../../../api/runs/AuthoritativeRunSubmissionBackendApi";
import type { AuthoritativeRunQueryBackendApi } from "../../../api/runs/AuthoritativeRunQueryBackendApi";
import type { AuthoritativeRunMutationBackendApi } from "../../../api/runs/AuthoritativeRunMutationBackendApi";
import type { AuthoritativeRunExecutionUpdateBackendApi } from "../../../api/runs/AuthoritativeRunExecutionUpdateBackendApi";
import {
  ChangeLocalPasswordCredentialVerificationModes,
  IdentityAuthApiErrorCodes,
  type ChangeLocalPasswordCredentialApiRequest,
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
  AuthorizationManagementApiErrorCodes,
  type AuthorizationManagementApiResponse,
} from "../../../api/authorization/sdk/PublicAuthorizationManagementApiContract";
import {
  AuditLedgerApiErrorCodes,
  type AuditLedgerApiResponse,
} from "../../../api/audit/sdk/PublicAuditLedgerApiContract";
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
import {
  type ApproveNodeEnrollmentApiRequest,
  type GetNodeEnrollmentDetailApiRequest,
  type GetNodeInventoryDetailApiRequest,
  type ListNodeInventoryApiRequest,
  type ResolveNodeRuntimeTrustMaterialApiRequest,
  type ListTrustedNodeInventoryApiRequest,
  NodeTrustApiErrorCodes,
  type NodeTrustApiResponse,
  type RecordNodeHeartbeatApiRequest,
  type RecordNodeOperationalUpdateApiRequest,
  type RejectNodeEnrollmentApiRequest,
  type RevokeNodeTrustApiRequest,
} from "../../../api/nodes/sdk/PublicNodeTrustApiContract";
import {
  ExecutionNodeManagementApiErrorCodes,
  type ExecutionNodeBackendAvailabilityReadApiRequest,
  type ExecutionNodeManagementApiResponse,
  type ExecutionNodeEligibilityCheckApiRequest,
  type ExecutionNodeGetApiRequest,
  type ExecutionNodeListApiRequest,
  type ExecutionNodeReadinessCheckApiRequest,
  type ExecutionNodeSetAvailabilityOverrideApiRequest,
} from "../../../api/nodes/sdk/PublicExecutionNodeManagementApiContract";
import {
  CertificateOperationsApiErrorCodes,
  type CertificateOperationsApiResponse,
  type ListIssuedCertificatesApiRequest,
  type RenewIssuedCertificateApiRequest,
  type RevokeIssuedCertificateApiRequest,
} from "../../../api/security/sdk/PublicCertificateOperationsApiContract";
import {
  SecretMetadataApiErrorCodes,
  type CreateSecretMetadataApiRequest,
  type DisableSecretMetadataApiRequest,
  type GetSecretMetadataApiRequest,
  type GetSecretReEncryptionStatusApiRequest,
  type ListSecretMetadataApiRequest,
  type ReEncryptSecretsMetadataApiRequest,
  type RotateSecretMetadataApiRequest,
  type SecretMetadataApiResponse,
} from "../../../api/security/sdk/PublicSecretMetadataApiContract";
import {
  AssetManagementApiErrorCodes,
  type AssetManagementApiResponse,
  type ArchiveAssetApiRequest,
  type AuthorizeAssetDownloadApiRequest,
  type DeleteAssetApiRequest,
  type GetAssetDetailApiRequest,
  type IngestAssetUploadContentApiRequest,
  type InitiateAssetUploadApiRequest,
  type ListAssetsApiRequest,
  type OpenAuthorizedAssetDownloadStreamApiRequest,
  type RegisterAssetApiRequest,
  type RegisterGeneratedOutputApiRequest,
  type ResolveAssetPreviewApiRequest,
} from "../../../api/assets/sdk/PublicAssetManagementApiContract";
import {
  ImageAssetManagementApiErrorCodes,
  type CompleteImageAssetUploadApiRequest,
  type CreateImageAssetApiRequest,
  type GetImageAssetMetadataApiRequest,
  type ImageAssetManagementApiResponse,
  type IngestImageAssetUploadContentApiRequest,
  type ListImageAssetMetadataApiRequest,
  type OpenImageAssetPreviewContentStreamApiRequest,
  type OpenImageAssetOriginalContentStreamApiRequest,
  type RequestImageAssetPreviewApiRequest,
} from "../../../api/image-assets/sdk/PublicImageAssetManagementApiContract";
import {
  GeneratedResultManagementApiErrorCodes,
  type GeneratedResultManagementApiResponse,
  type GetGeneratedResultLineageDetailApiRequest,
  type GetGeneratedResultLineageSummaryApiRequest,
  type GetGeneratedResultApiRequest,
  type ListGeneratedResultsApiRequest,
  type ListGeneratedResultsByRunApiRequest,
  type OpenGeneratedResultPreviewContentStreamApiRequest,
  type OpenGeneratedResultOriginalContentStreamApiRequest,
  type RequestGeneratedResultPreviewApiRequest,
} from "../../../api/generated-results/sdk/PublicGeneratedResultManagementApiContract";
import {
  RuntimeQueueItemStatuses,
  SystemRuntimeTransportRoutes,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import { DeploymentPolicyReadTransportRoutes } from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { DeploymentPolicyWriteTransportRoutes } from "@shared/contracts/deployment/DeploymentPolicyWriteContracts";
import {
  RunOrchestrationTransportRoutes,
  resolveRunLifecycleState,
  resolveRunSubmissionSource,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { ImageRunApiRoutes } from "@shared/contracts/image-workflows/ImageRunApiContracts";
import {
  RuntimeRealtimeSubscriptionModes,
  RuntimeRealtimeTopics,
  RuntimeRealtimeWebSocketActions,
  RuntimeRealtimeWebSocketMessageTypes,
  type RuntimeRealtimeSubscriptionRequest,
  type RuntimeRealtimeSubscriptionTopic,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import {
  StorageManagementApiErrorCodes,
  type ActivateStorageInstanceApiRequest,
  type DeactivateStorageInstanceApiRequest,
  type GetStorageInstanceDetailApiRequest,
  type GetStorageInstanceHealthApiRequest,
  type ListStorageInstancesApiRequest,
  type StorageManagementApiResponse,
  type UpdateStorageInstanceMetadataApiRequest,
} from "../../../api/storage/sdk/PublicStorageManagementApiContract";
import { redactSensitiveAuthPayload, redactSensitiveText } from "../../../api/identity/IdentityAuthRedaction";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRoleCapabilities,
  NodeTypes,
} from "@domain/nodes/NodeTrustDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
} from "@domain/storage/StorageDomain";
import {
  CertificateRevocationReasons,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "@domain/security/CertificateAuthorityDomain";
import { CertificateTrustEvaluationStatuses } from "@shared/dto/security/CertificateAuthorityDtos";
import {
  parseApproveNodeEnrollmentActionRequestDto,
  parseNodeHeartbeatPayloadDto,
  parseNodeOperationalUpdatePayloadDto,
  parseResolveNodeRuntimeTrustMaterialRequestDto,
  parseRevokeNodeTrustActionRequestDto,
  parseRejectNodeEnrollmentActionRequestDto,
  parseNodeEnrollmentSubmissionRequestDto,
  NodeTrustApiSchemaValidationError,
  type ApproveNodeEnrollmentActionRequestDtoPayload,
  type NodeHeartbeatPayloadDtoPayload,
  type NodeOperationalUpdatePayloadDtoPayload,
  type NodeEnrollmentSubmissionRequestDtoPayload,
  type RejectNodeEnrollmentActionRequestDtoPayload,
  type RevokeNodeTrustActionRequestDtoPayload,
} from "@shared/schemas/nodes/NodeTrustApiSchemaContracts";
import { ExecutionNodeManagementTransportRoutes } from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";
import {
  ExecutionNodeManagementApiSchemaValidationError,
  parseExecutionNodeBackendAvailabilityReadRequestDto,
  parseExecutionNodeEligibilityCheckRequestDto,
  parseExecutionNodeListRequestDto,
  parseExecutionNodeReadinessCheckRequestDto,
  parseExecutionNodeSetAvailabilityOverrideRequestDto,
  type ExecutionNodeSetAvailabilityOverrideRequestDtoPayload,
} from "@shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts";
import {
  CreateSecretMetadataCommandSchema,
  DisableSecretMetadataCommandSchema,
  GetSecretReEncryptionStatusQuerySchema,
  GetSecretMetadataQuerySchema,
  ListSecretMetadataQuerySchema,
  ReEncryptSecretsCommandSchema,
  RotateSecretMetadataCommandSchema,
} from "@shared/schemas/security/SecretApiSchemaContracts";
import {
  StorageTransportSchemaValidationError,
  parseCreateStorageInstanceRequestDto,
  parseGetStorageInstanceDetailRequestDto,
  parseListStorageInstancesRequestDto,
  parseUpdateStorageInstanceRequestDto,
  type CreateStorageInstanceRequestDtoPayload,
  type UpdateStorageInstanceRequestDtoPayload,
} from "@shared/schemas/storage/StorageTransportSchemaContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import { parseReadDeploymentPolicyStateRequest } from "@shared/schemas/deployment/DeploymentPolicyReadSchemaContracts";
import {
  parseApplyDeploymentPolicyOverrideOperationsRequest,
  parseUpdateDeploymentPolicyActiveProfileRequest,
} from "@shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts";
import {
  SharedApiQuerySchemaValidationError,
  parseSharedApiListQueryConventions,
} from "@shared/schemas/api/SharedApiQuerySchemaContracts";
import {
  AuditEventSchemaValidationError,
  parseAuditEventListQueryFromSearchParams,
} from "@shared/schemas/audit/AuditEventSchemaContracts";
import {
  SystemRuntimeTransportSchemaValidationError,
  parseRuntimeCancelRunRequest,
  parseRuntimeDequeueRequest,
  parseRuntimeStartRunRequest,
} from "@shared/schemas/runtime/SystemRuntimeTransportSchemaContracts";
import {
  RunOrchestrationTransportSchemaValidationError,
  parseSchedulingAdminListStaleReservationsRequest,
  parseSchedulingAdminReleaseStaleReservationRequest,
  parseSchedulingAdminReevaluateDeferredRunsRequest,
  parseRunCancellationRequest,
  parseExecutionReadinessReadRequest,
  parseRunLifecycleUpdateRequest,
  parseRunListReadRequest,
  parseRunQueueStatusReadRequest,
  parseRunRetryRequest,
  parseRunSubmissionRequest,
} from "@shared/schemas/runtime/RunOrchestrationTransportSchemaContracts";
import {
  RuntimeRealtimeSchemaValidationError,
  parseRuntimeRealtimeWebSocketSubscribeMessage,
  parseRuntimeRealtimeWebSocketSubscriptionAckMessage,
} from "@shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts";
import type { ValidateTransportConnectionTrustRequest } from "@application/security/ports/TransportTrustValidationPorts";
import { TransportConnectionDirections } from "@application/security/ports/TransportTrustValidationPorts";
import {
  TransportChannelTypes,
  TransportConnectionActorTypes,
  TransportPeerTypes,
  TransportSecurityScenarios,
  type TransportChannelType,
  type TransportConnectionActorType,
  type TransportPeerType,
  type TransportSecurityScenario,
} from "@domain/security/TransportSecurityDomain";
import type { HttpTransportTrustValidationResult } from "@infrastructure/transport/TransportTrustValidationAdapters";
import type { WebSocketTransportTrustValidationResult } from "@infrastructure/transport/TransportTrustValidationAdapters";
import {
  buildWebSocketChannelContext,
  canTransitionWebSocketChannelLifecycleState,
  hasWebSocketChannelCertificateBindingRotated,
  InMemoryWebSocketChannelRegistry,
  parseWebSocketChannelPurpose,
  resolveWebSocketChannelReconnectDirective,
  toWebSocketChannelCertificateBinding,
  WebSocketChannelLifecycleInvalidationReasons,
  WebSocketChannelLifecycleStates,
  type WebSocketChannelCertificateBinding,
  type WebSocketChannelLifecycleInvalidationReason,
  type WebSocketChannelLifecycleState,
  type WebSocketChannelReconnectDirective,
  type WebSocketChannelReconnectPolicy,
  WebSocketChannelPurposes,
  type WebSocketChannelContext,
  type WebSocketChannelPurpose,
  type WebSocketChannelRegistry,
} from "@infrastructure/transport/websocket/SecureWebSocketChannelContext";
import {
  buildThinClientSessionChannelContext,
  evaluateThinClientWebSocketOriginPolicy,
  type ThinClientSessionChannelContextDto,
} from "@shared/contracts/security/ThinClientTransportContracts";
import {
  mapAssetManagementApiStatusCode as mapAssetManagementStatusCode,
  mapAuditLedgerApiStatusCode as mapAuditLedgerStatusCode,
  mapAuthorizationManagementApiStatusCode as mapAuthorizationManagementStatusCode,
  mapCertificateOperationsApiStatusCode as mapCertificateOperationsStatusCode,
  mapExecutionNodeManagementApiStatusCode as mapExecutionNodeManagementStatusCode,
  mapGeneratedResultManagementApiStatusCode as mapGeneratedResultManagementStatusCode,
  mapIdentityAuthApiStatusCode as mapStatusCode,
  mapImageAssetManagementApiStatusCode as mapImageAssetManagementStatusCode,
  mapNodeTrustApiStatusCode as mapNodeTrustStatusCode,
  mapRunSubmissionApiStatusCode as mapRunSubmissionStatusCode,
  mapSecretMetadataApiStatusCode as mapSecretMetadataStatusCode,
  mapStorageManagementApiStatusCode as mapStorageManagementStatusCode,
  mapSystemRuntimeApiStatusCode as mapSystemRuntimeStatusCode,
  mapWorkspaceAdministrationApiStatusCode as mapWorkspaceAdministrationStatusCode,
  mapWorkspaceInvitationApiStatusCode as mapWorkspaceStatusCode,
  normalizeSharedApiErrorEnvelope,
} from "./IdentityHttpServerErrorTranslation";
import type {
  ResolveSessionActorContextApiResponse,
  ResolveSessionActorWorkspaceContextApiRecord,
} from "@shared/contracts/identity/IdentityTransportContracts";
import {
  AuthoritativeApiRouteBackendKeys,
  type AuthoritativeApiRouteBackendKey,
  type AuthoritativeApiRouteFamilyRegistration,
  type AuthoritativeApiRouteRegistrationPlan,
} from "../AuthoritativeApiRouteRegistration";
import { composeAuthoritativeApiRouteRegistrationPlan } from "../AuthoritativeApiRouteRegistrationCatalog";
import { composeIdentityHttpTransport } from "./composition/IdentityHttpTransportComposition";
import { installIdentityHttpUpgradeBoundary } from "./composition/IdentityHttpUpgradeBoundary";
import { createAuditLedgerRouteFamilyHandler } from "./route-families/AuditRouteFamilyHandler";
import { createAuthorizationRouteFamilyHandler } from "./route-families/AuthorizationRouteFamilyHandler";
import { createExecutionNodeManagementRouteFamilyHandler } from "./route-families/ExecutionNodeManagementRouteFamilyHandler";
import { createIdentityAndTrustedDeviceRouteFamilyHandler } from "./route-families/IdentityAndTrustedDeviceRouteFamilyHandler";
import { createDeploymentPolicyRouteFamilyHandler } from "./route-families/DeploymentPolicyRouteFamilyHandler";
import { createSecretMetadataRouteFamilyHandler } from "./route-families/SecretMetadataRouteFamilyHandler";
import { createCertificateOperationsRouteFamilyHandler } from "./route-families/CertificateOperationsRouteFamilyHandler";
import { createNodeTrustRouteFamilyHandler } from "./route-families/NodeTrustRouteFamilyHandler";
import {
  createRunExecutionUpdateRouteFamilyHandler,
  createRunMutationRouteFamilyHandler,
  createRunReadRouteFamilyHandler,
  createRunSubmissionRouteFamilyHandler,
} from "./route-families/RunRouteFamilyHandlers";
import { createWorkspaceRouteFamilyHandler } from "./route-families/WorkspaceRouteFamilyHandler";
import { buildIdentityHttpRouteCompositionLogDetails } from "./middleware/request-observability";
import { evaluateRuntimeCapabilityGuard } from "./middleware/runtime-capability-guard";
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  addCorrelationIdToErrorEnvelope,
  normalizeResponseHeaderValue,
  resolveRequestCorrelationId,
  setResponseCorrelationHeaders,
} from "./middleware/request-metadata";
import {
  buildAuthenticatedSessionActorContext,
  extractBearerSessionToken,
  normalizeSessionAssuranceLevel,
  resolveAuthenticatedSessionFromRequest,
  type AuthenticatedSessionActorContext,
} from "./middleware/session-authentication";
import {
  authorizeSessionNodeRoutePrincipal,
  buildSessionNodeRouteTransportContext,
  resolveMutualTlsNodeRouteTransportContext,
  resolveRequiredNodeRouteNodeId,
} from "./middleware/node-route-authentication";
import {
  enforceTrustedSessionAssurance,
  type SessionAssuranceRequirement,
} from "./middleware/trusted-session-assurance";
import {
  resolveWorkspaceContextFromRequest,
  type ResolveWorkspaceContextOptions,
  type ResolvedWorkspaceRequestContext,
} from "./middleware/workspace-context";
import { validateNodeMutualTlsTransport } from "./NodeMutualTlsTransportAdapter";
import {
  normalizeRequestContentType,
  parseJsonBody as parseJsonRequestBody,
  resolveRequestSearchParams,
  resolveRequestUrl,
  toRequestBodyStream as toRequestBodyByteStream,
} from "./primitives/HttpRequestPrimitives";
import {
  writeJsonResponse,
  writeNoContentResponse,
  writeResponseStream,
} from "./primitives/HttpResponsePrimitives";
import {
  buildContentDispositionHeader as buildFileContentDispositionHeader,
  sanitizeDownloadFileName as sanitizeDownloadFileNamePrimitive,
} from "./primitives/HttpFileResponsePrimitives";
import {
  mergeOptionalStringLists,
  normalizeOptionalString,
  parseOptionalMultiEnumList,
  parseOptionalStringList,
  parseSharedListPaginationFromQuery,
} from "./primitives/HttpQueryPrimitives";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const DefaultWebSocketTrustRevalidationIntervalMs = 30_000;
const DEFAULT_API_CORS_ALLOWED_METHODS = Object.freeze(["GET", "POST", "OPTIONS"]);
const DEFAULT_API_CORS_ALLOWED_HEADERS = Object.freeze(["content-type", "authorization"]);
const RuntimeRealtimeWebSocketSubprotocol = "ai-loom-runtime-realtime.v1";
const RuntimeRealtimeWebSocketAuthSubprotocolPrefix = "ai-loom-auth-bearer.";
const DEV_LOGIN_DEFAULT_PROVIDER_ID = "provider:local-password";
const DEV_LOGIN_DEFAULT_USERNAME = "dev.local.user";
const DEV_LOGIN_DEFAULT_PASSWORD = "DevOnlyPass!2026";

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

const DevLoginRequestSchema = z.object({
  accessChannel: z.enum(["desktop", "thin-client"]).optional(),
  sessionTrustRequirement: z.enum(["allow-untrusted", "allow-pairing", "require-trusted"]).optional(),
  client: LoginRequestSchema.shape.client,
}).strict();

const RevokeSessionRequestSchema: z.ZodType<Pick<RevokeIdentitySessionApiRequest, "sessionId" | "reason">> = z.object({
  sessionId: z.string().min(1),
  reason: z.enum(["logout", "security", "rotation", "admin"]).optional(),
}).strict();

const RevokeSessionByPathRequestSchema: z.ZodType<Pick<RevokeIdentitySessionApiRequest, "reason">> = z.object({
  reason: z.enum(["logout", "security", "rotation", "admin"]).optional(),
}).strict();

const AdminAccountStatusValues = z.enum([
  "pending-activation",
  "active",
  "suspended",
  "locked",
  "deactivated",
]);
const IdentitySessionStatusValues = z.enum([
  "active",
  "rotated",
  "expired",
  "revoked",
]);
const IdentitySessionAccessChannelValues = z.enum([
  "desktop",
  "thin-client",
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
const NodePendingEnrollmentStatusValues = z.enum([
  NodeEnrollmentRequestStatuses.submitted,
  NodeEnrollmentRequestStatuses.underReview,
]);
const NodeEnrollmentRequestStatusValues = z.enum([
  NodeEnrollmentRequestStatuses.submitted,
  NodeEnrollmentRequestStatuses.underReview,
  NodeEnrollmentRequestStatuses.approved,
  NodeEnrollmentRequestStatuses.rejected,
  NodeEnrollmentRequestStatuses.withdrawn,
  NodeEnrollmentRequestStatuses.expired,
]);
const NodeTypeValues = z.enum([
  NodeTypes.compute,
  NodeTypes.hybrid,
  NodeTypes.edge,
]);
const NodeApprovalStatusValues = z.enum([
  NodeApprovalStatuses.pending,
  NodeApprovalStatuses.approved,
  NodeApprovalStatuses.rejected,
  NodeApprovalStatuses.suspended,
]);
const NodeInventoryOperationalStateValues = z.enum([
  "active",
  "pending",
  "rejected",
  "revoked",
  "offline",
]);
const NodeInventoryPresenceStateValues = z.enum([
  "online",
  "degraded",
  "offline",
  "unknown",
]);
const NodeCapabilityValues = z.enum([
  NodeRoleCapabilities.ui,
  NodeRoleCapabilities.api,
  NodeRoleCapabilities.scheduler,
  NodeRoleCapabilities.executor,
  NodeRoleCapabilities.storageAccess,
  NodeRoleCapabilities.previewWorker,
]);
const StorageBackendTypeValues = z.enum([
  StorageBackendTypes.managedFilesystem,
  StorageBackendTypes.objectStorage,
  StorageBackendTypes.networkShare,
]);
const StorageLifecycleStateValues = z.enum([
  StorageLifecycleStates.provisioning,
  StorageLifecycleStates.active,
  StorageLifecycleStates.suspended,
  StorageLifecycleStates.degraded,
  StorageLifecycleStates.archived,
  StorageLifecycleStates.deleting,
  StorageLifecycleStates.deleted,
  StorageLifecycleStates.failed,
]);
const StorageAccessModeValues = z.enum([
  StorageAccessModes.readWrite,
  StorageAccessModes.readOnly,
  StorageAccessModes.appendOnly,
]);
const StorageAccessScopeValues = z.enum([
  StorageAccessScopes.workspace,
  StorageAccessScopes.workspaceMembers,
  StorageAccessScopes.platformManaged,
]);
const ActivateStorageInstanceRequestSchema: z.ZodType<Pick<
  ActivateStorageInstanceApiRequest,
  "operationKey" | "correlationId" | "activatedAt" | "requestBackendActivation" | "includeCapabilities"
>> = z.object({
  operationKey: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  activatedAt: z.string().datetime().optional(),
  requestBackendActivation: z.boolean().optional(),
  includeCapabilities: z.boolean().optional(),
}).strict();
const DeactivateStorageInstanceRequestSchema: z.ZodType<Pick<
  DeactivateStorageInstanceApiRequest,
  "operationKey" | "correlationId" | "targetLifecycleState" | "deactivatedAt" | "requestBackendDeactivation" | "includeCapabilities"
>> = z.object({
  operationKey: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  targetLifecycleState: z.enum(["suspended", "archived"]).optional(),
  deactivatedAt: z.string().datetime().optional(),
  requestBackendDeactivation: z.boolean().optional(),
  includeCapabilities: z.boolean().optional(),
}).strict();
const CertificateRevocationReasonValues = new Set<string>(Object.values(CertificateRevocationReasons));
const CertificateStatusValues = new Set<string>(Object.values(CertificateStatuses));
const CertificateSubjectReferenceKindValues = new Set<string>(Object.values(CertificateSubjectReferenceKinds));
const CertificateUsageValues = new Set<string>(Object.values(CertificateUsageKinds));
const CertificateTrustStatusValues = new Set<string>(Object.values(CertificateTrustEvaluationStatuses));
const RevokeIssuedCertificateRequestSchema = z.object({
  revocationReason: z.string().refine((value) => CertificateRevocationReasonValues.has(value), {
    message: "revocationReason is invalid.",
  }),
  revokedAt: z.string().datetime().optional(),
  note: z.string().trim().min(1).max(2000).optional(),
  reason: z.string().trim().min(1).max(255).optional(),
  correlationId: z.string().trim().min(1).max(255).optional(),
}).strict();

const RenewIssuedCertificateRequestSchema = z.object({
  operationKey: z.string().trim().min(1).optional(),
  validityDays: z.number().int().positive().optional(),
  publicKeyPem: z.string().trim().min(1),
  publicKeyAlgorithm: z.string().trim().min(1),
  publicKeyFingerprintSha256: z.string().trim().min(1).optional(),
  signatureAlgorithm: z.string().trim().min(1).optional(),
  certificateMaterialRef: z.string().trim().min(1),
  certificateChainMaterialRef: z.string().trim().min(1).optional(),
  trustMaterialRef: z.string().trim().min(1).optional(),
  certificateMaterialSecretRef: z.string().trim().min(1).optional(),
  certificateMaterialKeyScope: z.string().trim().min(1).optional(),
  certificateChainMaterialSecretRef: z.string().trim().min(1).optional(),
  certificateChainMaterialKeyScope: z.string().trim().min(1).optional(),
  previousCertificateDisposition: z.enum(["supersede", "preserve"]).optional(),
  gracePeriodDays: z.number().int().nonnegative().optional(),
  occurredAt: z.string().datetime().optional(),
  reason: z.string().trim().min(1).max(255).optional(),
  correlationId: z.string().trim().min(1).max(255).optional(),
}).strict();

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

const AuthorizationResourceFamilyValues = z.enum([
  "asset",
  "system",
  "workflow",
  "template",
  "run",
  "queue",
  "log",
  "storage-instance",
  "secret-metadata",
  "artifact",
]);
const AuthorizationResourceVisibilityValues = z.enum(["private", "workspace", "shared", "published"]);
const AuthorizationSharingPolicyModeValues = z.enum(["owner-only", "workspace-members", "explicit", "published"]);
const AuthorizationSharingSubjectTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user"),
    userId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("workspace-role"),
    workspaceId: z.string().min(1),
    roleKey: WorkspaceRoleValues,
  }).strict(),
  z.object({
    kind: z.literal("workspace"),
    workspaceId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("public"),
  }).strict(),
]);
const AuthorizationSharingGrantMutationSchema = z.object({
  id: z.string().min(1),
  target: AuthorizationSharingSubjectTargetSchema,
  permissionKeys: z.array(z.string().min(1)).min(1),
}).strict();
const AuthorizationUpdateVisibilityRequestSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  visibility: AuthorizationResourceVisibilityValues,
  sharingPolicyMode: AuthorizationSharingPolicyModeValues,
  allowResharing: z.boolean().optional(),
  sharingGrants: z.array(AuthorizationSharingGrantMutationSchema).optional(),
  isPublishedCapable: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
  expectedRevision: z.number().int().min(0).optional(),
  reason: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();
const AuthorizationGrantSharingRequestSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  visibility: AuthorizationResourceVisibilityValues.optional(),
  grant: AuthorizationSharingGrantMutationSchema,
  expectedRevision: z.number().int().min(0).optional(),
  reason: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();
const AuthorizationRevokeSharingRequestSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  visibility: AuthorizationResourceVisibilityValues.optional(),
  expectedRevision: z.number().int().min(0).optional(),
  reason: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();
const AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema = z.object({
  workspaceId: z.string().min(1),
  roleKey: WorkspaceRoleValues,
  resources: z.array(z.object({
    resourceFamily: AuthorizationResourceFamilyValues,
    resourceType: z.string().min(1),
    resourceId: z.string().min(1),
  }).strict()).min(1).max(250),
  permissionKeys: z.array(z.string().min(1)).min(1).max(32),
  reason: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export interface IdentityHttpServerLogEvent {
  readonly event: string;
  readonly requestId: string;
  readonly correlationId?: string;
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

interface IdentityHttpServerTransportTrustOptions {
  readonly httpValidator: {
    validate(request: ValidateTransportConnectionTrustRequest): Promise<HttpTransportTrustValidationResult>;
  };
  readonly websocketValidator?: {
    validate(request: ValidateTransportConnectionTrustRequest): Promise<WebSocketTransportTrustValidationResult>;
  };
  readonly allowInsecureLoopback: boolean;
  readonly defaultScenario?: TransportSecurityScenario;
}

interface IdentityHttpServerSecureTransportOptions {
  readonly requireHttps: boolean;
  readonly requireWss?: boolean;
  readonly allowInsecureLoopback: boolean;
}

interface IdentityHttpServerCorsOptions {
  readonly enabled?: boolean;
  readonly allowedOrigins?: ReadonlyArray<string>;
  readonly allowLoopbackOrigins?: boolean;
  readonly allowNullOrigin?: boolean;
  readonly allowedMethods?: ReadonlyArray<string>;
  readonly allowedHeaders?: ReadonlyArray<string>;
  readonly maxAgeSeconds?: number;
}

interface IdentityHttpServerWebSocketOptions {
  readonly channelPathPrefix?: string;
  readonly supportedPurposes?: ReadonlyArray<WebSocketChannelPurpose>;
  readonly defaultPurpose?: WebSocketChannelPurpose;
  readonly channelRegistry?: WebSocketChannelRegistry;
  readonly lifecycle?: IdentityHttpServerWebSocketLifecycleOptions;
  onChannelEstablished?(channel: WebSocketChannelContext, socket: Socket): Promise<void> | void;
}

interface IdentityHttpServerWebSocketLifecycleOptions {
  readonly trustRevalidationIntervalMs?: number;
  readonly reconnectPolicy?: WebSocketChannelReconnectPolicy;
  resolveCertificateBinding?(channel: WebSocketChannelContext, socket: Socket): WebSocketChannelCertificateBinding | undefined;
  onLifecycleEvent?(event: IdentityHttpServerWebSocketLifecycleEvent): Promise<void> | void;
}

interface IdentityHttpServerWebSocketLifecycleEvent {
  readonly channelId: string;
  readonly connectionId: string;
  readonly state: WebSocketChannelLifecycleState;
  readonly occurredAt: string;
  readonly reason?: WebSocketChannelLifecycleInvalidationReason;
  readonly reconnect?: WebSocketChannelReconnectDirective;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IdentityHttpServerOptions {
  readonly backendApi: IdentityAuthBackendApi;
  readonly certificateOperationsBackendApi?: CertificateOperationsBackendApi;
  readonly secretMetadataBackendApi?: SecretMetadataBackendApi;
  readonly storageManagementBackendApi?: StorageManagementBackendApi;
  readonly assetManagementBackendApi?: AssetManagementBackendApi;
  readonly imageAssetManagementBackendApi?: ImageAssetManagementBackendApi;
  readonly generatedResultManagementBackendApi?: GeneratedResultManagementBackendApi;
  readonly auditLedgerBackendApi?: AuditLedgerBackendApi;
  readonly systemRuntimeBackendApi?: SystemRuntimeBackendApi;
  readonly authoritativeRunSubmissionBackendApi?: AuthoritativeRunSubmissionBackendApi;
  readonly authoritativeRunQueryBackendApi?: AuthoritativeRunQueryBackendApi;
  readonly authoritativeRunMutationBackendApi?: AuthoritativeRunMutationBackendApi;
  readonly authoritativeRunExecutionUpdateBackendApi?: AuthoritativeRunExecutionUpdateBackendApi;
  readonly deploymentPolicyReadBackendApi?: DeploymentPolicyReadBackendApi;
  readonly deploymentPolicyWriteBackendApi?: DeploymentPolicyWriteBackendApi;
  readonly authorizationManagementBackendApi?: AuthorizationManagementBackendApi;
  readonly nodeTrustBackendApi?: NodeTrustBackendApi;
  readonly executionNodeManagementBackendApi?: ExecutionNodeManagementBackendApi;
  readonly workspaceBackendApi?: WorkspaceInvitationBackendApi;
  readonly workspaceAdministrationBackendApi?: WorkspaceAdministrationBackendApi;
  readonly sessionContextWorkspaceApi?: Pick<WorkspaceAdministrationBackendApi, "listWorkspaces">
    & Partial<Pick<WorkspaceAdministrationBackendApi, "createWorkspace">>;
  readonly logger?: IdentityHttpServerLogger;
  readonly maxBodyBytes?: number;
  readonly serverFactory?: IdentityHttpServerFactory;
  readonly secureTransport?: IdentityHttpServerSecureTransportOptions;
  readonly cors?: IdentityHttpServerCorsOptions;
  readonly transportTrust?: IdentityHttpServerTransportTrustOptions;
  readonly webSocket?: IdentityHttpServerWebSocketOptions;
  readonly routeRegistrationPlan?: AuthoritativeApiRouteRegistrationPlan;
  readonly routeFamilyHandlers?: Readonly<Partial<Record<string, IdentityHttpRouteFamilyHandler>>>;
  readonly routeFamilyAvailability?: {
    readonly isRouteFamilyAvailable: (routeFamilyId: string) => boolean;
    readonly resolveRouteFamilyAvailability?: (
      routeFamilyId: string,
    ) => Readonly<{
      readonly routeFamilyId: string;
      readonly capabilityId?: string;
      readonly state?: string;
      readonly runtimeLifecycle?: Readonly<{
        readonly capabilityPhase: string;
        readonly transportPhase?: string;
        readonly activationMode?: string;
        readonly triggerSource?: string;
        readonly unavailableReason?: string;
        readonly hasFailure?: boolean;
        readonly failureRetryable?: boolean;
      }>;
      readonly available: boolean;
    }>;
  };
  readonly observability?: {
    onOperationalEvent?(event: IdentityHttpServerLogEvent): void;
  };
  readonly development?: {
    readonly enableDevLoginRoute?: boolean;
  };
}

export interface IdentityHttpRouteFamilyHandlerContext {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly requestId: string;
  readonly correlationId: string;
  readonly path: string;
  readonly method: string | undefined;
  readonly logger: IdentityHttpServerLogger;
  readonly routeFamily: AuthoritativeApiRouteFamilyRegistration;
}

export interface IdentityHttpRouteFamilyHandlerResult {
  readonly handled: boolean;
}

export type IdentityHttpRouteFamilyHandler = (
  context: IdentityHttpRouteFamilyHandlerContext,
) => IdentityHttpRouteFamilyHandlerResult | Promise<IdentityHttpRouteFamilyHandlerResult> | void | Promise<void>;

export type IdentityHttpServerInstance = Server | HttpsServer;
export type IdentityHttpServerFactory = (requestListener: RequestListener) => IdentityHttpServerInstance;

interface InboundHttpTransportConnectionState {
  readonly channelType: TransportChannelType;
  readonly encryptedTransportEstablished: boolean;
  readonly mutualTlsEstablished: boolean;
  readonly peerCertificatePresented: boolean;
  readonly peerCertificateSerialNumber?: string;
  readonly peerCertificateFingerprintSha256?: string;
  readonly localAddress?: string;
  readonly remoteAddress?: string;
  readonly host?: string;
  readonly loopbackRequest: boolean;
}

interface AuthenticatedRequestContext extends AuthenticatedSessionActorContext<
  InboundHttpTransportConnectionState,
  {
    readonly accessChannel: "desktop" | "thin-client";
    readonly thinClient?: ThinClientSessionChannelContextDto;
  },
  {
    readonly enforced: boolean;
    readonly scenario: TransportSecurityScenario;
    readonly actorType: TransportConnectionActorType;
    readonly remotePeerType: TransportPeerType;
  }
> {
  readonly workspace?: ResolvedWorkspaceRequestContext;
}

interface AuthenticatedWorkspaceRequestContext extends AuthenticatedRequestContext {
  readonly workspace: ResolvedWorkspaceRequestContext;
}

interface RequireAuthenticatedWorkspaceSessionOptions extends ResolveWorkspaceContextOptions {
  readonly sessionOptions?: {
    readonly sessionAssuranceRequirement?: SessionAssuranceRequirement;
    readonly transportScenario?: TransportSecurityScenario;
    readonly transportActorType?: TransportConnectionActorType;
    readonly transportRemotePeerType?: TransportPeerType;
    readonly nodeId?: string;
  };
}

interface AuthenticatedNodeTransportContext {
  readonly nodeId: string;
  readonly transport: {
    readonly connection: InboundHttpTransportConnectionState;
    readonly trustValidation: {
      readonly enforced: boolean;
      readonly scenario: TransportSecurityScenario;
      readonly actorType: TransportConnectionActorType;
      readonly remotePeerType: TransportPeerType;
    };
  };
}

interface WebSocketUpgradeDeniedReason {
  readonly code:
    | "invalid-upgrade-request"
    | "secure-transport-required"
    | "authentication-failed"
    | "transport-trust-rejected"
    | "unsupported-channel-purpose"
    | "origin-not-allowed";
  readonly message: string;
  readonly closeCode?: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function createIdentityHttpServer(options: IdentityHttpServerOptions): IdentityHttpServerInstance {
  const logger = createObservedIdentityHttpServerLogger(
    options.logger ?? new ConsoleIdentityHttpServerLogger(),
    options.observability?.onOperationalEvent,
  );
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const serverFactory = options.serverFactory ?? ((requestListener: RequestListener) => createHttpServer(requestListener));
  const channelRegistry = options.webSocket?.channelRegistry ?? new InMemoryWebSocketChannelRegistry();
  const corsPolicy = resolveApiCorsPolicy(options.cors);
  const routeRegistrationPlan = options.routeRegistrationPlan ?? composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: resolveRouteBackendAvailability(options),
  });
  const transportComposition = composeIdentityHttpTransport({
    routeRegistrationPlan,
    serverFactory,
  });
  const routeCompositionLogDetails = buildIdentityHttpRouteCompositionLogDetails(
    transportComposition.routeModuleRegistry.toSnapshot(),
  );
  const handleStorageManagementRouteFamily = async ({
    request,
    response,
    requestId,
    logger,
    path,
    method,
  }: IdentityHttpRouteFamilyHandlerContext): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!options.storageManagementBackendApi) {
      return Object.freeze({ handled: false });
    }

    const searchParams = resolveRequestSearchParams(request.url);

    if (method === "POST" && path === "/api/v1/storage/instances") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const parsedRequest = await parseAndValidateStorageCreateRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }

          const apiResponse = await options.storageManagementBackendApi!.createStorageInstance(parsedRequest.data);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === "/api/v1/storage/instances") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const parseArrayEnum = <TValue extends string>(
            key: string,
            values: ReadonlyArray<string>,
            schema: z.ZodType<ReadonlyArray<TValue>>,
          ): { readonly ok: true; readonly data: ReadonlyArray<TValue> } | { readonly ok: false } => {
            const validation = schema.safeParse(values);
            if (validation.success) {
              return { ok: true, data: validation.data };
            }
            const invalid = buildStorageManagementQueryValidationError(key, `${key} values are invalid.`);
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return { ok: false };
          };

          const backendTypesValidation = parseArrayEnum("backendType", searchParams.getAll("backendType"), z.array(StorageBackendTypeValues));
          if (!backendTypesValidation.ok) {
            return;
          }
          const lifecycleStatesValidation = parseArrayEnum("lifecycleState", searchParams.getAll("lifecycleState"), z.array(StorageLifecycleStateValues));
          if (!lifecycleStatesValidation.ok) {
            return;
          }
          const accessModesValidation = parseArrayEnum("accessMode", searchParams.getAll("accessMode"), z.array(StorageAccessModeValues));
          if (!accessModesValidation.ok) {
            return;
          }
          const accessScopesValidation = parseArrayEnum("accessScope", searchParams.getAll("accessScope"), z.array(StorageAccessScopeValues));
          if (!accessScopesValidation.ok) {
            return;
          }

          const listRequestDto = {
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            backendTypes: backendTypesValidation.data.length > 0 ? backendTypesValidation.data : undefined,
            lifecycleStates: lifecycleStatesValidation.data.length > 0 ? lifecycleStatesValidation.data : undefined,
            accessModes: accessModesValidation.data.length > 0 ? accessModesValidation.data : undefined,
            accessScopes: accessScopesValidation.data.length > 0 ? accessScopesValidation.data : undefined,
            limit: parseOptionalInteger(searchParams.get("limit")),
            offset: parseOptionalInteger(searchParams.get("offset")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          };

          try {
            parseListStorageInstancesRequestDto(listRequestDto);
          } catch (error) {
            if (error instanceof StorageTransportSchemaValidationError) {
              const invalid = buildStorageManagementValidationErrors(error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({ query: Object.fromEntries(searchParams.entries()) }), invalid);
              return;
            }
            throw error;
          }

          const listRequest: ListStorageInstancesApiRequest = Object.freeze({
            ...listRequestDto,
            includeCapabilities: parseOptionalBoolean(searchParams.get("includeCapabilities")),
          });
          const apiResponse = await options.storageManagementBackendApi!.listStorageInstances(listRequest);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            query: Object.fromEntries(searchParams.entries()),
          }), apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/storage/instances/") && path.endsWith("/health")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and storageInstanceId are required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const storageInstanceId = decodePathTail(path, "/api/v1/storage/instances/", "/health");
          if (!storageInstanceId) {
            const invalid = buildStorageManagementInvalidRequestResponse(
              "workspaceId and storageInstanceId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const healthRequest: GetStorageInstanceHealthApiRequest = {
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            storageInstanceId,
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          };
          try {
            parseGetStorageInstanceDetailRequestDto(healthRequest);
          } catch (error) {
            if (error instanceof StorageTransportSchemaValidationError) {
              const invalid = buildStorageManagementValidationErrors(error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, healthRequest, invalid);
              return;
            }
            throw error;
          }

          const apiResponse = await options.storageManagementBackendApi!.getStorageInstanceHealth(healthRequest);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, healthRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "PATCH" && path.startsWith("/api/v1/storage/instances/") && path.endsWith("/metadata")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and storageInstanceId are required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const storageInstanceId = decodePathTail(path, "/api/v1/storage/instances/", "/metadata");
          if (!storageInstanceId) {
            const invalid = buildStorageManagementInvalidRequestResponse(
              "workspaceId and storageInstanceId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const parsedRequest = await parseAndValidateStorageMetadataUpdateRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            storageInstanceId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }

          const apiResponse = await options.storageManagementBackendApi!.updateStorageMetadata(parsedRequest.data);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/storage/instances/") && path.endsWith("/activate")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and storageInstanceId are required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const storageInstanceId = decodePathTail(path, "/api/v1/storage/instances/", "/activate");
          if (!storageInstanceId) {
            const invalid = buildStorageManagementInvalidRequestResponse(
              "workspaceId and storageInstanceId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const parsedRequest = await parseAndValidateStorageLifecycleRequest(
            request,
            ActivateStorageInstanceRequestSchema,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }

          const activateRequest: ActivateStorageInstanceApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            storageInstanceId,
            ...parsedRequest.data,
          });
          const apiResponse = await options.storageManagementBackendApi!.activateStorageInstance(activateRequest);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, activateRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/storage/instances/") && path.endsWith("/deactivate")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and storageInstanceId are required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const storageInstanceId = decodePathTail(path, "/api/v1/storage/instances/", "/deactivate");
          if (!storageInstanceId) {
            const invalid = buildStorageManagementInvalidRequestResponse(
              "workspaceId and storageInstanceId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const parsedRequest = await parseAndValidateStorageLifecycleRequest(
            request,
            DeactivateStorageInstanceRequestSchema,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }

          const deactivateRequest: DeactivateStorageInstanceApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            storageInstanceId,
            ...parsedRequest.data,
          });
          const apiResponse = await options.storageManagementBackendApi!.deactivateStorageInstance(deactivateRequest);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, deactivateRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/storage/instances/")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and storageInstanceId are required.",
          buildInvalidResponse: buildStorageManagementInvalidRequestResponse,
        },
        async (context) => {
          const storageInstanceId = decodePathTail(path, "/api/v1/storage/instances/");
          if (!storageInstanceId) {
            const invalid = buildStorageManagementInvalidRequestResponse(
              "workspaceId and storageInstanceId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const detailRequestDto = {
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            storageInstanceId,
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          };
          try {
            parseGetStorageInstanceDetailRequestDto(detailRequestDto);
          } catch (error) {
            if (error instanceof StorageTransportSchemaValidationError) {
              const invalid = buildStorageManagementValidationErrors(error.issues);
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, detailRequestDto, invalid);
              return;
            }
            throw error;
          }

          const detailRequest: GetStorageInstanceDetailApiRequest = Object.freeze({
            ...detailRequestDto,
            includeCapabilities: parseOptionalBoolean(searchParams.get("includeCapabilities")),
          });
          const apiResponse = await options.storageManagementBackendApi!.getStorageInstanceDetail(detailRequest);
          const statusCode = mapStorageManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, detailRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
  const handleGeneratedResultRouteFamily = async ({
    request,
    response,
    requestId,
    logger,
    path,
    method,
  }: IdentityHttpRouteFamilyHandlerContext): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!options.generatedResultManagementBackendApi) {
      return Object.freeze({ handled: false });
    }

    const searchParams = resolveRequestSearchParams(request.url);

    if (method === "GET" && path.startsWith("/api/v1/image-runs/") && path.endsWith("/generated-results")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and runId are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const runId = decodePathTail(path, "/api/v1/image-runs/", "/generated-results");
          if (!runId || runId.includes("/")) {
            const invalid = buildGeneratedResultManagementInvalidRequestResponse("workspaceId and runId are required.");
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }
          const listRequest: ListGeneratedResultsByRunApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            runId,
            limit: parseOptionalInteger(searchParams.get("limit")),
            offset: parseOptionalInteger(searchParams.get("offset")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.listGeneratedResultsByRun(listRequest);
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, listRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === "/api/v1/generated-results") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const listRequest: ListGeneratedResultsApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            ownerUserIds: parseOptionalMultiStringList(searchParams, "ownerUserId", "ownerUserIds"),
            runId: normalizeOptionalString(searchParams.get("runId")),
            systemId: normalizeOptionalString(searchParams.get("systemId")),
            workflowId: normalizeOptionalString(searchParams.get("workflowId")),
            workflowTemplateId: normalizeOptionalString(searchParams.get("workflowTemplateId")),
            executionNodeId: normalizeOptionalString(searchParams.get("executionNodeId")),
            statuses: parseOptionalMultiStringList(searchParams, "status", "statuses"),
            visibilities: parseOptionalMultiStringList(searchParams, "visibility", "visibilities"),
            mediaTypes: parseOptionalMultiStringList(searchParams, "mediaType", "mediaTypes"),
            createdAfter: normalizeOptionalString(searchParams.get("createdAfter")),
            createdBefore: normalizeOptionalString(searchParams.get("createdBefore")),
            updatedAfter: normalizeOptionalString(searchParams.get("updatedAfter")),
            updatedBefore: normalizeOptionalString(searchParams.get("updatedBefore")),
            previewStates: parseOptionalMultiStringList(searchParams, "previewState", "previewStates"),
            hasPreview: parseOptionalBoolean(searchParams.get("hasPreview")),
            lineageInputAssetIds: parseOptionalMultiStringList(searchParams, "lineageInputAssetId", "lineageInputAssetIds"),
            requiredInputPurposes: parseOptionalMultiStringList(searchParams, "requiredInputPurpose", "requiredInputPurposes"),
            requiredAssetClasses: parseOptionalMultiStringList(searchParams, "requiredAssetClass", "requiredAssetClasses"),
            requiredMediaClasses: parseOptionalMultiStringList(searchParams, "requiredMediaClass", "requiredMediaClasses"),
            reuseReadyOnly: parseOptionalBoolean(searchParams.get("reuseReadyOnly")),
            includeArchived: parseOptionalBoolean(searchParams.get("includeArchived")),
            limit: parseOptionalInteger(searchParams.get("limit")),
            offset: parseOptionalInteger(searchParams.get("offset")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });

          const apiResponse = await options.generatedResultManagementBackendApi!.listGeneratedResults(listRequest);
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, listRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/generated-results/") && path.endsWith("/preview/content")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId, resultAssetId, and previewToken are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const resultAssetId = decodePathTail(path, "/api/v1/generated-results/", "/preview/content");
          const previewToken = normalizeOptionalString(searchParams.get("previewToken"));
          if (!resultAssetId || resultAssetId.includes("/") || !previewToken) {
            const invalid = buildGeneratedResultManagementInvalidRequestResponse(
              "workspaceId, resultAssetId, and previewToken are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }

          const streamRequest: OpenGeneratedResultPreviewContentStreamApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            resultAssetId,
            previewToken,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.openGeneratedResultPreviewContentStream(
            streamRequest,
          );
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          if (!apiResponse.ok || !apiResponse.data) {
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, streamRequest, apiResponse);
            return;
          }

          const contentDisposition = buildContentDispositionHeader(
            apiResponse.data.contentDisposition,
            apiResponse.data.contentDispositionFileName,
          );
          response.statusCode = 200;
          response.setHeader("content-type", apiResponse.data.mimeType);
          response.setHeader("content-length", String(apiResponse.data.sizeBytes));
          response.setHeader("content-disposition", contentDisposition);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          await writeResponseStream(response, apiResponse.data.stream);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/generated-results/") && path.endsWith("/original")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and resultAssetId are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const resultAssetId = decodePathTail(path, "/api/v1/generated-results/", "/original");
          if (!resultAssetId || resultAssetId.includes("/")) {
            const invalid = buildGeneratedResultManagementInvalidRequestResponse(
              "workspaceId and resultAssetId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }
          const streamRequest: OpenGeneratedResultOriginalContentStreamApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            resultAssetId,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.openGeneratedResultOriginalContentStream(
            streamRequest,
          );
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          if (!apiResponse.ok || !apiResponse.data) {
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, streamRequest, apiResponse);
            return;
          }

          const contentDisposition = buildContentDispositionHeader(
            apiResponse.data.contentDisposition,
            apiResponse.data.contentDispositionFileName,
          );
          response.statusCode = 200;
          response.setHeader("content-type", apiResponse.data.mimeType);
          response.setHeader("content-length", String(apiResponse.data.sizeBytes));
          response.setHeader("content-disposition", contentDisposition);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          await writeResponseStream(response, apiResponse.data.stream);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/generated-results/") && path.endsWith("/preview")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and resultAssetId are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const resultAssetId = decodePathTail(path, "/api/v1/generated-results/", "/preview");
          if (!resultAssetId || resultAssetId.includes("/")) {
            const invalid = buildGeneratedResultManagementInvalidRequestResponse(
              "workspaceId and resultAssetId are required.",
            );
            writeJson(response, 400, invalid);
            logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
            return;
          }
          const previewRequest: RequestGeneratedResultPreviewApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            resultAssetId,
            preferredPreviewKind: normalizeOptionalString(searchParams.get("preferredPreviewKind")),
            preferredMediaType: normalizeOptionalString(searchParams.get("preferredMediaType")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.requestGeneratedResultPreview(previewRequest);
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, previewRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/generated-results/") && path.endsWith("/lineage/summary")) {
      const resultAssetId = decodePathTail(path, "/api/v1/generated-results/", "/lineage/summary");
      if (!resultAssetId || resultAssetId.includes("/")) {
        return Object.freeze({ handled: false });
      }
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and resultAssetId are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const summaryRequest: GetGeneratedResultLineageSummaryApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            resultAssetId,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.getGeneratedResultLineageSummary(summaryRequest);
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, summaryRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/generated-results/") && path.endsWith("/lineage")) {
      const resultAssetId = decodePathTail(path, "/api/v1/generated-results/", "/lineage");
      if (!resultAssetId || resultAssetId.includes("/")) {
        return Object.freeze({ handled: false });
      }
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and resultAssetId are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const detailRequest: GetGeneratedResultLineageDetailApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            resultAssetId,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.getGeneratedResultLineageDetail(detailRequest);
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, detailRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (
      method === "GET"
      && path.startsWith("/api/v1/generated-results/")
      && !path.endsWith("/lineage/summary")
      && !path.endsWith("/lineage")
      && !path.endsWith("/preview/content")
      && !path.endsWith("/preview")
      && !path.endsWith("/original")
    ) {
      const resultAssetId = decodePathTail(path, "/api/v1/generated-results/");
      if (!resultAssetId || resultAssetId.includes("/")) {
        return Object.freeze({ handled: false });
      }
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and resultAssetId are required.",
          buildInvalidResponse: buildGeneratedResultManagementInvalidRequestResponse,
        },
        async (context) => {
          const getRequest: GetGeneratedResultApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            resultAssetId,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.generatedResultManagementBackendApi!.getGeneratedResult(getRequest);
          const statusCode = mapGeneratedResultManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, getRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
  const handleAssetRouteFamily = async ({
    request,
    response,
    requestId,
    logger,
    path,
    method,
  }: IdentityHttpRouteFamilyHandlerContext): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!options.assetManagementBackendApi) {
      return Object.freeze({ handled: false });
    }
    const searchParams = resolveRequestSearchParams(request.url);

    if (method === "GET" && path === "/api/v1/assets") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const parsedRequest = parseAndValidateAssetListRequest(
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            searchParams,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.assetManagementBackendApi!.listAssets(parsedRequest.data);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path === "/api/v1/assets/register") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const parsedRequest = await parseAndValidateAssetRegisterRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.assetManagementBackendApi!.registerAsset(parsedRequest.data);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path === "/api/v1/assets/generated-outputs/register") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const parsedRequest = await parseAndValidateGeneratedOutputRegisterRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.assetManagementBackendApi!.registerGeneratedOutput(parsedRequest.data);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/assets/") && path.endsWith("/uploads/initiate")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/", "/uploads/initiate");
          if (!assetId) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const parsedRequest = await parseAndValidateAssetUploadInitiationRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            assetId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.assetManagementBackendApi!.initiateAssetUpload(parsedRequest.data);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/assets/upload-sessions/") && path.endsWith("/content")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and uploadSessionId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const uploadSessionId = decodePathTail(path, "/api/v1/assets/upload-sessions/", "/content");
          if (!uploadSessionId) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and uploadSessionId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const parsedRequest = parseAssetUploadContentRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            uploadSessionId,
          );
          const apiResponse = await options.assetManagementBackendApi!.ingestAssetUploadContent(parsedRequest);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/assets/") && path.endsWith("/downloads/authorize")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/", "/downloads/authorize");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const parsedRequest = await parseAndValidateAssetDownloadAuthorizationRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            assetId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.assetManagementBackendApi!.authorizeAssetDownload(parsedRequest.data);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/assets/") && path.endsWith("/downloads/content")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId, assetId, and contentToken are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/", "/downloads/content");
          const contentToken = normalizeOptionalString(searchParams.get("contentToken"));
          if (!assetId || assetId.includes("/") || !contentToken) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId, assetId, and contentToken are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const streamRequest: OpenAuthorizedAssetDownloadStreamApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            contentToken,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.assetManagementBackendApi!.openAuthorizedAssetDownloadStream(streamRequest);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          if (!apiResponse.ok || !apiResponse.data) {
            writeJson(response, statusCode, apiResponse);
            return;
          }
          const contentDisposition = buildContentDispositionHeader(
            apiResponse.data.contentDisposition,
            apiResponse.data.contentDispositionFileName,
          );
          response.statusCode = 200;
          response.setHeader("content-type", apiResponse.data.mimeType);
          response.setHeader("content-length", String(apiResponse.data.sizeBytes));
          response.setHeader("content-disposition", contentDisposition);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          await writeResponseStream(response, apiResponse.data.stream);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/assets/") && path.endsWith("/preview")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/", "/preview");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const parsedRequest = parseAndValidateAssetPreviewRequest(
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            assetId,
            searchParams,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.assetManagementBackendApi!.resolveAssetPreview(parsedRequest.data);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/assets/")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const detailRequest: GetAssetDetailApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
            includeDeleted: parseOptionalBoolean(searchParams.get("includeDeleted")),
          });
          const apiResponse = await options.assetManagementBackendApi!.getAssetDetail(detailRequest);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, detailRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/assets/") && path.endsWith("/archive")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/", "/archive");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const archiveRequest: ArchiveAssetApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            operationKey: normalizeOptionalString(searchParams.get("operationKey")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.assetManagementBackendApi!.archiveAsset(archiveRequest);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, archiveRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/assets/") && path.endsWith("/delete")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/assets/", "/delete");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const deleteRequest: DeleteAssetApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            operationKey: normalizeOptionalString(searchParams.get("operationKey")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.assetManagementBackendApi!.deleteAsset(deleteRequest);
          const statusCode = mapAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, deleteRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
  const handleImageAssetRouteFamily = async ({
    request,
    response,
    requestId,
    logger,
    path,
    method,
  }: IdentityHttpRouteFamilyHandlerContext): Promise<IdentityHttpRouteFamilyHandlerResult> => {
    if (!options.imageAssetManagementBackendApi) {
      return Object.freeze({ handled: false });
    }

    const searchParams = resolveRequestSearchParams(request.url);

    if (method === "POST" && path === "/api/v1/image-assets") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const parsedRequest = await parseAndValidateImageAssetCreateRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.imageAssetManagementBackendApi!.createImageAsset(parsedRequest.data);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path === "/api/v1/image-assets") {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId is required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const listRequest: ListImageAssetMetadataApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            ownerUserIds: mergeOptionalStringLists(
              parseOptionalMultiStringList(searchParams, "ownerUserId", "ownerUserIds"),
              parseOptionalMultiStringList(searchParams, "ownerUserIds", "ownerUserIds"),
            ),
            originKinds: parseOptionalMultiStringList(searchParams, "originKind", "originKinds"),
            statuses: parseOptionalMultiStringList(searchParams, "status", "statuses"),
            visibilities: parseOptionalMultiStringList(searchParams, "visibility", "visibilities"),
            mediaTypes: parseOptionalMultiStringList(searchParams, "mediaType", "mediaTypes"),
            storageInstanceIds: parseOptionalMultiStringList(searchParams, "storageInstanceId", "storageInstanceIds"),
            includeDeleted: parseOptionalBoolean(searchParams.get("includeDeleted")),
            limit: parseOptionalInteger(searchParams.get("limit")),
            offset: parseOptionalInteger(searchParams.get("offset")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.imageAssetManagementBackendApi!.listImageAssetMetadata(listRequest);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, listRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/image-assets/") && path.endsWith("/content")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId, assetId, and uploadSessionId are required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const decoded = decodeImageAssetUploadSessionPath(path, "/content");
          if (!decoded) {
            const invalid = buildImageAssetManagementInvalidRequestResponse("workspaceId, assetId, and uploadSessionId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const ingestRequest: IngestImageAssetUploadContentApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId: decoded.assetId,
            uploadSessionId: decoded.uploadSessionId,
            contentType: typeof request.headers["content-type"] === "string" ? request.headers["content-type"] : undefined,
            content: toRequestBodyStream(request),
            expectedSizeBytes: parseOptionalInteger(searchParams.get("expectedSizeBytes")),
            expectedChecksumSha256: normalizeOptionalString(searchParams.get("expectedChecksumSha256")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.imageAssetManagementBackendApi!.ingestImageAssetUploadContent(ingestRequest);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, ingestRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "POST" && path.startsWith("/api/v1/image-assets/") && path.endsWith("/complete")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId, assetId, and uploadSessionId are required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const decoded = decodeImageAssetUploadSessionPath(path, "/complete");
          if (!decoded) {
            const invalid = buildImageAssetManagementInvalidRequestResponse("workspaceId, assetId, and uploadSessionId are required.");
            writeJson(response, 400, invalid);
            return;
          }

          const parsedRequest = await parseAndValidateImageAssetCompleteRequest(
            request,
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            decoded.assetId,
            decoded.uploadSessionId,
            requestId,
            logger,
            maxBodyBytes,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }

          const apiResponse = await options.imageAssetManagementBackendApi!.completeImageAssetUpload(parsedRequest.data);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/image-assets/") && path.endsWith("/preview/content")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId, assetId, and previewToken are required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/image-assets/", "/preview/content");
          const previewToken = normalizeOptionalString(searchParams.get("previewToken"));
          if (!assetId || assetId.includes("/") || !previewToken) {
            const invalid = buildImageAssetManagementInvalidRequestResponse("workspaceId, assetId, and previewToken are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const streamRequest: OpenImageAssetPreviewContentStreamApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            previewToken,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.imageAssetManagementBackendApi!.openImageAssetPreviewContentStream(streamRequest);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          if (!apiResponse.ok || !apiResponse.data) {
            writeJson(response, statusCode, apiResponse);
            return;
          }
          const contentDisposition = buildContentDispositionHeader(
            apiResponse.data.contentDisposition,
            apiResponse.data.contentDispositionFileName,
          );
          response.statusCode = 200;
          response.setHeader("content-type", apiResponse.data.mimeType);
          response.setHeader("content-length", String(apiResponse.data.sizeBytes));
          response.setHeader("content-disposition", contentDisposition);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          await writeResponseStream(response, apiResponse.data.stream);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/image-assets/") && path.endsWith("/preview")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/image-assets/", "/preview");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildImageAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const parsedRequest = parseAndValidateImageAssetPreviewRequest(
            context.actor.userIdentityId,
            context.workspace.workspaceId,
            assetId,
            searchParams,
          );
          if (!parsedRequest.ok) {
            writeJson(response, parsedRequest.statusCode, parsedRequest.body);
            return;
          }
          const apiResponse = await options.imageAssetManagementBackendApi!.requestImageAssetPreview(parsedRequest.data);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, parsedRequest.data, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/image-assets/") && path.endsWith("/original")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/image-assets/", "/original");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildImageAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const streamRequest: OpenImageAssetOriginalContentStreamApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.imageAssetManagementBackendApi!.openImageAssetOriginalContentStream(streamRequest);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          if (!apiResponse.ok || !apiResponse.data) {
            writeJson(response, statusCode, apiResponse);
            return;
          }
          const contentDisposition = buildContentDispositionHeader(
            apiResponse.data.contentDisposition,
            apiResponse.data.contentDispositionFileName,
          );
          response.statusCode = 200;
          response.setHeader("content-type", apiResponse.data.mimeType);
          response.setHeader("content-length", String(apiResponse.data.sizeBytes));
          response.setHeader("content-disposition", contentDisposition);
          response.setHeader("x-content-type-options", "nosniff");
          response.setHeader("cache-control", "private, no-store");
          await writeResponseStream(response, apiResponse.data.stream);
        },
      );
      return Object.freeze({ handled: true });
    }

    if (method === "GET" && path.startsWith("/api/v1/image-assets/")) {
      await requireAuthenticatedWorkspaceSession(
        request,
        response,
        requestId,
        options.backendApi,
        logger,
        options.transportTrust,
        {
          missingWorkspaceMessage: "workspaceId and assetId are required.",
          buildInvalidResponse: buildImageAssetManagementInvalidRequestResponse,
        },
        async (context) => {
          const assetId = decodePathTail(path, "/api/v1/image-assets/");
          if (!assetId || assetId.includes("/")) {
            const invalid = buildImageAssetManagementInvalidRequestResponse("workspaceId and assetId are required.");
            writeJson(response, 400, invalid);
            return;
          }
          const detailRequest: GetImageAssetMetadataApiRequest = Object.freeze({
            actorUserIdentityId: context.actor.userIdentityId,
            workspaceId: context.workspace.workspaceId,
            assetId,
            includeDeleted: parseOptionalBoolean(searchParams.get("includeDeleted")),
            correlationId: normalizeOptionalString(searchParams.get("correlationId")),
            occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
          });
          const apiResponse = await options.imageAssetManagementBackendApi!.getImageAssetMetadata(detailRequest);
          const statusCode = mapImageAssetManagementStatusCode(apiResponse);
          writeJson(response, statusCode, apiResponse);
          logResponse(logger, requestId, request, statusCode, detailRequest, apiResponse);
        },
      );
      return Object.freeze({ handled: true });
    }

    return Object.freeze({ handled: false });
  };
  const handleIdentityAndTrustedDeviceRouteFamily = createIdentityAndTrustedDeviceRouteFamilyHandler({
    options,
    maxBodyBytes,
    handleRegister,
    handleLogin,
    handleDevLogin,
    requireAuthenticatedSession,
    writeJson,
    logResponse,
    normalizeOptionalString,
    mapStatusCode,
    parseAndValidateRequest,
    RevokeSessionRequestSchema,
    parseSharedListPaginationFromQuery,
    buildQueryValidationError,
    IdentitySessionStatusValues,
    IdentitySessionAccessChannelValues,
    ChangeCredentialRequestSchema,
    AdminAccountStatusValues,
    buildAdminContext,
    SetAdminAccountStatusRequestSchema,
    RevokeSessionByPathRequestSchema,
    TrustedDeviceStatusValues,
    RevokeIdentityAdminTrustedDeviceRequestSchema,
    decodePathTail,
    buildInvalidRequestResponse,
    buildForbiddenResponse,
    RevokeTrustedDeviceRequestSchema,
    UpdateTrustedDeviceDisplayNameRequestSchema,
    InitiateTrustedDevicePairingRequestSchema,
    ValidateTrustedDevicePairingRequestSchema,
    CompleteTrustedDevicePairingRequestSchema,
    resolveRequestSearchParams,
    resolveSessionActorContextWorkspaceId,
    normalizeSessionAssuranceLevel,
  });
  const handleAuthorizationRouteFamily = createAuthorizationRouteFamilyHandler({
    options,
    maxBodyBytes,
    requireAuthenticatedSession,
    decodeAuthorizationResourcePath,
    buildAuthorizationManagementInvalidRequestResponse,
    writeJson,
    logResponse,
    parseAndValidateAuthorizationManagementRequest,
    AuthorizationUpdateVisibilityRequestSchema,
    mapAuthorizationManagementStatusCode,
    AuthorizationGrantSharingRequestSchema,
    decodeAuthorizationResourceAndGrantPath,
    AuthorizationRevokeSharingRequestSchema,
    AuthorizationBulkWorkspaceRoleSharingGrantRequestSchema,
    parseOptionalBoolean,
    normalizeOptionalString,
    decodeAuthorizationWorkspaceReportingPath,
    parseOptionalInteger,
  });
  const handleWorkspaceRouteFamily = createWorkspaceRouteFamilyHandler({
    options,
    maxBodyBytes,
    requireAuthenticatedSession,
    parseSharedListPaginationFromQuery,
    parseOptionalBoolean,
    buildWorkspaceAdministrationQueryValidationError,
    writeJson,
    logResponse,
    normalizeOptionalString,
    WorkspaceStatusValues,
    parseOptionalEnum,
    WorkspaceVisibilityValues,
    mapWorkspaceAdministrationStatusCode,
    parseAndValidateWorkspaceAdministrationRequest,
    CreateWorkspaceRequestSchema,
    decodePathTail,
    buildWorkspaceAdministrationInvalidRequestResponse,
    UpdateWorkspaceRequestSchema,
    TransitionWorkspaceLifecycleRequestSchema,
    WorkspaceMembershipStatusValues,
    AddWorkspaceMemberRequestSchema,
    decodeWorkspaceUserScopedPath,
    ChangeWorkspaceMembershipStatusRequestSchema,
    WorkspaceInvitationStatusValues,
    decodeWorkspaceEntityPath,
    WorkspaceRoleValues,
    WorkspaceRoleAssignmentStatusValues,
    AssignWorkspaceRoleRequestSchema,
    ReassignWorkspaceRoleRequestSchema,
    RevokeWorkspaceRoleRequestSchema,
    buildWorkspaceInvalidRequestResponse,
    parseAndValidateWorkspaceRequest,
    IssueWorkspaceInvitationRequestSchema,
    mapWorkspaceStatusCode,
    AcceptWorkspaceInvitationOnboardingRequestSchema,
  });
  const handleAuditLedgerRouteFamily = createAuditLedgerRouteFamilyHandler({
    options,
    requireAuthenticatedWorkspaceSession,
    parseAndValidateAuditLedgerListQuery,
    resolveRequestSearchParams,
    decodePathTail,
    buildAuditLedgerInvalidRequestResponse,
    mapAuditLedgerStatusCode,
    writeJson,
    logResponse,
  });
  const handleExecutionNodeManagementRouteFamily = createExecutionNodeManagementRouteFamilyHandler({
    options,
    maxBodyBytes,
    resolveRequestSearchParams,
    parseOptionalStringList,
    parseOptionalBoolean,
    parseOptionalInteger,
    normalizeOptionalString,
    requireAuthenticatedSession,
    parseExecutionNodeListRequestDto,
    parseExecutionNodeReadinessCheckRequestDto,
    parseExecutionNodeEligibilityCheckRequestDto,
    parseExecutionNodeBackendAvailabilityReadRequestDto,
    parseAndValidateExecutionNodeSetAvailabilityOverrideRequest,
    buildExecutionNodeManagementValidationErrorResponse,
    buildExecutionNodeManagementInvalidRequestResponse,
    mapExecutionNodeManagementStatusCode,
    decodePathTail,
    writeJson,
    logResponse,
    executionNodeRoutes: ExecutionNodeManagementTransportRoutes,
  });
  const handleDeploymentPolicyRouteFamily = createDeploymentPolicyRouteFamilyHandler({
    options,
    maxBodyBytes,
    DeploymentPolicyReadTransportRoutes,
    DeploymentPolicyWriteTransportRoutes,
    resolveCanonicalRequestPath,
    resolveRequestSearchParams,
    requireAuthenticatedWorkspaceSession,
    buildRuntimeInvalidRequestResponse,
    parseAndValidateDeploymentPolicyStateReadRequest,
    resolveRequestCorrelationId,
    mapRunSubmissionStatusCode,
    writeJson,
    logResponse,
    parseAndValidateRuntimeMutationBody,
    parseAndValidateDeploymentPolicyActiveProfileWriteRequest,
    parseAndValidateDeploymentPolicyOverrideWriteRequest,
  });
  const handleSecretMetadataRouteFamily = createSecretMetadataRouteFamilyHandler({
    options,
    maxBodyBytes,
    requireAuthenticatedSession,
    parseJsonBody,
    buildSecretMetadataInvalidRequestResponse,
    buildSecretMetadataValidationErrors,
    ReEncryptSecretsCommandSchema,
    decodePathTail,
    normalizeOptionalString,
    resolveRequestSearchParams,
    GetSecretReEncryptionStatusQuerySchema,
    parseAndValidateSecretMetadataRequest,
    CreateSecretMetadataCommandSchema,
    parseOptionalBoolean,
    parseOptionalInteger,
    ListSecretMetadataQuerySchema,
    GetSecretMetadataQuerySchema,
    RotateSecretMetadataCommandSchema,
    DisableSecretMetadataCommandSchema,
    mapSecretMetadataStatusCode,
    writeJson,
    logResponse,
  });
  const handleCertificateOperationsRouteFamily = createCertificateOperationsRouteFamilyHandler({
    options,
    maxBodyBytes,
    requireAuthenticatedSession,
    parseOptionalInteger,
    parseOptionalBoolean,
    normalizeOptionalString,
    buildCertificateOperationsQueryValidationError,
    buildCertificateOperationsInvalidRequestResponse,
    mapCertificateOperationsStatusCode,
    CertificateStatusValues,
    CertificateSubjectReferenceKindValues,
    CertificateUsageValues,
    CertificateTrustStatusValues,
    decodePathTail,
    parseAndValidateRequest,
    RevokeIssuedCertificateRequestSchema,
    RenewIssuedCertificateRequestSchema,
    resolveRequestSearchParams,
    writeJson,
    logResponse,
  });
  const handleNodeTrustRouteFamily = createNodeTrustRouteFamilyHandler({
    options,
    maxBodyBytes,
    parseAndValidateNodeEnrollmentSubmissionRequest,
    writeJson,
    mapNodeTrustStatusCode,
    logResponse,
    requireAuthenticatedSession,
    normalizeOptionalString,
    parseOptionalInteger,
    parseOptionalBoolean,
    buildNodeTrustQueryValidationError,
    NodePendingEnrollmentStatusValues,
    NodeTypeValues,
    NodeCapabilityValues,
    NodeApprovalStatusValues,
    NodeInventoryOperationalStateValues,
    NodeInventoryPresenceStateValues,
    NodeEnrollmentRequestStatusValues,
    buildNodeTrustInvalidRequestResponse,
    decodePathTail,
    parseAndValidateRevokeNodeTrustRequest,
    requireAuthenticatedNodeTransport,
    resolveRequestSearchParams,
    parseResolveNodeRuntimeTrustMaterialRequestDto,
    NodeTrustApiSchemaValidationError,
    NodeTrustApiErrorCodes,
    parseAndValidateNodeHeartbeatRequest,
    parseAndValidateNodeOperationalUpdateRequest,
    parseAndValidateApproveNodeEnrollmentRequest,
    parseAndValidateRejectNodeEnrollmentRequest,
  });
  const handleRunSubmissionRouteFamily = createRunSubmissionRouteFamilyHandler({
    options,
    maxBodyBytes,
    resolveRequestSearchParams,
    requireAuthenticatedWorkspaceSession,
    requireAuthenticatedNodeTransport,
    parseAndValidateRuntimeMutationBody,
    parseAndValidateAuthoritativeRunSubmissionMutationRequest,
    parseAndValidateAuthoritativeRunListReadRequest,
    parseAndValidateExecutionReadinessReadRequest,
    parseAndValidateAuthoritativeRunCancellationMutationRequest,
    parseAndValidateAuthoritativeRunRetryMutationRequest,
    parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest,
    parseAndValidateAuthoritativeRunQueueStatusReadRequest,
    parseAndValidateSchedulingAdminStaleReservationsReadRequest,
    parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest,
    parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest,
    decodePathTail,
    asRecord,
    mapRunSubmissionStatusCode,
    buildRuntimeInvalidRequestResponse,
    writeJson,
    logResponse,
    runRoutes: Object.freeze({
      startRun: SystemRuntimeTransportRoutes.startRun,
      listRuns: RunOrchestrationTransportRoutes.listRuns,
      getExecutionReadiness: RunOrchestrationTransportRoutes.getExecutionReadiness,
      listQueueStatus: RunOrchestrationTransportRoutes.listQueueStatus,
      listSchedulingStaleReservations: RunOrchestrationTransportRoutes.listSchedulingStaleReservations,
      releaseSchedulingStaleReservation: RunOrchestrationTransportRoutes.releaseSchedulingStaleReservation,
      reevaluateSchedulingDeferredRuns: RunOrchestrationTransportRoutes.reevaluateSchedulingDeferredRuns,
    }),
    imageRunRoutes: Object.freeze({
      listRuns: ImageRunApiRoutes.listRuns,
    }),
    resolveRouteFamilyAvailability: (routeFamilyId) => options.routeFamilyAvailability?.resolveRouteFamilyAvailability?.(routeFamilyId),
  });
  const handleRunReadRouteFamily = createRunReadRouteFamilyHandler({
    options,
    maxBodyBytes,
    resolveRequestSearchParams,
    requireAuthenticatedWorkspaceSession,
    requireAuthenticatedNodeTransport,
    parseAndValidateRuntimeMutationBody,
    parseAndValidateAuthoritativeRunSubmissionMutationRequest,
    parseAndValidateAuthoritativeRunListReadRequest,
    parseAndValidateExecutionReadinessReadRequest,
    parseAndValidateAuthoritativeRunCancellationMutationRequest,
    parseAndValidateAuthoritativeRunRetryMutationRequest,
    parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest,
    parseAndValidateAuthoritativeRunQueueStatusReadRequest,
    parseAndValidateSchedulingAdminStaleReservationsReadRequest,
    parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest,
    parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest,
    decodePathTail,
    asRecord,
    mapRunSubmissionStatusCode,
    buildRuntimeInvalidRequestResponse,
    writeJson,
    logResponse,
    runRoutes: Object.freeze({
      startRun: SystemRuntimeTransportRoutes.startRun,
      listRuns: RunOrchestrationTransportRoutes.listRuns,
      getExecutionReadiness: RunOrchestrationTransportRoutes.getExecutionReadiness,
      listQueueStatus: RunOrchestrationTransportRoutes.listQueueStatus,
      listSchedulingStaleReservations: RunOrchestrationTransportRoutes.listSchedulingStaleReservations,
      releaseSchedulingStaleReservation: RunOrchestrationTransportRoutes.releaseSchedulingStaleReservation,
      reevaluateSchedulingDeferredRuns: RunOrchestrationTransportRoutes.reevaluateSchedulingDeferredRuns,
    }),
    imageRunRoutes: Object.freeze({
      listRuns: ImageRunApiRoutes.listRuns,
    }),
    resolveRouteFamilyAvailability: (routeFamilyId) => options.routeFamilyAvailability?.resolveRouteFamilyAvailability?.(routeFamilyId),
  });
  const handleRunMutationRouteFamily = createRunMutationRouteFamilyHandler({
    options,
    maxBodyBytes,
    resolveRequestSearchParams,
    requireAuthenticatedWorkspaceSession,
    requireAuthenticatedNodeTransport,
    parseAndValidateRuntimeMutationBody,
    parseAndValidateAuthoritativeRunSubmissionMutationRequest,
    parseAndValidateAuthoritativeRunListReadRequest,
    parseAndValidateExecutionReadinessReadRequest,
    parseAndValidateAuthoritativeRunCancellationMutationRequest,
    parseAndValidateAuthoritativeRunRetryMutationRequest,
    parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest,
    parseAndValidateAuthoritativeRunQueueStatusReadRequest,
    parseAndValidateSchedulingAdminStaleReservationsReadRequest,
    parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest,
    parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest,
    decodePathTail,
    asRecord,
    mapRunSubmissionStatusCode,
    buildRuntimeInvalidRequestResponse,
    writeJson,
    logResponse,
    runRoutes: Object.freeze({
      startRun: SystemRuntimeTransportRoutes.startRun,
      listRuns: RunOrchestrationTransportRoutes.listRuns,
      getExecutionReadiness: RunOrchestrationTransportRoutes.getExecutionReadiness,
      listQueueStatus: RunOrchestrationTransportRoutes.listQueueStatus,
      listSchedulingStaleReservations: RunOrchestrationTransportRoutes.listSchedulingStaleReservations,
      releaseSchedulingStaleReservation: RunOrchestrationTransportRoutes.releaseSchedulingStaleReservation,
      reevaluateSchedulingDeferredRuns: RunOrchestrationTransportRoutes.reevaluateSchedulingDeferredRuns,
    }),
    imageRunRoutes: Object.freeze({
      listRuns: ImageRunApiRoutes.listRuns,
    }),
    resolveRouteFamilyAvailability: (routeFamilyId) => options.routeFamilyAvailability?.resolveRouteFamilyAvailability?.(routeFamilyId),
  });
  const handleRunExecutionUpdateRouteFamily = createRunExecutionUpdateRouteFamilyHandler({
    options,
    maxBodyBytes,
    resolveRequestSearchParams,
    requireAuthenticatedWorkspaceSession,
    requireAuthenticatedNodeTransport,
    parseAndValidateRuntimeMutationBody,
    parseAndValidateAuthoritativeRunSubmissionMutationRequest,
    parseAndValidateAuthoritativeRunListReadRequest,
    parseAndValidateExecutionReadinessReadRequest,
    parseAndValidateAuthoritativeRunCancellationMutationRequest,
    parseAndValidateAuthoritativeRunRetryMutationRequest,
    parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest,
    parseAndValidateAuthoritativeRunQueueStatusReadRequest,
    parseAndValidateSchedulingAdminStaleReservationsReadRequest,
    parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest,
    parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest,
    decodePathTail,
    asRecord,
    mapRunSubmissionStatusCode,
    buildRuntimeInvalidRequestResponse,
    writeJson,
    logResponse,
    runRoutes: Object.freeze({
      startRun: SystemRuntimeTransportRoutes.startRun,
      listRuns: RunOrchestrationTransportRoutes.listRuns,
      getExecutionReadiness: RunOrchestrationTransportRoutes.getExecutionReadiness,
      listQueueStatus: RunOrchestrationTransportRoutes.listQueueStatus,
      listSchedulingStaleReservations: RunOrchestrationTransportRoutes.listSchedulingStaleReservations,
      releaseSchedulingStaleReservation: RunOrchestrationTransportRoutes.releaseSchedulingStaleReservation,
      reevaluateSchedulingDeferredRuns: RunOrchestrationTransportRoutes.reevaluateSchedulingDeferredRuns,
    }),
    imageRunRoutes: Object.freeze({
      listRuns: ImageRunApiRoutes.listRuns,
    }),
    resolveRouteFamilyAvailability: (routeFamilyId) => options.routeFamilyAvailability?.resolveRouteFamilyAvailability?.(routeFamilyId),
  });
  const defaultRouteFamilyHandlers: Readonly<Partial<Record<string, IdentityHttpRouteFamilyHandler>>> = Object.freeze({
    "identity-auth": handleIdentityAndTrustedDeviceRouteFamily,
    "workspace-invitations": handleWorkspaceRouteFamily,
    "workspace-administration": handleWorkspaceRouteFamily,
    "authorization-management": handleAuthorizationRouteFamily,
    "storage-management": handleStorageManagementRouteFamily,
    "audit-ledger": handleAuditLedgerRouteFamily,
    "execution-node-management": handleExecutionNodeManagementRouteFamily,
    "run-submission": handleRunSubmissionRouteFamily,
    "run-read": handleRunReadRouteFamily,
    "run-mutation": handleRunMutationRouteFamily,
    "run-execution-update": handleRunExecutionUpdateRouteFamily,
    "asset-management": async (context) => {
      const generated = await handleGeneratedResultRouteFamily(context);
      if (generated.handled) {
        return generated;
      }
      return handleAssetRouteFamily(context);
    },
    "image-asset-management": handleImageAssetRouteFamily,
    "image-run-api": handleGeneratedResultRouteFamily,
    "deployment-policy-read": handleDeploymentPolicyRouteFamily,
    "deployment-policy-write": handleDeploymentPolicyRouteFamily,
    "security-secret-metadata": handleSecretMetadataRouteFamily,
    "security-certificate-operations": handleCertificateOperationsRouteFamily,
    "node-trust": handleNodeTrustRouteFamily,
  });
  const routeFamilyHandlers: Readonly<Partial<Record<string, IdentityHttpRouteFamilyHandler>>> = (
    Object.freeze({
      ...defaultRouteFamilyHandlers,
      ...(options.routeFamilyHandlers ?? Object.freeze({})),
    })
  );
  logger.info(Object.freeze({
    event: "identity-http.route-families.composed",
    requestId: "startup-route-composition",
    details: routeCompositionLogDetails,
  }));
  let hasLoggedRootReadinessProbe = false;
  const server = transportComposition.serverAdapter.createServer(async (request, response) => {
    const requestStartedAt = Date.now();
    const requestId = randomUUID();
    const correlationId = resolveRequestCorrelationId(request, requestId);
    setResponseCorrelationHeaders(response, requestId, correlationId);
    const path = resolveCanonicalRequestPath(request.url);
    const transportState = resolveInboundHttpTransportConnectionState(request);
    const rootReadinessProbe = isRootReadinessProbeRequest(request.method, path);
    if (!rootReadinessProbe) {
      logger.info(Object.freeze({
        event: "identity-http.request.received",
        requestId,
        correlationId,
        method: request.method,
        path,
        details: Object.freeze({
          startedAt: new Date(requestStartedAt).toISOString(),
        }),
      }));
    }

    try {
      if (path.startsWith("/api/")) {
        const corsEvaluation = evaluateApiCorsRequest({
          request,
          response,
          path,
          corsPolicy,
        });
        if (!corsEvaluation.ok) {
          const forbidden = buildForbiddenResponse(corsEvaluation.message);
          writeJson(response, 403, forbidden);
          logResponse(logger, requestId, request, 403, Object.freeze({
            transport: transportState,
            cors: Object.freeze({
              reason: corsEvaluation.reason,
              origin: corsEvaluation.origin,
            }),
          }), forbidden);
          return;
        }
        if (corsEvaluation.preflight) {
          writeNoContent(response, 204);
          logger.info(Object.freeze({
            event: "identity-http.cors.preflight.accepted",
            requestId,
            correlationId,
            method: request.method,
            path,
            statusCode: 204,
          }));
          return;
        }
      }

      if (path.startsWith("/api/")) {
        const secureTransportDecision = enforceApiSecureTransport({
          request,
          secureTransport: options.secureTransport,
          transportState,
        });
        if (!secureTransportDecision.ok) {
          writeJson(response, secureTransportDecision.statusCode, secureTransportDecision.body);
          logResponse(logger, requestId, request, secureTransportDecision.statusCode, Object.freeze({
            transport: transportState,
          }), secureTransportDecision.body);
          return;
        }
      }

      const matchedRouteFamily = transportComposition.routeModuleRegistry.resolveRouteFamilyByPath(path);
      if (matchedRouteFamily) {
        const routeFamilyAvailability = options.routeFamilyAvailability;
        const runtimeGuardRouteFamilyId = resolveRuntimeCapabilityGuardRouteFamilyId({
          method: request.method,
          path,
          matchedRouteFamilyId: matchedRouteFamily.routeFamilyId,
        });
        const shouldAllowStateDrivenReadinessBypass = (
          runtimeGuardRouteFamilyId === "run-read"
          && request.method === "GET"
          && path === RunOrchestrationTransportRoutes.getExecutionReadiness
        );
        if (
          routeFamilyAvailability
          && !routeFamilyAvailability.isRouteFamilyAvailable(runtimeGuardRouteFamilyId)
        ) {
          const availabilityDetails = routeFamilyAvailability.resolveRouteFamilyAvailability?.(
            runtimeGuardRouteFamilyId,
          );
          const runtimeCapabilityGuard = evaluateRuntimeCapabilityGuard({
            endpoint: path,
            requestId,
            routeFamilyId: runtimeGuardRouteFamilyId,
            availability: availabilityDetails,
          });
          if (!shouldAllowStateDrivenReadinessBypass) {
            const unavailableResponse = runtimeCapabilityGuard.response ?? buildRouteFamilyCapabilityUnavailableResponse({
              routeFamilyId: runtimeGuardRouteFamilyId,
              capabilityId: availabilityDetails?.capabilityId,
            });
            writeJson(response, 503, unavailableResponse);
            logger.info(Object.freeze({
              event: "identity-http.route-family.capability-unavailable",
              requestId,
              correlationId,
              method: request.method,
              path,
              details: Object.freeze({
                routeFamilyId: runtimeGuardRouteFamilyId,
                matchedRouteFamilyId: matchedRouteFamily.routeFamilyId,
                capabilityId: availabilityDetails?.capabilityId,
                capabilityState: availabilityDetails?.state,
                runtimeState: runtimeCapabilityGuard.runtimeState,
              }),
            }));
            return;
          }
        }
        const routeFamilyHandler = routeFamilyHandlers[matchedRouteFamily.routeFamilyId];
        if (routeFamilyHandler) {
          const handlerResult = await routeFamilyHandler({
            request,
            response,
            requestId,
            correlationId,
            path,
            method: request.method,
            logger,
            routeFamily: matchedRouteFamily,
          });
          const handled = handlerResult?.handled ?? true;
          if (handled) {
            logger.info(Object.freeze({
              event: "identity-http.route-family.modular-handled",
              requestId,
              correlationId,
              method: request.method,
              path,
              details: Object.freeze({
                routeFamilyId: matchedRouteFamily.routeFamilyId,
              }),
            }));
            return;
          }

        }
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "POST"
        && path === SystemRuntimeTransportRoutes.startRun
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const parsedBody = await parseAndValidateRuntimeMutationBody(request, maxBodyBytes);
            if (!parsedBody.ok) {
              writeJson(response, 400, parsedBody.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                workspaceId: context.workspace.workspaceId,
                actorUserIdentityId: context.actor.userIdentityId,
              }), parsedBody.body);
              return;
            }
            const parsedRequest = parseAndValidateRuntimeStartRunMutationRequest(parsedBody.value);
            if (!parsedRequest.ok) {
              writeJson(response, 400, parsedRequest.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                workspaceId: context.workspace.workspaceId,
                actorUserIdentityId: context.actor.userIdentityId,
              }), parsedRequest.body);
              return;
            }

            const requestContext = buildRuntimeApiRequestContext(context, "mutation");
            const apiResponse = await options.systemRuntimeBackendApi.startExecutionAsync({
              ...parsedRequest.data,
              requestContext,
            });
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
              systemId: parsedRequest.data.systemId,
              versionId: parsedRequest.data.versionId,
              executionId: parsedRequest.data.executionId,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "POST"
        && path.startsWith("/api/v1/runtime/runs/")
        && path.endsWith("/cancel")
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const executionId = decodePathTail(path, "/api/v1/runtime/runs/", "/cancel");
            if (!executionId) {
              const invalid = buildRuntimeInvalidRequestResponse("workspaceId and executionId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const parsedBody = await parseAndValidateRuntimeMutationBody(request, maxBodyBytes, true);
            if (!parsedBody.ok) {
              writeJson(response, 400, parsedBody.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                executionId,
                workspaceId: context.workspace.workspaceId,
              }), parsedBody.body);
              return;
            }
            const parsedRequest = parseAndValidateRuntimeCancelRunMutationRequest(executionId, parsedBody.value);
            if (!parsedRequest.ok) {
              writeJson(response, 400, parsedRequest.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                executionId,
                workspaceId: context.workspace.workspaceId,
              }), parsedRequest.body);
              return;
            }

            const requestContext = buildRuntimeApiRequestContext(context, "mutation");
            const apiResponse = await options.systemRuntimeBackendApi.cancelExecution({
              ...parsedRequest.data,
              requestContext,
            });
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              executionId,
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "POST"
        && path.startsWith("/api/v1/runtime/queue/")
        && path.endsWith("/dequeue")
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const queueItemId = decodePathTail(path, "/api/v1/runtime/queue/", "/dequeue");
            if (!queueItemId) {
              const invalid = buildRuntimeInvalidRequestResponse("workspaceId and queueItemId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const parsedBody = await parseAndValidateRuntimeMutationBody(request, maxBodyBytes, true);
            if (!parsedBody.ok) {
              writeJson(response, 400, parsedBody.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                queueItemId,
                workspaceId: context.workspace.workspaceId,
              }), parsedBody.body);
              return;
            }
            const parsedRequest = parseAndValidateRuntimeDequeueMutationRequest(queueItemId, parsedBody.value);
            if (!parsedRequest.ok) {
              writeJson(response, 400, parsedRequest.body);
              logResponse(logger, requestId, request, 400, Object.freeze({
                queueItemId,
                workspaceId: context.workspace.workspaceId,
              }), parsedRequest.body);
              return;
            }

            const requestContext = buildRuntimeApiRequestContext(context, "mutation");
            const apiResponse = await options.systemRuntimeBackendApi.dequeueQueueItem({
              ...parsedRequest.data,
              requestContext,
            });
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              queueItemId,
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/runtime/runs/")
        && path.endsWith("/status")
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const executionId = decodePathTail(path, "/api/v1/runtime/runs/", "/status");
            if (!executionId) {
              const invalid = buildRuntimeInvalidRequestResponse("workspaceId and executionId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }

            const requestContext = buildRuntimeApiRequestContext(context);
            const apiResponse = await options.systemRuntimeBackendApi.getExecutionStatus(executionId, requestContext);
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              executionId,
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/runtime/runs/")
        && path.endsWith("/result")
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const executionId = decodePathTail(path, "/api/v1/runtime/runs/", "/result");
            if (!executionId) {
              const invalid = buildRuntimeInvalidRequestResponse("workspaceId and executionId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const nodeResultLimit = parseOptionalInteger(searchParams.get("nodeResultLimit"));
            const diagnosticsLimit = parseOptionalInteger(searchParams.get("diagnosticsLimit"));
            if ((searchParams.get("nodeResultLimit") && nodeResultLimit === undefined)
              || (searchParams.get("diagnosticsLimit") && diagnosticsLimit === undefined)) {
              const invalid = buildRuntimeInvalidRequestResponse("nodeResultLimit and diagnosticsLimit must be integers.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                executionId,
                workspaceId: context.workspace.workspaceId,
              }), invalid);
              return;
            }

            const requestContext = buildRuntimeApiRequestContext(context);
            const apiResponse = await options.systemRuntimeBackendApi.getExecutionResultBounded({
              executionId,
              nodeResultLimit,
              diagnosticsLimit,
              requestContext,
            });
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              executionId,
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
              nodeResultLimit,
              diagnosticsLimit,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "GET"
        && path.startsWith("/api/v1/runtime/runs/")
        && path.endsWith("/trace")
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const executionId = decodePathTail(path, "/api/v1/runtime/runs/", "/trace");
            if (!executionId) {
              const invalid = buildRuntimeInvalidRequestResponse("workspaceId and executionId are required.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({}), invalid);
              return;
            }
            const eventLimit = parseOptionalInteger(searchParams.get("eventLimit"));
            const logLimit = parseOptionalInteger(searchParams.get("logLimit"));
            if ((searchParams.get("eventLimit") && eventLimit === undefined)
              || (searchParams.get("logLimit") && logLimit === undefined)) {
              const invalid = buildRuntimeInvalidRequestResponse("eventLimit and logLimit must be integers.");
              writeJson(response, 400, invalid);
              logResponse(logger, requestId, request, 400, Object.freeze({
                executionId,
                workspaceId: context.workspace.workspaceId,
              }), invalid);
              return;
            }

            const requestContext = buildRuntimeApiRequestContext(context);
            const apiResponse = await options.systemRuntimeBackendApi.getExecutionTrace({
              executionId,
              eventLimit,
              logLimit,
              requestContext,
            });
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              executionId,
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
              eventLimit,
              logLimit,
            }), apiResponse);
          },
        );
        return;
      }
      if (
        options.systemRuntimeBackendApi
        && request.method === "GET"
        && path === "/api/v1/runtime/queue"
      ) {
        await requireAuthenticatedWorkspaceSession(
          request,
          response,
          requestId,
          options.backendApi,
          logger,
          options.transportTrust,
          {
            missingWorkspaceMessage: "workspaceId is required.",
            buildInvalidResponse: buildRuntimeInvalidRequestResponse,
          },
          async (context) => {
            const parsedRequest = parseAndValidateRuntimeQueueListRequest({
              workspaceId: context.workspace.workspaceId,
              searchParams,
            });
            if (!parsedRequest.ok) {
              writeJson(response, parsedRequest.statusCode, parsedRequest.body);
              logResponse(
                logger,
                requestId,
                request,
                parsedRequest.statusCode,
                Object.freeze({ workspaceId: context.workspace.workspaceId }),
                parsedRequest.body,
              );
              return;
            }
            const requestContext = buildRuntimeApiRequestContext(context);
            const apiResponse = await options.systemRuntimeBackendApi.listQueueItems({
              ...parsedRequest.data,
              requestContext,
            });
            const statusCode = mapSystemRuntimeStatusCode(apiResponse);
            writeJson(response, statusCode, apiResponse);
            logResponse(logger, requestId, request, statusCode, Object.freeze({
              workspaceId: context.workspace.workspaceId,
              actorUserIdentityId: context.actor.userIdentityId,
              query: Object.fromEntries(searchParams.entries()),
            }), apiResponse);
          },
        );
        return;
      }

      if (request.method === "GET" && path === "/") {
        const apiResponse = Object.freeze({
          ok: true,
          data: Object.freeze({
            service: "identity-http",
            status: "ready",
          }),
        });
        writeJson(response, 200, apiResponse);
        if (!hasLoggedRootReadinessProbe) {
          hasLoggedRootReadinessProbe = true;
          logger.info(Object.freeze({
            event: "identity-http.readiness.confirmed",
            requestId,
            correlationId,
            method: request.method,
            path,
            statusCode: 200,
            details: {
              response: redactSensitiveAuthPayload(apiResponse),
            },
          }));
        }
        return;
      }

      writeJson(response, 404, {
        ok: false,
        error: {
          code: IdentityAuthApiErrorCodes.notFound,
          message: "Route not found.",
        },
      });
      logger.warn(Object.freeze({
        event: "identity-http.request.not-found",
        requestId,
        correlationId,
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
        correlationId,
        method: request.method,
        path,
        statusCode: 500,
        details: {
          error: normalizeError(error),
        },
      }));
    } finally {
      if (!rootReadinessProbe) {
        const requestCompletedAt = Date.now();
        logger.info(Object.freeze({
          event: "identity-http.request.timing",
          requestId,
          correlationId,
          method: request.method,
          path,
          statusCode: response.statusCode,
          details: Object.freeze({
            startedAt: new Date(requestStartedAt).toISOString(),
            completedAt: new Date(requestCompletedAt).toISOString(),
            durationMs: requestCompletedAt - requestStartedAt,
          }),
        }));
      }
    }
  });

  installIdentityHttpUpgradeBoundary({
    server,
    dispatchUpgrade: options.webSocket
      ? ({ request, socket }) => handleWebSocketUpgrade({
        request,
        socket,
        logger,
        backendApi: options.backendApi,
        auditLedgerBackendApi: options.auditLedgerBackendApi,
        systemRuntimeBackendApi: options.systemRuntimeBackendApi,
        secureTransport: options.secureTransport,
        transportTrust: options.transportTrust,
        webSocket: options.webSocket,
        channelRegistry,
      })
      : undefined,
    onUnhandledUpgradeError: ({ request, error }) => {
      const requestId = randomUUID();
      const correlationId = resolveRequestCorrelationId(request, requestId);
      logger.error(Object.freeze({
        event: "identity-websocket.upgrade.unhandled-error",
        requestId,
        correlationId,
        method: request.method,
        path: request.url,
        statusCode: 500,
        details: Object.freeze({
          error: normalizeError(error),
        }),
      }));
    },
  });

  return server;
}

async function handleWebSocketUpgrade(input: {
  readonly request: IncomingMessage;
  readonly socket: Socket;
  readonly logger: IdentityHttpServerLogger;
  readonly backendApi: IdentityAuthBackendApi;
  readonly auditLedgerBackendApi: AuditLedgerBackendApi | undefined;
  readonly systemRuntimeBackendApi: SystemRuntimeBackendApi | undefined;
  readonly secureTransport: IdentityHttpServerSecureTransportOptions | undefined;
  readonly transportTrust: IdentityHttpServerTransportTrustOptions | undefined;
  readonly webSocket: IdentityHttpServerWebSocketOptions;
  readonly channelRegistry: WebSocketChannelRegistry;
}): Promise<void> {
  const requestId = randomUUID();
  const correlationId = resolveRequestCorrelationId(input.request, requestId);
  const requestUrl = new URL(input.request.url ?? "/", "http://localhost");
  const path = requestUrl.pathname;
  const channelPathPrefix = normalizeOptionalString(input.webSocket.channelPathPrefix ?? "/ws") ?? "/ws";
  const transportState = resolveInboundHttpTransportConnectionState(input.request);

  if (!path.startsWith(channelPathPrefix)) {
    denyWebSocketUpgrade(input, requestId, correlationId, 404, {
      code: "invalid-upgrade-request",
      message: "WebSocket endpoint was not found.",
    });
    return;
  }

  const secureTransportDecision = enforceWebSocketSecureTransport({
    secureTransport: input.secureTransport,
    transportState,
  });
  if (!secureTransportDecision.ok) {
    denyWebSocketUpgrade(input, requestId, correlationId, secureTransportDecision.statusCode, secureTransportDecision.reason);
    return;
  }

  const handshake = validateWebSocketUpgradeRequestHeaders(input.request);
  if (!handshake.ok) {
    denyWebSocketUpgrade(input, requestId, correlationId, handshake.statusCode, handshake.reason);
    return;
  }

  const requestedSubprotocols = parseWebSocketSubprotocolHeader(input.request.headers["sec-websocket-protocol"]);
  const sessionToken = extractBearerSessionToken(input.request.headers.authorization)
    ?? extractWebSocketBearerTokenFromSubprotocols(requestedSubprotocols);
  if (!sessionToken) {
    denyWebSocketUpgrade(input, requestId, correlationId, 401, {
      code: "authentication-failed",
      closeCode: 4401,
      message: "Missing Authorization bearer token for websocket upgrade.",
    });
    return;
  }

  const resolvedSession = await input.backendApi.resolveAuthenticatedSession({ sessionToken });
  if (!resolvedSession.ok) {
    const statusCode = mapStatusCode(resolvedSession);
    denyWebSocketUpgrade(input, requestId, correlationId, statusCode, {
      code: "authentication-failed",
      closeCode: 4401,
      message: resolvedSession.error?.message ?? "WebSocket upgrade authentication failed.",
      details: Object.freeze({
        errorCode: resolvedSession.error?.code,
      }),
    });
    return;
  }
  if (!resolvedSession.data) {
    denyWebSocketUpgrade(input, requestId, correlationId, 500, {
      code: "authentication-failed",
      closeCode: 1011,
      message: "Session resolution returned no payload for websocket upgrade.",
    });
    return;
  }
  const accessChannel = resolvedSession.data.session.accessChannel === "desktop" ? "desktop" : "thin-client";
  const transportChannelContext = resolveTransportAccessChannelContext({
    accessChannel,
    request: input.request,
  });
  if (accessChannel === "thin-client") {
    const originPolicy = enforceThinClientWebSocketOrigin({
      request: input.request,
      transportState,
    });
    if (!originPolicy.accepted) {
      denyWebSocketUpgrade(input, requestId, correlationId, 403, {
        code: "origin-not-allowed",
        closeCode: 4403,
        message: "WebSocket origin is not allowed for thin-client sessions.",
        details: Object.freeze({
          reason: originPolicy.reason,
        }),
      });
      return;
    }
  }

  const supportedPurposes = input.webSocket.supportedPurposes
    ?? Object.freeze(Object.values(WebSocketChannelPurposes));
  const requestedPurpose = normalizeOptionalString(requestUrl.searchParams.get("purpose"));
  const parsedPurpose = parseWebSocketChannelPurpose(requestedPurpose);
  if (requestedPurpose && !parsedPurpose) {
    denyWebSocketUpgrade(input, requestId, correlationId, 403, {
      code: "unsupported-channel-purpose",
      closeCode: 4403,
      message: "WebSocket channel purpose is not supported.",
      details: Object.freeze({
        purpose: requestedPurpose,
      }),
    });
    return;
  }
  const purpose = parsedPurpose
    ?? input.webSocket.defaultPurpose
    ?? WebSocketChannelPurposes.status;
  if (!supportedPurposes.includes(purpose)) {
    denyWebSocketUpgrade(input, requestId, correlationId, 403, {
      code: "unsupported-channel-purpose",
      closeCode: 4403,
      message: "WebSocket channel purpose is not allowed.",
      details: Object.freeze({
        purpose,
      }),
    });
    return;
  }

  const defaultScenario = input.transportTrust?.defaultScenario ?? TransportSecurityScenarios.thinClientToControlPlane;
  const transportRouting = resolveTransportTrustRouting({
    resolvedSession: resolvedSession.data,
    options: undefined,
    defaultScenario,
  });
  const bypassTransportTrustValidation = Boolean(
    input.transportTrust && shouldBypassTransportTrustValidation(transportState, input.transportTrust, transportRouting),
  );
  if (input.transportTrust && !input.transportTrust.websocketValidator && !bypassTransportTrustValidation) {
    denyWebSocketUpgrade(input, requestId, correlationId, 500, {
      code: "transport-trust-rejected",
      closeCode: 1011,
      message: "WebSocket transport trust validation is not configured.",
    });
    return;
  }
  if (input.transportTrust?.websocketValidator && !bypassTransportTrustValidation) {
    const transportValidationRequest = buildWebSocketTransportTrustValidationRequest({
      transportState,
      requestId,
      resolvedSession: resolvedSession.data,
      routing: transportRouting,
    });
    const transportValidation = await input.transportTrust.websocketValidator.validate(transportValidationRequest);
    if (!transportValidation.ok) {
      denyWebSocketUpgrade(
        input,
        requestId,
        correlationId,
        mapWebSocketCloseCodeToStatusCode(transportValidation.closeCode),
        {
        code: "transport-trust-rejected",
        closeCode: transportValidation.closeCode,
        message: transportValidation.reason,
        details: Object.freeze({
          errorCode: transportValidation.error.code,
          reasons: transportValidation.error.reasons,
        }),
      },
      );
      return;
    }
  }

  const sessionAssuranceLevel = normalizeSessionAssuranceLevel(
    resolvedSession.data.session.deviceTrustContext?.sessionAssuranceLevel,
  );
  const connectionId = `identity-ws:${requestId}`;
  const channelContext = buildWebSocketChannelContext({
    connectionId,
    purpose,
    userIdentityId: resolvedSession.data.principal.userIdentityId,
    username: resolvedSession.data.principal.username,
    sessionId: resolvedSession.data.session.sessionId,
    accessChannel: transportChannelContext.accessChannel,
    trustedDeviceId: resolvedSession.data.session.deviceTrustContext?.trustedDeviceId,
    sessionAssuranceLevel,
    workspaceId: normalizeOptionalString(requestUrl.searchParams.get("workspaceId")),
    transport: Object.freeze({
      trustValidationEnforced: Boolean(input.transportTrust && !bypassTransportTrustValidation),
      scenario: transportRouting.scenario,
      actorType: transportRouting.actorType,
      remotePeerType: transportRouting.remotePeerType,
    }),
  });
  const initialCertificateBinding = toWebSocketChannelCertificateBinding({
    serialNumber: transportState.peerCertificateSerialNumber,
    fingerprintSha256: transportState.peerCertificateFingerprintSha256,
  });
  input.channelRegistry.register(channelContext);
  input.socket.once("close", () => {
    input.channelRegistry.release(channelContext.channelId);
  });

  input.socket.write(buildWebSocketUpgradeAcceptedResponse(
    handshake.websocketKey,
    requestId,
    correlationId,
    resolveAcceptedWebSocketSubprotocol(requestedSubprotocols),
  ));
  input.logger.info(Object.freeze({
    event: "identity-websocket.upgrade.accepted",
    requestId,
    correlationId,
    method: input.request.method,
    path,
    statusCode: 101,
    details: Object.freeze({
      channelId: channelContext.channelId,
      connectionId: channelContext.connectionId,
      purpose: channelContext.purpose,
      actor: Object.freeze({
        userIdentityId: channelContext.actor.userIdentityId,
        sessionId: channelContext.actor.sessionId,
        accessChannel: channelContext.actor.accessChannel,
      }),
      workspaceScope: channelContext.workspaceScope,
      transport: channelContext.transport,
    }),
  }));

  startWebSocketChannelLifecycleMonitoring({
    requestId,
    channelContext,
    socket: input.socket,
    logger: input.logger,
    backendApi: input.backendApi,
    transportTrust: input.transportTrust,
    transportState,
    transportRouting,
    sessionToken,
    lifecycleOptions: input.webSocket.lifecycle,
    channelRegistry: input.channelRegistry,
    initialCertificateBinding,
  });

  initializeRuntimeRealtimeWebSocketChannel({
    requestId,
    correlationId,
    logger: input.logger,
    socket: input.socket,
    channelContext,
    systemRuntimeBackendApi: input.systemRuntimeBackendApi,
    auditLedgerBackendApi: input.auditLedgerBackendApi,
  });

  await input.webSocket.onChannelEstablished?.(channelContext, input.socket);
}

interface RuntimeRealtimeWebSocketSessionState {
  subscription?: {
    readonly unsubscribe: () => void;
    readonly subscriptionId: string;
  };
  incomingBuffer: Buffer;
}

interface ParsedWebSocketFrame {
  readonly fin: boolean;
  readonly opcode: number;
  readonly payload: Buffer;
  readonly nextOffset: number;
  readonly masked: boolean;
}

function initializeRuntimeRealtimeWebSocketChannel(input: {
  readonly requestId: string;
  readonly correlationId: string;
  readonly logger: IdentityHttpServerLogger;
  readonly socket: Socket;
  readonly channelContext: WebSocketChannelContext;
  readonly systemRuntimeBackendApi: SystemRuntimeBackendApi | undefined;
  readonly auditLedgerBackendApi: AuditLedgerBackendApi | undefined;
}): void {
  if (!input.systemRuntimeBackendApi) {
    return;
  }

  const state: RuntimeRealtimeWebSocketSessionState = {
    subscription: undefined,
    incomingBuffer: Buffer.alloc(0),
  };

  const teardown = () => {
    state.subscription?.unsubscribe();
    state.subscription = undefined;
  };
  input.socket.once("close", teardown);
  input.socket.once("error", teardown);

  input.socket.on("data", (chunk) => {
    state.incomingBuffer = Buffer.concat([state.incomingBuffer, chunk]);
    let offset = 0;
    try {
      while (offset < state.incomingBuffer.length) {
        const frame = tryParseWebSocketFrame(state.incomingBuffer, offset);
        if (!frame) {
          break;
        }
        offset = frame.nextOffset;
        if (!frame.masked) {
          sendRuntimeRealtimeWebSocketError(input, "invalid-request", "Client frames must be masked.");
          sendWebSocketCloseFrame(input.socket, 1002, "Protocol error");
          return;
        }
        if (!frame.fin) {
          sendRuntimeRealtimeWebSocketError(input, "invalid-request", "Fragmented websocket frames are not supported.");
          sendWebSocketCloseFrame(input.socket, 4400, "invalid-request");
          return;
        }
        if (frame.opcode === 8) {
          sendWebSocketCloseFrame(input.socket, 1000, "normal-close");
          return;
        }
        if (frame.opcode === 9) {
          input.socket.write(buildWebSocketDataFrame(10, frame.payload));
          continue;
        }
        if (frame.opcode !== 1) {
          sendRuntimeRealtimeWebSocketError(input, "invalid-request", "Only text websocket frames are supported.");
          sendWebSocketCloseFrame(input.socket, 4400, "invalid-request");
          return;
        }

        const payloadText = frame.payload.toString("utf8");
        void handleRuntimeRealtimeWebSocketTextFrame({
          requestId: input.requestId,
          correlationId: input.correlationId,
          logger: input.logger,
          socket: input.socket,
          channelContext: input.channelContext,
          runtimeBackendApi: input.systemRuntimeBackendApi,
          auditLedgerBackendApi: input.auditLedgerBackendApi,
          state,
          payloadText,
        });
      }
    } catch {
      sendRuntimeRealtimeWebSocketError(input, "invalid-request", "Websocket frame parsing failed.");
      sendWebSocketCloseFrame(input.socket, 4400, "invalid-request");
      return;
    }

    state.incomingBuffer = offset >= state.incomingBuffer.length
      ? Buffer.alloc(0)
      : state.incomingBuffer.subarray(offset);
  });
}

async function handleRuntimeRealtimeWebSocketTextFrame(input: {
  readonly requestId: string;
  readonly correlationId: string;
  readonly logger: IdentityHttpServerLogger;
  readonly socket: Socket;
  readonly channelContext: WebSocketChannelContext;
  readonly runtimeBackendApi: SystemRuntimeBackendApi;
  readonly auditLedgerBackendApi: AuditLedgerBackendApi | undefined;
  readonly state: RuntimeRealtimeWebSocketSessionState;
  readonly payloadText: string;
}): Promise<void> {
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(input.payloadText);
  } catch {
    sendRuntimeRealtimeWebSocketError(input, "invalid-request", "Websocket payload must be valid JSON.");
    sendWebSocketCloseFrame(input.socket, 4400, "invalid-request");
    return;
  }

  let subscribeMessage;
  try {
    subscribeMessage = parseRuntimeRealtimeWebSocketSubscribeMessage(parsedPayload);
  } catch (error) {
    const message = error instanceof RuntimeRealtimeSchemaValidationError
      ? error.message
      : "Realtime subscription payload is invalid.";
    sendRuntimeRealtimeWebSocketError(input, "invalid-request", message);
    sendWebSocketCloseFrame(input.socket, 4400, "invalid-request");
    return;
  }

  if (subscribeMessage.action !== RuntimeRealtimeWebSocketActions.subscribe) {
    sendRuntimeRealtimeWebSocketError(input, "invalid-request", "Unsupported realtime websocket action.");
    sendWebSocketCloseFrame(input.socket, 4400, "invalid-request");
    return;
  }

  const actorWorkspaceId = input.channelContext.workspaceScope.workspaceId?.trim();
  const hasDisallowedTopic = subscribeMessage.request.topics.some(
    (topic) => !isRuntimeRealtimeTopicAllowedForPurpose(topic.topic, input.channelContext.purpose),
  );
  if (hasDisallowedTopic) {
    sendRuntimeRealtimeWebSocketError(
      input,
      "forbidden",
      `One or more realtime topics are not allowed for websocket purpose '${input.channelContext.purpose}'.`,
    );
    sendWebSocketCloseFrame(input.socket, 4403, "forbidden");
    return;
  }
  const requestedTopics: RuntimeRealtimeSubscriptionTopic[] = subscribeMessage.request.topics.map((topic) => Object.freeze({
    topic: topic.topic,
    workspaceId: topic.workspaceId ?? actorWorkspaceId,
    executionId: topic.executionId,
  }));

  if (requestedTopics.length < 1) {
    sendRuntimeRealtimeWebSocketError(
      input,
      "forbidden",
      `No requested realtime topics are allowed for websocket purpose '${input.channelContext.purpose}'.`,
    );
    sendWebSocketCloseFrame(input.socket, 4403, "forbidden");
    return;
  }

  const workspaceMismatch = requestedTopics.some((topic) => {
    const topicWorkspaceId = topic.workspaceId?.trim();
    return Boolean(actorWorkspaceId && topicWorkspaceId && actorWorkspaceId !== topicWorkspaceId);
  });
  if (workspaceMismatch) {
    sendRuntimeRealtimeWebSocketError(input, "forbidden", "Topic workspace scope must match websocket workspace scope.");
    sendWebSocketCloseFrame(input.socket, 4403, "forbidden");
    return;
  }

  const requestedAuditGovernanceTopic = requestedTopics.some(
    (topic) => topic.topic === RuntimeRealtimeTopics.auditGovernance,
  );
  if (requestedAuditGovernanceTopic) {
    if (!input.auditLedgerBackendApi || !actorWorkspaceId) {
      sendRuntimeRealtimeWebSocketError(
        input,
        "forbidden",
        "Audit/governance realtime subscriptions require workspace-scoped audit ledger access.",
      );
      sendWebSocketCloseFrame(input.socket, 4403, "forbidden");
      return;
    }
    const authorizationProbe = await input.auditLedgerBackendApi.listGovernanceAuditEvents({
      actorUserIdentityId: input.channelContext.actor.userIdentityId,
      workspaceId: actorWorkspaceId,
      query: Object.freeze({
        pagination: Object.freeze({
          limit: 1,
          offset: 0,
        }),
      }),
    });
    if (!authorizationProbe.ok) {
      sendRuntimeRealtimeWebSocketError(
        input,
        "forbidden",
        "Audit/governance realtime subscription is not authorized for this actor/workspace.",
      );
      sendWebSocketCloseFrame(input.socket, 4403, "forbidden");
      return;
    }
  }

  const subscriptionRequest: RuntimeRealtimeSubscriptionRequest = Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: input.channelContext.actor.userIdentityId,
      accessChannel: input.channelContext.actor.accessChannel,
      sessionId: input.channelContext.actor.sessionId,
      workspaceId: actorWorkspaceId,
    }),
    topics: Object.freeze(requestedTopics),
    mode: subscribeMessage.request.mode ?? RuntimeRealtimeSubscriptionModes.liveOnly,
    reconnect: subscribeMessage.request.reconnect,
  });

  const subscription = input.runtimeBackendApi.subscribeToRealtimeEvents({
    request: subscriptionRequest,
    requestContext: Object.freeze({
      requestSource: "identity-websocket-runtime-realtime",
      accessContext: Object.freeze({
        callerKind: "user" as const,
        callerId: input.channelContext.actor.userIdentityId,
        sessionId: input.channelContext.actor.sessionId,
        metadata: Object.freeze({
          workspaceId: actorWorkspaceId,
          activeWorkspaceId: actorWorkspaceId,
          accessChannel: input.channelContext.actor.accessChannel,
        }),
      }),
    }),
    listener: (event) => {
      if (input.socket.destroyed) {
        return;
      }
      const eventMessage = Object.freeze({
        type: RuntimeRealtimeWebSocketMessageTypes.event,
        event,
      });
      input.socket.write(buildWebSocketTextFrame(JSON.stringify(eventMessage)));
    },
  });

  if (!subscription.ok || !subscription.data) {
    const mappedCode = mapRuntimeRealtimeErrorCode(subscription.error?.code);
    const message = subscription.error?.message ?? "Realtime subscription failed.";
    sendRuntimeRealtimeWebSocketError(input, mappedCode, message);
    sendWebSocketCloseFrame(input.socket, mappedCode === "forbidden" ? 4403 : 4400, mappedCode);
    return;
  }

  input.state.subscription?.unsubscribe();
  input.state.subscription = Object.freeze({
    subscriptionId: subscription.data.subscriptionId,
    unsubscribe: subscription.data.unsubscribe,
  });

  const ackMessage = parseRuntimeRealtimeWebSocketSubscriptionAckMessage({
    type: RuntimeRealtimeWebSocketMessageTypes.subscriptionAck,
    subscriptionId: subscription.data.subscriptionId,
    acceptedAt: new Date().toISOString(),
    mode: subscriptionRequest.mode ?? RuntimeRealtimeSubscriptionModes.liveOnly,
    topics: requestedTopics,
    reconnect: subscriptionRequest.reconnect,
  });
  input.socket.write(buildWebSocketTextFrame(JSON.stringify(ackMessage)));
  input.logger.info(Object.freeze({
    event: "identity-websocket.runtime-realtime.subscription.accepted",
    requestId: input.requestId,
    correlationId: input.correlationId,
    statusCode: 101,
    details: Object.freeze({
      channelId: input.channelContext.channelId,
      purpose: input.channelContext.purpose,
      subscriptionId: subscription.data.subscriptionId,
      topics: requestedTopics,
      mode: subscriptionRequest.mode ?? RuntimeRealtimeSubscriptionModes.liveOnly,
    }),
  }));
}

function mapRuntimeRealtimeErrorCode(
  code: "not-found" | "invalid-request" | "forbidden" | "unauthorized" | "quota-exceeded" | "rate-limit-exceeded" | "internal" | undefined,
): "invalid-request" | "forbidden" | "internal" {
  if (code === "forbidden" || code === "unauthorized") {
    return "forbidden";
  }
  if (code === "invalid-request" || code === "not-found" || code === "quota-exceeded" || code === "rate-limit-exceeded") {
    return "invalid-request";
  }
  return "internal";
}

function isRuntimeRealtimeTopicAllowedForPurpose(
  topic: RuntimeRealtimeSubscriptionTopic["topic"],
  purpose: WebSocketChannelPurpose,
): boolean {
  switch (purpose) {
    case WebSocketChannelPurposes.status:
      return topic === RuntimeRealtimeTopics.connectivity;
    case WebSocketChannelPurposes.queueMonitoring:
      return topic === RuntimeRealtimeTopics.queue || topic === RuntimeRealtimeTopics.runStatus || topic === RuntimeRealtimeTopics.connectivity;
    case WebSocketChannelPurposes.runMonitoring:
      return topic === RuntimeRealtimeTopics.runStatus || topic === RuntimeRealtimeTopics.queue || topic === RuntimeRealtimeTopics.connectivity;
    case WebSocketChannelPurposes.streamControl:
      return topic === RuntimeRealtimeTopics.admin
        || topic === RuntimeRealtimeTopics.connectivity
        || topic === RuntimeRealtimeTopics.auditGovernance;
    default:
      return false;
  }
}

function sendRuntimeRealtimeWebSocketError(
  input: {
    readonly socket: Socket;
    readonly logger: IdentityHttpServerLogger;
    readonly requestId: string;
    readonly correlationId: string;
    readonly channelContext: WebSocketChannelContext;
  },
  code: "invalid-request" | "forbidden" | "internal",
  message: string,
): void {
  if (input.socket.destroyed) {
    return;
  }
  const normalizedEnvelope = normalizeSharedApiErrorEnvelope(Object.freeze({
    ok: false,
    error: Object.freeze({
      code,
      message: redactSensitiveText(message.trim() || "Realtime websocket operation failed."),
    }),
  })) as { readonly error?: { readonly message?: string } };
  const safeMessage = normalizedEnvelope.error?.message ?? "Realtime websocket operation failed.";
  const payload = Object.freeze({
    type: RuntimeRealtimeWebSocketMessageTypes.error,
    error: Object.freeze({
      code,
      message: safeMessage,
      correlationId: input.correlationId,
    }),
  });
  input.logger.warn(Object.freeze({
    event: "identity-websocket.runtime-realtime.error",
    requestId: input.requestId,
    correlationId: input.correlationId,
    statusCode: code === "forbidden" ? 403 : (code === "internal" ? 500 : 400),
    details: Object.freeze({
      channelId: input.channelContext.channelId,
      purpose: input.channelContext.purpose,
      code,
      message: safeMessage,
    }),
  }));
  input.socket.write(buildWebSocketTextFrame(JSON.stringify(payload)));
}

function sendWebSocketCloseFrame(socket: Socket, closeCode: number, reason: string): void {
  if (socket.destroyed) {
    return;
  }
  const normalizedReason = reason.trim().slice(0, 120);
  const reasonBytes = Buffer.from(normalizedReason, "utf8");
  const payload = Buffer.alloc(2 + reasonBytes.length);
  payload.writeUInt16BE(closeCode, 0);
  reasonBytes.copy(payload, 2);
  socket.write(buildWebSocketDataFrame(8, payload));
  socket.end();
}

function buildWebSocketTextFrame(payload: string): Buffer {
  return buildWebSocketDataFrame(1, Buffer.from(payload, "utf8"));
}

function buildWebSocketDataFrame(opcode: number, payload: Buffer): Buffer {
  const payloadLength = payload.length;
  if (payloadLength <= 125) {
    const frame = Buffer.alloc(2 + payloadLength);
    frame[0] = 0x80 | (opcode & 0x0f);
    frame[1] = payloadLength;
    payload.copy(frame, 2);
    return frame;
  }
  if (payloadLength <= 65535) {
    const frame = Buffer.alloc(4 + payloadLength);
    frame[0] = 0x80 | (opcode & 0x0f);
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payload.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.alloc(10 + payloadLength);
  frame[0] = 0x80 | (opcode & 0x0f);
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(payloadLength), 2);
  payload.copy(frame, 10);
  return frame;
}

function tryParseWebSocketFrame(buffer: Buffer, offset: number): ParsedWebSocketFrame | undefined {
  if (buffer.length - offset < 2) {
    return undefined;
  }
  const first = buffer[offset];
  const second = buffer[offset + 1];
  const fin = (first & 0x80) === 0x80;
  const opcode = first & 0x0f;
  const masked = (second & 0x80) === 0x80;
  let payloadLength = second & 0x7f;
  let cursor = offset + 2;

  if (payloadLength === 126) {
    if (buffer.length - cursor < 2) {
      return undefined;
    }
    payloadLength = buffer.readUInt16BE(cursor);
    cursor += 2;
  } else if (payloadLength === 127) {
    if (buffer.length - cursor < 8) {
      return undefined;
    }
    const bigLength = buffer.readBigUInt64BE(cursor);
    cursor += 8;
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("WebSocket frame payload exceeds safe integer range.");
    }
    payloadLength = Number(bigLength);
  }

  const maskLength = masked ? 4 : 0;
  if (buffer.length - cursor < maskLength + payloadLength) {
    return undefined;
  }

  const mask = masked ? buffer.subarray(cursor, cursor + 4) : undefined;
  cursor += maskLength;
  const payload = Buffer.from(buffer.subarray(cursor, cursor + payloadLength));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] = payload[index] ^ mask[index % 4];
    }
  }
  cursor += payloadLength;

  return Object.freeze({
    fin,
    opcode,
    payload,
    nextOffset: cursor,
    masked,
  });
}

function startWebSocketChannelLifecycleMonitoring(input: {
  readonly requestId: string;
  readonly channelContext: WebSocketChannelContext;
  readonly socket: Socket;
  readonly logger: IdentityHttpServerLogger;
  readonly backendApi: IdentityAuthBackendApi;
  readonly transportTrust: IdentityHttpServerTransportTrustOptions | undefined;
  readonly transportState: InboundHttpTransportConnectionState;
  readonly transportRouting: ReturnType<typeof resolveTransportTrustRouting>;
  readonly sessionToken: string;
  readonly lifecycleOptions: IdentityHttpServerWebSocketLifecycleOptions | undefined;
  readonly channelRegistry: WebSocketChannelRegistry;
  readonly initialCertificateBinding: WebSocketChannelCertificateBinding | undefined;
}): void {
  const intervalMs = resolveWebSocketTrustRevalidationIntervalMs(input.lifecycleOptions, input.channelContext.transport.trustValidationEnforced);
  if (!intervalMs) {
    return;
  }

  let closed = false;
  let currentState: WebSocketChannelLifecycleState = WebSocketChannelLifecycleStates.active;
  let reconnectAttempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const baselineCertificateBinding =
    input.initialCertificateBinding
    ?? input.lifecycleOptions?.resolveCertificateBinding?.(input.channelContext, input.socket)
    ?? resolveSocketPeerCertificateBinding(input.socket);

  const scheduleNext = () => {
    if (closed) {
      return;
    }
    timer = setTimeout(() => {
      void revalidate();
    }, intervalMs);
  };

  const finalize = (reason: WebSocketChannelLifecycleInvalidationReason, reconnect: WebSocketChannelReconnectDirective) => {
    if (closed) {
      return;
    }
    transition(WebSocketChannelLifecycleStates.invalidated, reason, reconnect);
    input.channelRegistry.release(input.channelContext.channelId);
    input.socket.end();
  };

  const transition = (
    next: WebSocketChannelLifecycleState,
    reason?: WebSocketChannelLifecycleInvalidationReason,
    reconnect?: WebSocketChannelReconnectDirective,
    details?: Readonly<Record<string, unknown>>,
  ) => {
    if (!canTransitionWebSocketChannelLifecycleState(currentState, next)) {
      return;
    }
    currentState = next;
    emitWebSocketLifecycleEvent({
      requestId: input.requestId,
      logger: input.logger,
      lifecycleOptions: input.lifecycleOptions,
      channelContext: input.channelContext,
      state: next,
      reason,
      reconnect,
      details,
    });
  };

  const revalidate = async () => {
    if (closed) {
      return;
    }
    transition(WebSocketChannelLifecycleStates.revalidating);

    let resolvedSession: Awaited<ReturnType<IdentityAuthBackendApi["resolveAuthenticatedSession"]>> | undefined;
    try {
      resolvedSession = await input.backendApi.resolveAuthenticatedSession({
        sessionToken: input.sessionToken,
      });
    } catch {
      reconnectAttempt += 1;
      const reconnect = resolveWebSocketChannelReconnectDirective({
        attempt: reconnectAttempt,
        reason: WebSocketChannelLifecycleInvalidationReasons.transientRevalidationFailure,
        policy: input.lifecycleOptions?.reconnectPolicy,
      });
      transition(WebSocketChannelLifecycleStates.reconnectPending, WebSocketChannelLifecycleInvalidationReasons.transientRevalidationFailure, reconnect);
      finalize(WebSocketChannelLifecycleInvalidationReasons.transientRevalidationFailure, reconnect);
      return;
    }

    if (!resolvedSession.ok || !resolvedSession.data) {
      reconnectAttempt += 1;
      const reason = (
        resolvedSession.error?.code === IdentityAuthApiErrorCodes.authenticationFailed
        || resolvedSession.error?.code === IdentityAuthApiErrorCodes.forbidden
        || resolvedSession.error?.code === IdentityAuthApiErrorCodes.notFound
      )
        ? WebSocketChannelLifecycleInvalidationReasons.revoked
        : WebSocketChannelLifecycleInvalidationReasons.trustInvalidated;
      const reconnect = resolveWebSocketChannelReconnectDirective({
        attempt: reconnectAttempt,
        reason,
        policy: input.lifecycleOptions?.reconnectPolicy,
      });
      transition(WebSocketChannelLifecycleStates.reconnectPending, reason, reconnect, Object.freeze({
        errorCode: resolvedSession.error?.code,
      }));
      finalize(reason, reconnect);
      return;
    }

    if (input.transportTrust?.websocketValidator && input.channelContext.transport.trustValidationEnforced) {
      const validation = await input.transportTrust.websocketValidator.validate(
        buildWebSocketTransportTrustValidationRequest({
          transportState: input.transportState,
          requestId: input.requestId,
          resolvedSession: resolvedSession.data,
          routing: input.transportRouting,
        }),
      );
      if (!validation.ok) {
        reconnectAttempt += 1;
        const reason = validation.closeCode === 4403
          ? WebSocketChannelLifecycleInvalidationReasons.trustInvalidated
          : WebSocketChannelLifecycleInvalidationReasons.transientRevalidationFailure;
        const reconnect = resolveWebSocketChannelReconnectDirective({
          attempt: reconnectAttempt,
          reason,
          policy: input.lifecycleOptions?.reconnectPolicy,
        });
        transition(WebSocketChannelLifecycleStates.reconnectPending, reason, reconnect, Object.freeze({
          closeCode: validation.closeCode,
          errorCode: validation.error.code,
        }));
        finalize(reason, reconnect);
        return;
      }
    }

    const currentCertificateBinding = input.lifecycleOptions?.resolveCertificateBinding?.(input.channelContext, input.socket)
      ?? resolveSocketPeerCertificateBinding(input.socket);
    if (hasWebSocketChannelCertificateBindingRotated(baselineCertificateBinding, currentCertificateBinding)) {
      reconnectAttempt += 1;
      const reconnect = resolveWebSocketChannelReconnectDirective({
        attempt: reconnectAttempt,
        reason: WebSocketChannelLifecycleInvalidationReasons.certificateRotated,
        policy: input.lifecycleOptions?.reconnectPolicy,
      });
      transition(
        WebSocketChannelLifecycleStates.reconnectPending,
        WebSocketChannelLifecycleInvalidationReasons.certificateRotated,
        reconnect,
      );
      finalize(WebSocketChannelLifecycleInvalidationReasons.certificateRotated, reconnect);
      return;
    }

    reconnectAttempt = 0;
    transition(WebSocketChannelLifecycleStates.active);
    scheduleNext();
  };

  input.socket.once("close", () => {
    if (closed) {
      return;
    }
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    transition(WebSocketChannelLifecycleStates.closed, WebSocketChannelLifecycleInvalidationReasons.closedByPeer);
  });

  scheduleNext();
}

function resolveWebSocketTrustRevalidationIntervalMs(
  lifecycleOptions: IdentityHttpServerWebSocketLifecycleOptions | undefined,
  trustValidationEnforced: boolean,
): number | undefined {
  if (!trustValidationEnforced) {
    return undefined;
  }
  const configured = lifecycleOptions?.trustRevalidationIntervalMs;
  if (configured === undefined) {
    return DefaultWebSocketTrustRevalidationIntervalMs;
  }
  if (!Number.isFinite(configured) || configured < 10) {
    return undefined;
  }
  return Math.floor(configured);
}

function resolveSocketPeerCertificateBinding(socket: Socket): WebSocketChannelCertificateBinding | undefined {
  const candidate = socket as Socket & {
    getPeerCertificate?: () => {
      readonly serialNumber?: string;
      readonly fingerprint256?: string;
    };
  };
  if (typeof candidate.getPeerCertificate !== "function") {
    return undefined;
  }

  try {
    const peerCertificate = candidate.getPeerCertificate();
    return toWebSocketChannelCertificateBinding({
      serialNumber: peerCertificate?.serialNumber,
      fingerprintSha256: peerCertificate?.fingerprint256,
    });
  } catch {
    return undefined;
  }
}

function emitWebSocketLifecycleEvent(input: {
  readonly requestId: string;
  readonly logger: IdentityHttpServerLogger;
  readonly lifecycleOptions: IdentityHttpServerWebSocketLifecycleOptions | undefined;
  readonly channelContext: WebSocketChannelContext;
  readonly state: WebSocketChannelLifecycleState;
  readonly reason?: WebSocketChannelLifecycleInvalidationReason;
  readonly reconnect?: WebSocketChannelReconnectDirective;
  readonly details?: Readonly<Record<string, unknown>>;
}): void {
  const event: IdentityHttpServerWebSocketLifecycleEvent = Object.freeze({
    channelId: input.channelContext.channelId,
    connectionId: input.channelContext.connectionId,
    state: input.state,
    occurredAt: new Date().toISOString(),
    reason: input.reason,
    reconnect: input.reconnect,
    details: input.details,
  });

  const logEvent: IdentityHttpServerLogEvent = Object.freeze({
    event: "identity-websocket.channel.lifecycle",
    requestId: input.requestId,
    statusCode: input.state === WebSocketChannelLifecycleStates.invalidated ? 4403 : 101,
    details: Object.freeze({
      channelId: event.channelId,
      connectionId: event.connectionId,
      state: event.state,
      reason: event.reason,
      reconnect: event.reconnect,
      ...(event.details ?? {}),
    }),
  });

  if (
    input.state === WebSocketChannelLifecycleStates.invalidated
    || input.state === WebSocketChannelLifecycleStates.reconnectPending
  ) {
    input.logger.warn(logEvent);
  } else {
    input.logger.info(logEvent);
  }
  void input.lifecycleOptions?.onLifecycleEvent?.(event);
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
  transportTrust: IdentityHttpServerTransportTrustOptions | undefined,
  options: {
    readonly sessionAssuranceRequirement?: SessionAssuranceRequirement;
    readonly transportScenario?: TransportSecurityScenario;
    readonly transportActorType?: TransportConnectionActorType;
    readonly transportRemotePeerType?: TransportPeerType;
    readonly nodeId?: string;
  } | undefined,
  onAuthenticated: (context: AuthenticatedRequestContext) => Promise<void>,
): Promise<void> {
  const sessionResolution = await resolveAuthenticatedSessionFromRequest(request, backendApi, {
    mapStatusCode,
  });
  if (!sessionResolution.ok) {
    writeJson(response, sessionResolution.statusCode, sessionResolution.body);
    logResponse(
      logger,
      requestId,
      request,
      sessionResolution.statusCode,
      sessionResolution.requestLogPayload,
      sessionResolution.body,
    );
    return;
  }
  const { resolvedSession, sessionToken } = sessionResolution;

  const sessionAssuranceLevel = normalizeSessionAssuranceLevel(resolvedSession.session.deviceTrustContext?.sessionAssuranceLevel);
  const sessionAssuranceEnforcement = enforceTrustedSessionAssurance({
    sessionAssuranceLevel,
    requirement: options?.sessionAssuranceRequirement,
    buildForbiddenResponse: buildForbiddenResponse,
  });
  if (!sessionAssuranceEnforcement.ok) {
    writeJson(
      response,
      sessionAssuranceEnforcement.failure.statusCode,
      sessionAssuranceEnforcement.failure.body,
    );
    logResponse(
      logger,
      requestId,
      request,
      sessionAssuranceEnforcement.failure.statusCode,
      Object.freeze({
        sessionToken,
        ...sessionAssuranceEnforcement.failure.requestLogPayload,
      }),
      sessionAssuranceEnforcement.failure.body,
    );
    return;
  }

  const transportState = resolveInboundHttpTransportConnectionState(request);
  const defaultScenario = transportTrust?.defaultScenario ?? TransportSecurityScenarios.thinClientToControlPlane;
  const transportRouting = resolveTransportTrustRouting({
    resolvedSession,
    options,
    defaultScenario,
  });
  const bypassTransportTrustValidation = Boolean(
    transportTrust && shouldBypassTransportTrustValidation(transportState, transportTrust, transportRouting),
  );
  if (transportTrust && !bypassTransportTrustValidation) {
    const transportValidationRequest = buildTransportTrustValidationRequest({
      transportState,
      requestId,
      resolvedSession,
      routing: transportRouting,
      nodeId: options?.nodeId,
    });
    const transportValidation = await transportTrust.httpValidator.validate(transportValidationRequest);
    if (!transportValidation.ok) {
      writeJson(response, transportValidation.statusCode, transportValidation.body);
      logResponse(
        logger,
        requestId,
        request,
        transportValidation.statusCode,
        Object.freeze({
          connectionId: transportValidationRequest.connectionId,
          scenario: transportValidationRequest.scenario,
          channelType: transportValidationRequest.channelType,
          actorType: transportValidationRequest.actorType,
          localPeerType: transportValidationRequest.localPeerType,
          remotePeerType: transportValidationRequest.remotePeerType,
        }),
        transportValidation.body,
      );
      return;
    }
  }

  await onAuthenticated(buildAuthenticatedSessionActorContext({
    resolvedSession,
    sessionToken,
    sessionAssuranceLevel,
    transport: Object.freeze({
      connection: transportState,
      channel: resolveTransportAccessChannelContext({
        accessChannel: resolvedSession.session.accessChannel === "desktop" ? "desktop" : "thin-client",
        request,
      }),
      trustValidation: Object.freeze({
        enforced: Boolean(transportTrust && !bypassTransportTrustValidation),
        scenario: transportRouting.scenario,
        actorType: transportRouting.actorType,
        remotePeerType: transportRouting.remotePeerType,
      }),
    }),
  }));
}

async function requireAuthenticatedWorkspaceSession(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  backendApi: IdentityAuthBackendApi,
  logger: IdentityHttpServerLogger,
  transportTrust: IdentityHttpServerTransportTrustOptions | undefined,
  options: RequireAuthenticatedWorkspaceSessionOptions,
  onAuthenticated: (context: AuthenticatedWorkspaceRequestContext) => Promise<void>,
): Promise<void> {
  await requireAuthenticatedSession(
    request,
    response,
    requestId,
    backendApi,
    logger,
    transportTrust,
    options.sessionOptions,
    async (context) => {
      const workspaceResolution = resolveWorkspaceContextFromRequest(request, options);
      if (!workspaceResolution.ok) {
        writeJson(response, workspaceResolution.statusCode, workspaceResolution.body);
        logResponse(logger, requestId, request, workspaceResolution.statusCode, Object.freeze({
          actorUserIdentityId: context.actor.userIdentityId,
        }), workspaceResolution.body);
        return;
      }

      await onAuthenticated(Object.freeze({
        ...context,
        workspace: workspaceResolution.workspace,
      }));
    },
  );
}

async function requireAuthenticatedNodeTransport(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  backendApi: IdentityAuthBackendApi,
  nodeTrustBackendApi: NodeTrustBackendApi,
  logger: IdentityHttpServerLogger,
  transportTrust: IdentityHttpServerTransportTrustOptions | undefined,
  nodeId: string | undefined,
  onAuthenticated: (context: AuthenticatedNodeTransportContext) => Promise<void>,
): Promise<void> {
  const requiredNodeId = resolveRequiredNodeRouteNodeId({
    nodeId,
    buildInvalidResponse: buildNodeTrustInvalidRequestResponse,
  });
  if (!requiredNodeId.ok) {
    writeJson(response, requiredNodeId.statusCode, requiredNodeId.body);
    logResponse(logger, requestId, request, requiredNodeId.statusCode, requiredNodeId.requestLogPayload, requiredNodeId.body);
    return;
  }

  const resolvedNodeId = requiredNodeId.nodeId;

  if (!transportTrust) {
    await requireAuthenticatedSession(
      request,
      response,
      requestId,
      backendApi,
      logger,
      transportTrust,
      {
        transportScenario: TransportSecurityScenarios.nodeToControlPlane,
        transportActorType: TransportConnectionActorTypes.nodeIdentity,
        transportRemotePeerType: TransportPeerTypes.nodeRuntime,
        nodeId: resolvedNodeId,
      },
      async (context) => {
        const principalAuthorization = authorizeSessionNodeRoutePrincipal({
          nodeId: resolvedNodeId,
          context,
          buildForbiddenResponse: buildNodeTrustForbiddenResponse,
        });
        if (!principalAuthorization.ok) {
          writeJson(response, principalAuthorization.statusCode, principalAuthorization.body);
          logResponse(
            logger,
            requestId,
            request,
            principalAuthorization.statusCode,
            principalAuthorization.requestLogPayload,
            principalAuthorization.body,
          );
          return;
        }

        await onAuthenticated(buildSessionNodeRouteTransportContext({
          nodeId: resolvedNodeId,
          context,
        }));
      },
    );
    return;
  }

  const transportState = resolveInboundHttpTransportConnectionState(request);
  const mutualTlsValidation = await validateNodeMutualTlsTransport({
    requestId,
    nodeId: resolvedNodeId,
    transportState,
    ports: Object.freeze({
      trustValidator: transportTrust.httpValidator,
      nodeIdentityResolver: nodeTrustBackendApi,
    }),
  });
  const mutualTlsResolution = resolveMutualTlsNodeRouteTransportContext({
    nodeId: resolvedNodeId,
    transportState,
    validation: mutualTlsValidation,
  });
  if (!mutualTlsResolution.ok) {
    writeJson(response, mutualTlsResolution.statusCode, mutualTlsResolution.body);
    logResponse(
      logger,
      requestId,
      request,
      mutualTlsResolution.statusCode,
      mutualTlsResolution.requestLogPayload,
      mutualTlsResolution.body,
    );
    return;
  }

  await onAuthenticated(mutualTlsResolution.context);
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

async function handleDevLogin(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  backendApi: IdentityAuthBackendApi,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<void> {
  const handlerStartedAt = Date.now();
  logger.info(Object.freeze({
    event: "identity-auth.dev-login.flow.started",
    requestId,
    details: Object.freeze({
      startedAt: new Date(handlerStartedAt).toISOString(),
    }),
  }));
  const parsedRequest = await parseAndValidateRequest(
    request,
    DevLoginRequestSchema,
    requestId,
    logger,
    maxBodyBytes,
  );
  if (!parsedRequest.ok) {
    writeJson(response, parsedRequest.statusCode, parsedRequest.body);
    logger.warn(Object.freeze({
      event: "identity-auth.dev-login.flow.failed",
      requestId,
      statusCode: parsedRequest.statusCode,
      details: Object.freeze({
        stage: "request-validation",
        totalDurationMs: Date.now() - handlerStartedAt,
      }),
    }));
    return;
  }

  const registerStartedAt = Date.now();
  const registerResponse = await backendApi.registerLocalAccount({
    username: DEV_LOGIN_DEFAULT_USERNAME,
    providerId: DEV_LOGIN_DEFAULT_PROVIDER_ID,
    providerSubject: DEV_LOGIN_DEFAULT_USERNAME,
    credential: {
      candidate: DEV_LOGIN_DEFAULT_PASSWORD,
    },
  });
  const registerDurationMs = Date.now() - registerStartedAt;
  logger.info(Object.freeze({
    event: "identity-auth.dev-login.register.completed",
    requestId,
    statusCode: mapStatusCode(registerResponse),
    details: Object.freeze({
      ok: registerResponse.ok,
      errorCode: registerResponse.error?.code,
      durationMs: registerDurationMs,
    }),
  }));

  if (!registerResponse.ok && registerResponse.error?.code !== IdentityAuthApiErrorCodes.conflict) {
    const statusCode = mapStatusCode(registerResponse);
    writeJson(response, statusCode, registerResponse);
    logResponse(logger, requestId, request, statusCode, Object.freeze({
      providerSubject: DEV_LOGIN_DEFAULT_USERNAME,
    }), registerResponse);
    logger.warn(Object.freeze({
      event: "identity-auth.dev-login.flow.failed",
      requestId,
      statusCode,
      details: Object.freeze({
        stage: "register-local-account",
        errorCode: registerResponse.error?.code,
        totalDurationMs: Date.now() - handlerStartedAt,
      }),
    }));
    return;
  }

  const loginStartedAt = Date.now();
  const loginResponse = await backendApi.loginLocalAccount({
    providerId: DEV_LOGIN_DEFAULT_PROVIDER_ID,
    providerSubject: DEV_LOGIN_DEFAULT_USERNAME,
    accessChannel: parsedRequest.data.accessChannel,
    sessionTrustRequirement: parsedRequest.data.sessionTrustRequirement,
    client: parsedRequest.data.client,
    credential: {
      candidate: DEV_LOGIN_DEFAULT_PASSWORD,
    },
  });
  const loginDurationMs = Date.now() - loginStartedAt;
  const statusCode = mapStatusCode(loginResponse);
  writeJson(response, statusCode, loginResponse);
  logResponse(logger, requestId, request, statusCode, Object.freeze({
    providerSubject: DEV_LOGIN_DEFAULT_USERNAME,
  }), loginResponse);
  logger.info(Object.freeze({
    event: "identity-auth.dev-login.login.completed",
    requestId,
    statusCode,
    details: Object.freeze({
      ok: loginResponse.ok,
      errorCode: loginResponse.error?.code,
      durationMs: loginDurationMs,
    }),
  }));
  logger.info(Object.freeze({
    event: "identity-auth.dev-login.flow.completed",
    requestId,
    statusCode,
    details: Object.freeze({
      outcome: loginResponse.ok ? "success" : "failure",
      totalDurationMs: Date.now() - handlerStartedAt,
      registerDurationMs,
      loginDurationMs,
    }),
  }));
}

function shouldBypassTransportTrustValidation(
  transportState: InboundHttpTransportConnectionState,
  transportTrust: IdentityHttpServerTransportTrustOptions,
  routing: {
    readonly scenario: TransportSecurityScenario;
  },
): boolean {
  if (!transportTrust.allowInsecureLoopback) {
    return false;
  }
  if (routing.scenario !== TransportSecurityScenarios.desktopClientToControlPlane) {
    return false;
  }
  if (transportState.encryptedTransportEstablished) {
    return false;
  }
  return transportState.loopbackRequest;
}

function buildTransportTrustValidationRequest(input: {
  readonly transportState: InboundHttpTransportConnectionState;
  readonly requestId: string;
  readonly resolvedSession: ResolveAuthenticatedSessionApiResponse;
  readonly routing: {
    readonly scenario: TransportSecurityScenario;
    readonly actorType: TransportConnectionActorType;
    readonly remotePeerType: TransportPeerType;
  };
  readonly nodeId?: string;
}): ValidateTransportConnectionTrustRequest {
  return Object.freeze({
    connectionId: `identity-http:${input.requestId}`,
    direction: TransportConnectionDirections.inbound,
    scenario: input.routing.scenario,
    channelType: input.transportState.channelType,
    actorType: input.routing.actorType,
    localPeerType: TransportPeerTypes.authoritativeServer,
    remotePeerType: input.routing.remotePeerType,
    encryptedTransportEstablished: input.transportState.encryptedTransportEstablished,
    mutualTlsEstablished: input.transportState.mutualTlsEstablished,
    lanTrustAssumed: false,
    userSessionEvidence: input.routing.actorType === TransportConnectionActorTypes.userSession
      ? Object.freeze({
        userIdentityId: input.resolvedSession.principal.userIdentityId,
        loginAuthenticated: true,
        trustedDeviceId: input.resolvedSession.session.deviceTrustContext?.trustedDeviceId,
      })
      : undefined,
    nodeEvidence: input.routing.actorType === TransportConnectionActorTypes.nodeIdentity
      ? Object.freeze({
        nodeId: input.nodeId ?? input.resolvedSession.principal.userIdentityId,
      })
      : undefined,
    peerCertificateEvidence: Object.freeze({
      certificatePresented: input.transportState.peerCertificatePresented,
      serialNumber: input.transportState.peerCertificateSerialNumber,
    }),
  });
}

function buildWebSocketTransportTrustValidationRequest(input: {
  readonly transportState: InboundHttpTransportConnectionState;
  readonly requestId: string;
  readonly resolvedSession: ResolveAuthenticatedSessionApiResponse;
  readonly routing: {
    readonly scenario: TransportSecurityScenario;
    readonly actorType: TransportConnectionActorType;
    readonly remotePeerType: TransportPeerType;
  };
}): ValidateTransportConnectionTrustRequest {
  return Object.freeze({
    connectionId: `identity-ws:${input.requestId}`,
    direction: TransportConnectionDirections.inbound,
    scenario: input.routing.scenario,
    channelType: input.transportState.encryptedTransportEstablished
      ? TransportChannelTypes.wss
      : TransportChannelTypes.ws,
    actorType: input.routing.actorType,
    localPeerType: TransportPeerTypes.authoritativeServer,
    remotePeerType: input.routing.remotePeerType,
    encryptedTransportEstablished: input.transportState.encryptedTransportEstablished,
    mutualTlsEstablished: input.transportState.mutualTlsEstablished,
    lanTrustAssumed: false,
    userSessionEvidence: input.routing.actorType === TransportConnectionActorTypes.userSession
      ? Object.freeze({
        userIdentityId: input.resolvedSession.principal.userIdentityId,
        loginAuthenticated: true,
        trustedDeviceId: input.resolvedSession.session.deviceTrustContext?.trustedDeviceId,
      })
      : undefined,
    peerCertificateEvidence: Object.freeze({
      certificatePresented: input.transportState.peerCertificatePresented,
      serialNumber: input.transportState.peerCertificateSerialNumber,
    }),
  });
}

function resolveTransportTrustRouting(input: {
  readonly resolvedSession: ResolveAuthenticatedSessionApiResponse;
  readonly options: {
    readonly transportScenario?: TransportSecurityScenario;
    readonly transportActorType?: TransportConnectionActorType;
    readonly transportRemotePeerType?: TransportPeerType;
  } | undefined;
  readonly defaultScenario: TransportSecurityScenario;
}): {
  readonly scenario: TransportSecurityScenario;
  readonly actorType: TransportConnectionActorType;
  readonly remotePeerType: TransportPeerType;
} {
  const inferredScenario = input.resolvedSession.session.accessChannel === "desktop"
    ? TransportSecurityScenarios.desktopClientToControlPlane
    : TransportSecurityScenarios.thinClientToControlPlane;
  const scenario = input.options?.transportScenario ?? inferredScenario ?? input.defaultScenario;
  const actorType = input.options?.transportActorType ?? TransportConnectionActorTypes.userSession;
  const remotePeerType = input.options?.transportRemotePeerType
    ?? (input.resolvedSession.session.accessChannel === "desktop"
      ? TransportPeerTypes.desktopClient
      : TransportPeerTypes.thinClient);
  return Object.freeze({
    scenario,
    actorType,
    remotePeerType,
  });
}

function resolveTransportAccessChannelContext(input: {
  readonly accessChannel: "desktop" | "thin-client";
  readonly request: IncomingMessage;
}): AuthenticatedRequestContext["transport"]["channel"] {
  if (input.accessChannel === "desktop") {
    return Object.freeze({
      accessChannel: "desktop",
    });
  }

  return Object.freeze({
    accessChannel: "thin-client",
    thinClient: buildThinClientSessionChannelContext({
      userAgent: normalizeOptionalHeader(input.request.headers["user-agent"]),
      origin: normalizeOptionalHeader(input.request.headers.origin),
    }),
  });
}

function enforceThinClientWebSocketOrigin(input: {
  readonly request: IncomingMessage;
  readonly transportState: InboundHttpTransportConnectionState;
}) {
  return evaluateThinClientWebSocketOriginPolicy({
    originHeader: normalizeOptionalHeader(input.request.headers.origin),
    expectedHost: input.transportState.host,
  });
}

function enforceApiSecureTransport(input: {
  readonly request: IncomingMessage;
  readonly secureTransport: IdentityHttpServerSecureTransportOptions | undefined;
  readonly transportState: InboundHttpTransportConnectionState;
}): {
  readonly ok: true;
} | {
  readonly ok: false;
  readonly statusCode: number;
  readonly body: {
    readonly ok: false;
    readonly error: {
      readonly code: "forbidden";
      readonly message: string;
    };
  };
} {
  if (!input.secureTransport?.requireHttps) {
    return Object.freeze({ ok: true });
  }
  if (input.transportState.encryptedTransportEstablished) {
    return Object.freeze({ ok: true });
  }
  if (input.secureTransport.allowInsecureLoopback && input.transportState.loopbackRequest) {
    return Object.freeze({ ok: true });
  }

  return Object.freeze({
    ok: false,
    statusCode: 403,
    body: Object.freeze({
      ok: false,
      error: Object.freeze({
        code: "forbidden" as const,
        message: "Secure HTTPS transport is required for this API endpoint.",
      }),
    }),
  });
}

function enforceWebSocketSecureTransport(input: {
  readonly secureTransport: IdentityHttpServerSecureTransportOptions | undefined;
  readonly transportState: InboundHttpTransportConnectionState;
}): {
  readonly ok: true;
} | {
  readonly ok: false;
  readonly statusCode: number;
  readonly reason: WebSocketUpgradeDeniedReason;
} {
  const requireWss = input.secureTransport?.requireWss ?? input.secureTransport?.requireHttps ?? false;
  if (!requireWss) {
    return Object.freeze({ ok: true });
  }
  if (input.transportState.encryptedTransportEstablished) {
    return Object.freeze({ ok: true });
  }
  if (input.secureTransport?.allowInsecureLoopback && input.transportState.loopbackRequest) {
    return Object.freeze({ ok: true });
  }

  return Object.freeze({
    ok: false,
    statusCode: 403,
    reason: Object.freeze({
      code: "secure-transport-required",
      closeCode: 4403,
      message: "Secure WebSocket transport is required for this endpoint.",
    }),
  });
}

function validateWebSocketUpgradeRequestHeaders(input: IncomingMessage): {
  readonly ok: true;
  readonly websocketKey: string;
} | {
  readonly ok: false;
  readonly statusCode: number;
  readonly reason: WebSocketUpgradeDeniedReason;
} {
  const upgrade = normalizeOptionalHeader(input.headers.upgrade);
  if (upgrade?.toLowerCase() !== "websocket") {
    return Object.freeze({
      ok: false,
      statusCode: 400,
      reason: Object.freeze({
        code: "invalid-upgrade-request",
        closeCode: 4400,
        message: "Upgrade header must be 'websocket'.",
      }),
    });
  }

  const connection = normalizeOptionalHeader(input.headers.connection)?.toLowerCase() ?? "";
  if (!connection.includes("upgrade")) {
    return Object.freeze({
      ok: false,
      statusCode: 400,
      reason: Object.freeze({
        code: "invalid-upgrade-request",
        closeCode: 4400,
        message: "Connection header must include 'Upgrade'.",
      }),
    });
  }

  const version = normalizeOptionalHeader(input.headers["sec-websocket-version"]);
  if (version !== "13") {
    return Object.freeze({
      ok: false,
      statusCode: 426,
      reason: Object.freeze({
        code: "invalid-upgrade-request",
        closeCode: 4400,
        message: "WebSocket version 13 is required.",
      }),
    });
  }

  const websocketKey = normalizeOptionalHeader(input.headers["sec-websocket-key"]);
  if (!websocketKey) {
    return Object.freeze({
      ok: false,
      statusCode: 400,
      reason: Object.freeze({
        code: "invalid-upgrade-request",
        closeCode: 4400,
        message: "Sec-WebSocket-Key header is required.",
      }),
    });
  }

  return Object.freeze({
    ok: true,
    websocketKey,
  });
}

function denyWebSocketUpgrade(
  input: {
    readonly request: IncomingMessage;
    readonly socket: Socket;
    readonly logger: IdentityHttpServerLogger;
  },
  requestId: string,
  correlationId: string,
  statusCode: number,
  reason: WebSocketUpgradeDeniedReason,
): void {
  const safeMessage = redactSensitiveText(reason.message);
  const payload = normalizeSharedApiErrorEnvelope(Object.freeze({
    ok: false,
    error: Object.freeze({
      code: reason.code,
      message: safeMessage,
      closeCode: reason.closeCode,
      correlationId,
    }),
  }));
  const body = JSON.stringify(payload);
  const responseLines = [
    `HTTP/1.1 ${statusCode} ${resolveHttpStatusText(statusCode)}`,
    "Connection: close",
    `${REQUEST_ID_HEADER}: ${requestId}`,
    `${CORRELATION_ID_HEADER}: ${correlationId}`,
    "Content-Type: application/json; charset=utf-8",
    `Content-Length: ${Buffer.byteLength(body)}`,
    "",
    body,
  ];
  input.socket.end(responseLines.join("\r\n"));
  input.logger.warn(Object.freeze({
    event: "identity-websocket.upgrade.denied",
    requestId,
    correlationId,
    method: input.request.method,
    path: input.request.url,
    statusCode,
    details: Object.freeze({
      denial: reason,
    }),
  }));
}

function buildWebSocketUpgradeAcceptedResponse(
  websocketKey: string,
  requestId: string,
  correlationId: string,
  selectedProtocol?: string,
): string {
  const accept = createHash("sha1")
    .update(`${websocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "utf8")
    .digest("base64");
  const responseLines = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    `${REQUEST_ID_HEADER}: ${requestId}`,
    `${CORRELATION_ID_HEADER}: ${correlationId}`,
  ];
  if (selectedProtocol) {
    responseLines.push(`Sec-WebSocket-Protocol: ${selectedProtocol}`);
  }
  responseLines.push("", "");
  return responseLines.join("\r\n");
}

function resolveHttpStatusText(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 426:
      return "Upgrade Required";
    default:
      return "Internal Server Error";
  }
}

function mapWebSocketCloseCodeToStatusCode(closeCode: number): number {
  if (closeCode === 4400) {
    return 400;
  }
  if (closeCode === 4401) {
    return 401;
  }
  if (closeCode === 4403) {
    return 403;
  }
  return 500;
}

interface ApiCorsPolicy {
  readonly enabled: boolean;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly allowLoopbackOrigins: boolean;
  readonly allowNullOrigin: boolean;
  readonly allowedMethods: ReadonlyArray<string>;
  readonly allowedHeaders: ReadonlyArray<string>;
  readonly maxAgeSeconds: number;
}

function resolveApiCorsPolicy(options: IdentityHttpServerCorsOptions | undefined): ApiCorsPolicy {
  const normalizedAllowedOrigins = (options?.allowedOrigins ?? [])
    .map((origin) => normalizeCorsOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
  const allowedMethods = normalizeCorsTokenList(options?.allowedMethods, DEFAULT_API_CORS_ALLOWED_METHODS);
  const allowedHeaders = normalizeCorsTokenList(options?.allowedHeaders, DEFAULT_API_CORS_ALLOWED_HEADERS);
  const maxAgeSeconds = normalizeCorsMaxAge(options?.maxAgeSeconds);
  return Object.freeze({
    enabled: options?.enabled ?? true,
    allowedOrigins: new Set(normalizedAllowedOrigins),
    allowLoopbackOrigins: options?.allowLoopbackOrigins ?? true,
    allowNullOrigin: options?.allowNullOrigin ?? false,
    allowedMethods,
    allowedHeaders,
    maxAgeSeconds,
  });
}

function evaluateApiCorsRequest(input: {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly path: string;
  readonly corsPolicy: ApiCorsPolicy;
}): {
  readonly ok: true;
  readonly preflight: boolean;
} | {
  readonly ok: false;
  readonly reason: "origin-invalid" | "origin-not-allowed";
  readonly message: string;
  readonly origin?: string;
} {
  const origin = normalizeOptionalHeader(input.request.headers.origin);
  const requestedMethod = normalizeOptionalHeader(input.request.headers["access-control-request-method"]);
  const isPreflight = input.request.method === "OPTIONS" && Boolean(requestedMethod);

  if (!input.corsPolicy.enabled || !origin) {
    if (input.request.method === "OPTIONS" && input.path.startsWith("/api/")) {
      return {
        ok: true,
        preflight: true,
      };
    }
    return {
      ok: true,
      preflight: false,
    };
  }

  if (!isCorsOriginAllowed(origin, input.corsPolicy)) {
    return {
      ok: false,
      reason: normalizeCorsOrigin(origin) ? "origin-not-allowed" : "origin-invalid",
      message: "Cross-origin request origin is not allowed.",
      origin,
    };
  }

  setCorsResponseHeaders(input.response, input.request, origin, input.corsPolicy, isPreflight);
  if (isPreflight) {
    return {
      ok: true,
      preflight: true,
    };
  }

  return {
    ok: true,
    preflight: false,
  };
}

function setCorsResponseHeaders(
  response: ServerResponse,
  request: IncomingMessage,
  origin: string,
  corsPolicy: ApiCorsPolicy,
  includePreflightHeaders: boolean,
): void {
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");

  if (!includePreflightHeaders) {
    return;
  }

  const requestedHeaders = normalizeCorsTokenList(
    normalizeOptionalHeader(request.headers["access-control-request-headers"])?.split(","),
    corsPolicy.allowedHeaders,
  );
  response.setHeader("access-control-allow-methods", corsPolicy.allowedMethods.join(", "));
  response.setHeader("access-control-allow-headers", requestedHeaders.join(", "));
  response.setHeader("access-control-max-age", String(corsPolicy.maxAgeSeconds));
}

function isCorsOriginAllowed(origin: string, corsPolicy: ApiCorsPolicy): boolean {
  const normalizedOrigin = normalizeCorsOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }
  if (normalizedOrigin === "null") {
    return corsPolicy.allowNullOrigin;
  }
  if (corsPolicy.allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (!corsPolicy.allowLoopbackOrigins) {
    return false;
  }

  const parsedOrigin = safeParseUrl(normalizedOrigin);
  if (!parsedOrigin) {
    return false;
  }

  const protocol = parsedOrigin.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return false;
  }
  return isLoopbackHostValue(parsedOrigin.hostname.trim().toLowerCase());
}

function normalizeCorsOrigin(origin: string | undefined): string | undefined {
  const normalized = origin?.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "null") {
    return "null";
  }
  const parsed = safeParseUrl(normalized);
  return parsed?.origin;
}

function normalizeCorsTokenList(
  values: ReadonlyArray<string> | undefined,
  fallback: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const normalized = (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  if (normalized.length === 0) {
    return fallback;
  }
  return [...new Set(normalized)];
}

function normalizeCorsMaxAge(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return 600;
  }
  return value;
}

function safeParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function normalizeOptionalHeader(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized ? normalized : undefined;
}

function resolveInboundHttpTransportConnectionState(request: IncomingMessage): InboundHttpTransportConnectionState {
  const socketLike = request.socket as {
    readonly encrypted?: boolean;
    readonly authorized?: boolean;
    readonly localAddress?: string;
    readonly remoteAddress?: string;
    getPeerCertificate?: () => {
      readonly serialNumber?: string;
      readonly fingerprint256?: string;
    } | undefined;
  } | undefined;
  const encryptedTransportEstablished = Boolean(socketLike?.encrypted);
  const peerCertificate = socketLike?.getPeerCertificate?.();
  const peerCertificateSerialNumber = normalizeOptionalString(peerCertificate?.serialNumber ?? null);
  const peerCertificateFingerprintSha256 = normalizeCertificateFingerprintSha256(peerCertificate?.fingerprint256);
  const peerCertificatePresented = Boolean(peerCertificateSerialNumber);
  const host = normalizeHostHeader(request.headers.host);
  const localAddress = normalizeOptionalString(socketLike?.localAddress ?? null);
  const remoteAddress = normalizeOptionalString(socketLike?.remoteAddress ?? null);

  return Object.freeze({
    channelType: encryptedTransportEstablished ? TransportChannelTypes.https : TransportChannelTypes.http,
    encryptedTransportEstablished,
    mutualTlsEstablished: Boolean(encryptedTransportEstablished && socketLike?.authorized && peerCertificatePresented),
    peerCertificatePresented,
    peerCertificateSerialNumber,
    peerCertificateFingerprintSha256,
    host,
    localAddress,
    remoteAddress,
    loopbackRequest: isLoopbackHostValue(host)
      || isLoopbackAddress(localAddress)
      || isLoopbackAddress(remoteAddress),
  });
}

function normalizeHostHeader(hostHeader: string | string[] | undefined): string | undefined {
  const hostValue = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const normalized = normalizeOptionalString(hostValue ?? null);
  if (!normalized) {
    return undefined;
  }
  const splitHost = normalized.split(":")[0]?.trim();
  return splitHost ? splitHost.toLowerCase() : undefined;
}

function normalizeCertificateFingerprintSha256(fingerprint: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(fingerprint ?? null);
  if (!normalized) {
    return undefined;
  }
  const compact = normalized.replace(/[^a-fA-F0-9]/g, "");
  return compact ? compact.toUpperCase() : undefined;
}

function isLoopbackHostValue(value: string | undefined): boolean {
  return value === "127.0.0.1" || value === "localhost" || value === "::1" || value === "[::1]";
}

function isLoopbackAddress(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "::ffff:127.0.0.1"
    || normalized === "::ffff:7f00:1";
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

async function parseAndValidateSecretMetadataRequest<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: SecretMetadataApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = Object.freeze({
      ok: false,
      error: {
        code: SecretMetadataApiErrorCodes.invalidRequest,
        message: parsedBody.error,
      },
    });
    logger.warn(Object.freeze({
      event: "secret-metadata-http.request.invalid-json",
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
        code: SecretMetadataApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(validation.error.issues.map((issue) => Object.freeze({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        }))),
      },
    });
    logger.warn(Object.freeze({
      event: "secret-metadata-http.request.validation-failed",
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

async function parseAndValidateAuthorizationManagementRequest<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
  options?: {
    readonly allowEmptyBody?: boolean;
  },
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: AuthorizationManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    if (options?.allowEmptyBody && parsedBody.error === "Request body is required.") {
      const validation = schema.safeParse({});
      if (validation.success) {
        return { ok: true, data: validation.data };
      }
    }
    const body = buildAuthorizationManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "authorization-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const validation = schema.safeParse(parsedBody.value);
  if (!validation.success) {
    const body: AuthorizationManagementApiResponse<never> = Object.freeze({
      ok: false,
      error: {
        code: AuthorizationManagementApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(validation.error.issues.map((issue) => Object.freeze({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        }))),
      },
    });
    logger.warn(Object.freeze({
      event: "authorization-management-http.request.validation-failed",
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

async function parseAndValidateNodeEnrollmentSubmissionRequest(
  request: IncomingMessage,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: NodeEnrollmentSubmissionRequestDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildNodeTrustInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "node-trust-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  try {
    const data = parseNodeEnrollmentSubmissionRequestDto(parsedBody.value);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof NodeTrustApiSchemaValidationError) {
      const body: NodeTrustApiResponse<never> = Object.freeze({
        ok: false,
        error: Object.freeze({
          code: NodeTrustApiErrorCodes.invalidRequest,
          message: "Request validation failed.",
          validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          }))),
        }),
      });
      logger.warn(Object.freeze({
        event: "node-trust-http.request.validation-failed",
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

    const body = buildNodeTrustInvalidRequestResponse("Request validation failed.");
    logger.warn(Object.freeze({
      event: "node-trust-http.request.validation-error",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
      },
    }));
    return { ok: false, statusCode: 400, body };
  }
}

async function parseAndValidateApproveNodeEnrollmentRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  enrollmentRequestId: string,
  requestLogId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: ApproveNodeEnrollmentActionRequestDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  return parseAndValidateNodeTrustActionRequest(
    request,
    Object.freeze({
      actorUserIdentityId,
      requestId: enrollmentRequestId,
    }),
    requestLogId,
    logger,
    maxBodyBytes,
    parseApproveNodeEnrollmentActionRequestDto,
  );
}

async function parseAndValidateRejectNodeEnrollmentRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  enrollmentRequestId: string,
  requestLogId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: RejectNodeEnrollmentActionRequestDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  return parseAndValidateNodeTrustActionRequest(
    request,
    Object.freeze({
      actorUserIdentityId,
      requestId: enrollmentRequestId,
    }),
    requestLogId,
    logger,
    maxBodyBytes,
    parseRejectNodeEnrollmentActionRequestDto,
  );
}

async function parseAndValidateRevokeNodeTrustRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  nodeId: string,
  requestLogId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: RevokeNodeTrustActionRequestDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  return parseAndValidateNodeTrustActionRequest(
    request,
    Object.freeze({
      actorUserIdentityId,
      nodeId,
    }),
    requestLogId,
    logger,
    maxBodyBytes,
    parseRevokeNodeTrustActionRequestDto,
  );
}

async function parseAndValidateNodeHeartbeatRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  nodeId: string,
  requestLogId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: NodeHeartbeatPayloadDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  return parseAndValidateNodeTrustActionRequest(
    request,
    Object.freeze({
      actorUserIdentityId,
      nodeId,
    }),
    requestLogId,
    logger,
    maxBodyBytes,
    parseNodeHeartbeatPayloadDto,
  );
}

async function parseAndValidateNodeOperationalUpdateRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  nodeId: string,
  requestLogId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: NodeOperationalUpdatePayloadDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  return parseAndValidateNodeTrustActionRequest(
    request,
    Object.freeze({
      actorUserIdentityId,
      nodeId,
    }),
    requestLogId,
    logger,
    maxBodyBytes,
    parseNodeOperationalUpdatePayloadDto,
  );
}

async function parseAndValidateNodeTrustActionRequest<T>(
  request: IncomingMessage,
  additions: Readonly<Record<string, unknown>>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
  parser: (payload: unknown) => T,
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: NodeTrustApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildNodeTrustInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "node-trust-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  try {
    const payload = Object.freeze({
      ...parsedBody.value as Record<string, unknown>,
      ...additions,
    });
    return {
      ok: true,
      data: parser(payload),
    };
  } catch (error) {
    if (error instanceof NodeTrustApiSchemaValidationError) {
      const body: NodeTrustApiResponse<never> = Object.freeze({
        ok: false,
        error: Object.freeze({
          code: NodeTrustApiErrorCodes.invalidRequest,
          message: "Request validation failed.",
          validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          }))),
        }),
      });
      logger.warn(Object.freeze({
        event: "node-trust-http.request.validation-failed",
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

    const body = buildNodeTrustInvalidRequestResponse("Request validation failed.");
    logger.warn(Object.freeze({
      event: "node-trust-http.request.validation-error",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
      },
    }));
    return { ok: false, statusCode: 400, body };
  }
}

async function parseAndValidateExecutionNodeSetAvailabilityOverrideRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  nodeId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: ExecutionNodeSetAvailabilityOverrideRequestDtoPayload & { readonly actorUserIdentityId: string } }
  | { readonly ok: false; readonly statusCode: number; readonly body: ExecutionNodeManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildExecutionNodeManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "execution-node-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  try {
    const payload = Object.freeze({
      ...parsedBody.value as Record<string, unknown>,
      nodeId,
    });
    const parsed = parseExecutionNodeSetAvailabilityOverrideRequestDto(payload);
    return {
      ok: true,
      data: Object.freeze({
        actorUserIdentityId,
        ...parsed,
      }),
    };
  } catch (error) {
    const body = buildExecutionNodeManagementValidationErrorResponse(error);
    logger.warn(Object.freeze({
      event: "execution-node-management-http.request.validation-failed",
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
}

async function parseAndValidateStorageCreateRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: CreateStorageInstanceRequestDtoPayload }
  | { readonly ok: false; readonly statusCode: number; readonly body: StorageManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildStorageManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "storage-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  try {
    const payload = Object.freeze({
      ...parsedBody.value as Record<string, unknown>,
      actorUserIdentityId,
      workspaceId,
    });
    return { ok: true, data: parseCreateStorageInstanceRequestDto(payload) };
  } catch (error) {
    if (error instanceof StorageTransportSchemaValidationError) {
      const body = buildStorageManagementValidationErrors(error.issues);
      logger.warn(Object.freeze({
        event: "storage-management-http.request.validation-failed",
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

    const body = buildStorageManagementInvalidRequestResponse("Request validation failed.");
    logger.warn(Object.freeze({
      event: "storage-management-http.request.validation-error",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
      },
    }));
    return { ok: false, statusCode: 400, body };
  }
}

async function parseAndValidateStorageMetadataUpdateRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  storageInstanceId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: UpdateStorageInstanceMetadataApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: StorageManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildStorageManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "storage-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  try {
    const payload = Object.freeze({
      ...parsedBody.value as Record<string, unknown>,
      actorUserIdentityId,
      workspaceId,
      storageInstanceId,
    });
    return { ok: true, data: parseUpdateStorageInstanceRequestDto(payload) };
  } catch (error) {
    if (error instanceof StorageTransportSchemaValidationError) {
      const body = buildStorageManagementValidationErrors(error.issues);
      logger.warn(Object.freeze({
        event: "storage-management-http.request.validation-failed",
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

    const body = buildStorageManagementInvalidRequestResponse("Request validation failed.");
    logger.warn(Object.freeze({
      event: "storage-management-http.request.validation-error",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
      details: {
        request: redactSensitiveAuthPayload(parsedBody.value),
      },
    }));
    return { ok: false, statusCode: 400, body };
  }
}

async function parseAndValidateStorageLifecycleRequest<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly statusCode: number; readonly body: StorageManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildStorageManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "storage-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const validation = schema.safeParse(parsedBody.value);
  if (!validation.success) {
    const body = buildStorageManagementValidationErrors(validation.error.issues.map((issue) => Object.freeze({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })));
    logger.warn(Object.freeze({
      event: "storage-management-http.request.validation-failed",
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

async function parseAndValidateAssetRegisterRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: RegisterAssetApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: AssetManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildAssetManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "asset-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const bodyRecord = asRecord(parsedBody.value);
  if (!bodyRecord) {
    const body = buildAssetManagementInvalidRequestResponse("Request body must be an object.");
    return { ok: false, statusCode: 400, body };
  }

  return {
    ok: true,
    data: Object.freeze({
      ...bodyRecord,
      actorUserIdentityId,
      workspaceId,
    }) as RegisterAssetApiRequest,
  };
}

async function parseAndValidateGeneratedOutputRegisterRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: RegisterGeneratedOutputApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: AssetManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildAssetManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "asset-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const bodyRecord = asRecord(parsedBody.value);
  if (!bodyRecord) {
    const body = buildAssetManagementInvalidRequestResponse("Request body must be an object.");
    return { ok: false, statusCode: 400, body };
  }

  return {
    ok: true,
    data: Object.freeze({
      ...bodyRecord,
      actorUserIdentityId,
      workspaceId,
    }) as RegisterGeneratedOutputApiRequest,
  };
}

async function parseAndValidateImageAssetCreateRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: CreateImageAssetApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: ImageAssetManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildImageAssetManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "image-asset-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const bodyRecord = asRecord(parsedBody.value);
  if (!bodyRecord) {
    const body = buildImageAssetManagementInvalidRequestResponse("Request body must be an object.");
    return { ok: false, statusCode: 400, body };
  }

  return {
    ok: true,
    data: Object.freeze({
      ...bodyRecord,
      actorUserIdentityId,
      workspaceId,
    }) as CreateImageAssetApiRequest,
  };
}

async function parseAndValidateImageAssetCompleteRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  assetId: string,
  uploadSessionId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: CompleteImageAssetUploadApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: ImageAssetManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildImageAssetManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "image-asset-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const bodyRecord = asRecord(parsedBody.value);
  if (!bodyRecord) {
    const body = buildImageAssetManagementInvalidRequestResponse("Request body must be an object.");
    return { ok: false, statusCode: 400, body };
  }

  return {
    ok: true,
    data: Object.freeze({
      ...bodyRecord,
      actorUserIdentityId,
      workspaceId,
      assetId,
      uploadSessionId,
    }) as CompleteImageAssetUploadApiRequest,
  };
}

function parseAndValidateImageAssetPreviewRequest(
  actorUserIdentityId: string,
  workspaceId: string,
  assetId: string,
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly data: RequestImageAssetPreviewApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: ImageAssetManagementApiResponse<never> } {
  const representationRaw = normalizeOptionalString(searchParams.get("representation"));
  const representation = parseOptionalEnum(representationRaw ?? null, [
    "original",
    "gallery",
    "thumbnail",
  ] as const);
  if (representationRaw && !representation) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("representation is invalid."),
    };
  }

  const preferredMediaTypes = parseOptionalMultiEnumList(
    searchParams,
    "preferredMediaType",
    "preferredMediaTypes",
    ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff", "image/avif", "image/heic", "image/heif"] as const,
  );
  if (!preferredMediaTypes.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("preferredMediaType values are invalid."),
    };
  }

  const expiresInSeconds = parseOptionalInteger(searchParams.get("expiresInSeconds"));
  if (expiresInSeconds !== undefined && expiresInSeconds < 1) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("expiresInSeconds must be an integer >= 1."),
    };
  }

  return {
    ok: true,
    data: Object.freeze({
      actorUserIdentityId,
      workspaceId,
      assetId,
      representation,
      preferredMediaTypes: preferredMediaTypes.value,
      expiresInSeconds,
      correlationId: normalizeOptionalString(searchParams.get("correlationId")),
      occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
    }),
  };
}

function parseAndValidateImageAssetListRequest(
  actorUserIdentityId: string,
  workspaceId: string,
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly data: ListImageAssetMetadataApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: ImageAssetManagementApiResponse<never> } {
  const originKinds = parseOptionalMultiEnumList(
    searchParams,
    "originKind",
    "originKinds",
    ["uploaded-source", "generated-result"] as const,
  );
  if (!originKinds.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("originKind values are invalid."),
    };
  }

  const lifecycleStatuses = parseOptionalMultiEnumList(
    searchParams,
    "status",
    "statuses",
    ["ingesting", "available", "failed", "archived", "deleted"] as const,
  );
  if (!lifecycleStatuses.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("status values are invalid."),
    };
  }

  const visibilities = parseOptionalMultiEnumList(
    searchParams,
    "visibility",
    "visibilities",
    ["private", "workspace", "shared", "published"] as const,
  );
  if (!visibilities.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("visibility values are invalid."),
    };
  }

  const mediaTypes = parseOptionalMultiEnumList(
    searchParams,
    "mediaType",
    "mediaTypes",
    ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff", "image/avif", "image/heic", "image/heif"] as const,
  );
  if (!mediaTypes.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse("mediaType values are invalid."),
    };
  }

  const pagination = parseSharedListPaginationFromQuery(searchParams);
  if (!pagination.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildImageAssetManagementInvalidRequestResponse(pagination.issue.message),
    };
  }

  return {
    ok: true,
    data: Object.freeze({
      actorUserIdentityId,
      workspaceId,
      ownerUserIdentityIds: mergeOptionalStringLists(
        parseOptionalStringList(searchParams, "ownerUserId", "ownerUserIds"),
        parseOptionalStringList(searchParams, "ownerUserIdentityId", "ownerUserIdentityIds"),
      ),
      originKinds: originKinds.value,
      lifecycleStatuses: lifecycleStatuses.value,
      visibilities: visibilities.value,
      mediaTypes: mediaTypes.value,
      storageInstanceIds: parseOptionalStringList(searchParams, "storageInstanceId", "storageInstanceIds"),
      sourceRunIds: parseOptionalStringList(searchParams, "sourceRunId", "sourceRunIds"),
      generationOperationIds: parseOptionalStringList(searchParams, "generationOperationId", "generationOperationIds"),
      createdAfter: normalizeOptionalString(searchParams.get("createdAfter")),
      createdBefore: normalizeOptionalString(searchParams.get("createdBefore")),
      updatedAfter: normalizeOptionalString(searchParams.get("updatedAfter")),
      updatedBefore: normalizeOptionalString(searchParams.get("updatedBefore")),
      includeDeleted: parseOptionalBoolean(searchParams.get("includeDeleted")),
      limit: pagination.limit,
      offset: pagination.offset,
      correlationId: normalizeOptionalString(searchParams.get("correlationId")),
      occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
    }),
  };
}

function parseAndValidateAssetListRequest(
  actorUserIdentityId: string,
  workspaceId: string,
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly data: ListAssetsApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: AssetManagementApiResponse<never> } {
  const assetKinds = parseOptionalMultiEnumList(
    searchParams,
    "assetKind",
    "assetKinds",
    ["uploaded-file", "generated-output", "preview", "derived"] as const,
  );
  if (!assetKinds.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildAssetManagementInvalidRequestResponse("assetKind values are invalid."),
    };
  }

  const visibilities = parseOptionalMultiEnumList(
    searchParams,
    "visibility",
    "visibilities",
    ["private", "workspace", "shared", "published"] as const,
  );
  if (!visibilities.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildAssetManagementInvalidRequestResponse("visibility values are invalid."),
    };
  }

  const lifecycleStates = parseOptionalMultiEnumList(
    searchParams,
    "lifecycleState",
    "lifecycleStates",
    ["active", "archived", "deleted"] as const,
  );
  if (!lifecycleStates.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildAssetManagementInvalidRequestResponse("lifecycleState values are invalid."),
    };
  }

  const scope = parseOptionalEnum(
    searchParams.get("scope"),
    ["private", "workspace", "all"] as const,
  );
  if (searchParams.get("scope") && !scope) {
    return {
      ok: false,
      statusCode: 400,
      body: buildAssetManagementInvalidRequestResponse("scope must be one of: private, workspace, all."),
    };
  }

  const pagination = parseSharedListPaginationFromQuery(searchParams);
  if (!pagination.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildAssetManagementInvalidRequestResponse(pagination.issue.message),
    };
  }

  return {
    ok: true,
    data: Object.freeze({
      actorUserIdentityId,
      workspaceId,
      correlationId: normalizeOptionalString(searchParams.get("correlationId")),
      occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
      scope,
      ownerUserId: normalizeOptionalString(searchParams.get("ownerUserId")),
      createdByUserId: normalizeOptionalString(searchParams.get("createdByUserId")),
      storageInstanceId: normalizeOptionalString(searchParams.get("storageInstanceId")),
      assetKinds: assetKinds.value,
      visibilities: visibilities.value,
      lifecycleStates: lifecycleStates.value,
      sourceAssetId: normalizeOptionalString(searchParams.get("sourceAssetId")),
      sourceAssetVersionId: normalizeOptionalString(searchParams.get("sourceAssetVersionId")),
      limit: pagination.limit,
      offset: pagination.offset,
    }),
  };
}

function parseAndValidateRuntimeQueueListRequest(input: {
  readonly workspaceId: string;
  readonly searchParams: URLSearchParams;
}):
  | {
    readonly ok: true;
    readonly data: {
      readonly workspaceId: string;
      readonly systemId?: string;
      readonly statuses?: ReadonlyArray<typeof RuntimeQueueItemStatuses[keyof typeof RuntimeQueueItemStatuses]>;
      readonly limit?: number;
      readonly offset?: number;
    };
  }
  | { readonly ok: false; readonly statusCode: number; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const statuses = parseOptionalMultiEnumList(
    input.searchParams,
    "status",
    "statuses",
    [
      RuntimeQueueItemStatuses.queued,
      RuntimeQueueItemStatuses.running,
      RuntimeQueueItemStatuses.completed,
      RuntimeQueueItemStatuses.failed,
      RuntimeQueueItemStatuses.cancelled,
    ] as const,
  );
  if (!statuses.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("status values are invalid."),
    };
  }
  const pagination = parseSharedListPaginationFromQuery(input.searchParams);
  if (!pagination.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse(pagination.issue.message),
    };
  }

  return {
    ok: true,
    data: Object.freeze({
      workspaceId: input.workspaceId,
      systemId: normalizeOptionalString(input.searchParams.get("systemId")),
      statuses: statuses.value,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
  };
}

function parseAndValidateDeploymentPolicyStateReadRequest(input: {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly searchParams: URLSearchParams;
}):
  | {
    readonly ok: true;
    readonly data: {
      readonly actorUserIdentityId: string;
      readonly workspaceId: string;
      readonly profileId?: "home" | "classroom" | "organization";
      readonly includeCatalog?: boolean;
      readonly includeOverrideRecords?: boolean;
      readonly includeEffectiveMetadata?: boolean;
      readonly evaluatedAt?: string;
    };
  }
  | { readonly ok: false; readonly statusCode: number; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const profileIdRaw = normalizeOptionalString(input.searchParams.get("profileId"));
  const profileId = profileIdRaw === "home" || profileIdRaw === "classroom" || profileIdRaw === "organization"
    ? profileIdRaw
    : profileIdRaw
      ? null
      : undefined;
  if (profileId === null) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("profileId must be one of: home, classroom, organization."),
    };
  }

  const includeCatalog = parseBooleanSearchParam(input.searchParams.get("includeCatalog"));
  if (includeCatalog === null) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("includeCatalog must be 'true' or 'false'."),
    };
  }

  const includeOverrideRecords = parseBooleanSearchParam(input.searchParams.get("includeOverrideRecords"));
  if (includeOverrideRecords === null) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("includeOverrideRecords must be 'true' or 'false'."),
    };
  }

  const includeEffectiveMetadata = parseBooleanSearchParam(input.searchParams.get("includeEffectiveMetadata"));
  if (includeEffectiveMetadata === null) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("includeEffectiveMetadata must be 'true' or 'false'."),
    };
  }

  const evaluatedAt = normalizeOptionalString(input.searchParams.get("evaluatedAt"));
  try {
    const parsed = parseReadDeploymentPolicyStateRequest({
      scope: {
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: input.workspaceId,
      },
      actorUserIdentityId: input.actorUserIdentityId,
      profileId: profileId ?? undefined,
      includeCatalog: includeCatalog ?? undefined,
      includeOverrideRecords: includeOverrideRecords ?? undefined,
      includeEffectiveMetadata: includeEffectiveMetadata ?? undefined,
      evaluatedAt,
    });

    return {
      ok: true,
      data: Object.freeze({
        actorUserIdentityId: parsed.actorUserIdentityId,
        workspaceId: parsed.scope.scopeId,
        profileId: parsed.profileId,
        includeCatalog: parsed.includeCatalog,
        includeOverrideRecords: parsed.includeOverrideRecords,
        includeEffectiveMetadata: parsed.includeEffectiveMetadata,
        evaluatedAt: parsed.evaluatedAt,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse(
        error instanceof Error ? error.message : "Deployment policy read request is invalid.",
      ),
    };
  }
}

function parseAndValidateDeploymentPolicyActiveProfileWriteRequest(payload: unknown):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseUpdateDeploymentPolicyActiveProfileRequest>;
  }
  | { readonly ok: false; readonly statusCode: 400; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  try {
    return {
      ok: true,
      data: parseUpdateDeploymentPolicyActiveProfileRequest(payload),
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse(
        error instanceof Error ? error.message : "Deployment policy active-profile request is invalid.",
      ),
    };
  }
}

function parseAndValidateDeploymentPolicyOverrideWriteRequest(payload: unknown):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseApplyDeploymentPolicyOverrideOperationsRequest>;
  }
  | { readonly ok: false; readonly statusCode: 400; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  try {
    return {
      ok: true,
      data: parseApplyDeploymentPolicyOverrideOperationsRequest(payload),
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse(
        error instanceof Error ? error.message : "Deployment policy override request is invalid.",
      ),
    };
  }
}

function parseAndValidateAuthoritativeRunListReadRequest(input: {
  readonly workspaceId: string;
  readonly searchParams: URLSearchParams;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseRunListReadRequest>;
  }
  | { readonly ok: false; readonly statusCode: number; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  let parsedConventions: ReturnType<typeof parseSharedApiListQueryConventions>;
  try {
    parsedConventions = parseSharedApiListQueryConventions(input.searchParams);
  } catch (error) {
    if (error instanceof SharedApiQuerySchemaValidationError) {
      return {
        ok: false,
        statusCode: 400,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Run list query is invalid."),
      };
    }
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("Run list query is invalid."),
    };
  }

  const states = input.searchParams.getAll("state")
    .map((value) => resolveRunLifecycleState(value))
    .filter((value): value is string => Boolean(value));
  if (states.length !== input.searchParams.getAll("state").length) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("state values are invalid."),
    };
  }
  const sources = input.searchParams.getAll("source")
    .map((value) => resolveRunSubmissionSource(value));
  if (
    input.searchParams.getAll("source").some((value) => {
      const normalized = value.trim();
      return normalized.length > 0 && resolveRunSubmissionSource(normalized) !== normalized;
    })
  ) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("source values are invalid."),
    };
  }

  const request = {
    workspaceId: input.workspaceId,
    states: states.length > 0 ? Object.freeze(states) : undefined,
    sources: sources.length > 0 ? Object.freeze(sources) : undefined,
    search: parsedConventions.search,
    limit: parsedConventions.pagination?.limit,
    offset: parsedConventions.pagination?.offset,
    sortBy: parsedConventions.sorting?.sortBy as "submittedAt" | "updatedAt" | "state" | undefined,
    sortDirection: parsedConventions.sorting?.sortDirection as "asc" | "desc" | undefined,
  };

  try {
    return {
      ok: true,
      data: parseRunListReadRequest(request),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        statusCode: 400,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Run list request is invalid."),
      };
    }
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("Run list request is invalid."),
    };
  }
}

function parseBooleanSearchParam(value: string | null): boolean | undefined | null {
  if (value === null) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function parseAndValidateAuthoritativeRunQueueStatusReadRequest(input: {
  readonly workspaceId: string;
  readonly searchParams: URLSearchParams;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseRunQueueStatusReadRequest>;
  }
  | { readonly ok: false; readonly statusCode: number; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const statuses = input.searchParams.getAll("status")
    .map((value) => resolveRunLifecycleState(value))
    .filter((value): value is string => Boolean(value));
  if (statuses.length !== input.searchParams.getAll("status").length) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("status values are invalid."),
    };
  }

  const pagination = parseSharedListPaginationFromQuery(input.searchParams);
  if (!pagination.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse(pagination.issue.message),
    };
  }

  try {
    return {
      ok: true,
      data: parseRunQueueStatusReadRequest({
        workspaceId: input.workspaceId,
        statuses: statuses.length > 0 ? Object.freeze(statuses) : undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        statusCode: 400,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Run queue request is invalid."),
      };
    }
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("Run queue request is invalid."),
    };
  }
}

function parseAndValidateExecutionReadinessReadRequest(input: {
  readonly workspaceId: string;
  readonly searchParams: URLSearchParams;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseExecutionReadinessReadRequest>;
  }
  | { readonly ok: false; readonly statusCode: number; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  try {
    return {
      ok: true,
      data: parseExecutionReadinessReadRequest({
        workspaceId: input.workspaceId,
        systemId: normalizeOptionalString(input.searchParams.get("systemId")),
        operationKind: normalizeOptionalString(input.searchParams.get("operationKind")),
        translationContractVersion: normalizeOptionalString(input.searchParams.get("translationContractVersion")),
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        statusCode: 400,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Execution readiness query is invalid."),
      };
    }
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("Execution readiness query is invalid."),
    };
  }
}

function parseAndValidateSchedulingAdminStaleReservationsReadRequest(input: {
  readonly workspaceId: string;
  readonly searchParams: URLSearchParams;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseSchedulingAdminListStaleReservationsRequest>;
  }
  | { readonly ok: false; readonly statusCode: number; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const pagination = parseSharedListPaginationFromQuery(input.searchParams);
  if (!pagination.ok) {
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse(pagination.issue.message),
    };
  }

  try {
    return {
      ok: true,
      data: parseSchedulingAdminListStaleReservationsRequest({
        workspaceId: input.workspaceId,
        queueId: normalizeOptionalString(input.searchParams.get("queueId")),
        asOf: normalizeOptionalString(input.searchParams.get("asOf")),
        limit: pagination.limit,
        offset: pagination.offset,
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        statusCode: 400,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Scheduling stale reservation query is invalid."),
      };
    }
    return {
      ok: false,
      statusCode: 400,
      body: buildRuntimeInvalidRequestResponse("Scheduling stale reservation query is invalid."),
    };
  }
}

function parseAndValidateSchedulingAdminReleaseStaleReservationMutationRequest(
  payload: unknown,
):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseSchedulingAdminReleaseStaleReservationRequest>;
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(payload);
  try {
    return {
      ok: true,
      data: parseSchedulingAdminReleaseStaleReservationRequest(bodyRecord),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(
          error.issues[0]?.message ?? "Scheduling stale reservation release payload is invalid.",
        ),
      };
    }
    throw error;
  }
}

function parseAndValidateSchedulingAdminReevaluateDeferredRunsMutationRequest(
  payload: unknown,
):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseSchedulingAdminReevaluateDeferredRunsRequest>;
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(payload);
  try {
    return {
      ok: true,
      data: parseSchedulingAdminReevaluateDeferredRunsRequest(bodyRecord),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(
          error.issues[0]?.message ?? "Scheduling deferred re-evaluation payload is invalid.",
        ),
      };
    }
    throw error;
  }
}

function parseAndValidateAuditLedgerListQuery(searchParams: URLSearchParams):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseAuditEventListQueryFromSearchParams>;
  }
  | {
    readonly ok: false;
    readonly statusCode: number;
    readonly body: AuditLedgerApiResponse<never>;
  } {
  try {
    return {
      ok: true,
      data: parseAuditEventListQueryFromSearchParams(searchParams),
    };
  } catch (error) {
    if (error instanceof AuditEventSchemaValidationError) {
      return {
        ok: false,
        statusCode: 400,
        body: Object.freeze({
          ok: false,
          error: Object.freeze({
            code: AuditLedgerApiErrorCodes.invalidRequest,
            message: "Audit list query is invalid.",
            validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
              path: issue.path,
              code: issue.code,
              message: issue.message,
            }))),
          }),
        }),
      };
    }
    return {
      ok: false,
      statusCode: 400,
      body: buildAuditLedgerInvalidRequestResponse("Audit list query is invalid."),
    };
  }
}

async function parseAndValidateRuntimeMutationBody(
  request: IncomingMessage,
  maxBodyBytes: number,
  allowEmptyBody = false,
): Promise<
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    if (allowEmptyBody && parsedBody.error === "Request body is required.") {
      return {
        ok: true,
        value: Object.freeze({}),
      };
    }
    return {
      ok: false,
      body: buildRuntimeInvalidRequestResponse(parsedBody.error),
    };
  }
  return {
    ok: true,
    value: parsedBody.value,
  };
}

function parseAndValidateRuntimeStartRunMutationRequest(payload: unknown):
  | {
    readonly ok: true;
    readonly data: {
      readonly systemId: string;
      readonly versionId: string;
      readonly executionId?: string;
      readonly tenantId?: string;
      readonly idempotencyKey?: string;
    };
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  try {
    const parsed = parseRuntimeStartRunRequest(payload);
    if (parsed.async === false) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("async must be true when provided."),
      };
    }
    return {
      ok: true,
      data: Object.freeze({
        systemId: parsed.systemId,
        versionId: parsed.versionId,
        executionId: parsed.executionId,
        tenantId: parsed.tenantId,
        idempotencyKey: parsed.idempotencyKey,
      }),
    };
  } catch (error) {
    if (error instanceof SystemRuntimeTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Runtime start payload is invalid."),
      };
    }
    throw error;
  }
}

function parseAndValidateAuthoritativeRunSubmissionMutationRequest(input: {
  readonly payload: unknown;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
}):
  | {
    readonly ok: true;
    readonly data: {
      readonly workflowId?: string;
      readonly workspaceId?: string;
      readonly source?: string;
      readonly submittedByActorId?: string;
      readonly clientRequestId?: string;
      readonly correlationId?: string;
      readonly idempotencyKey?: string;
      readonly runtimeTarget: {
        readonly systemId: string;
        readonly versionId: string;
        readonly executionId?: string;
        readonly tenantId?: string;
        readonly async?: boolean;
      };
      readonly tags?: ReadonlyArray<string>;
      readonly metadata?: Readonly<Record<string, unknown>>;
    };
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  try {
    const parsed = parseRunSubmissionRequest(input.payload);
    if (parsed.runtimeTarget.async === false) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("runtimeTarget.async must be true when provided."),
      };
    }
    if (parsed.workspaceId && parsed.workspaceId !== input.workspaceId) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("submission.workspaceId must match authenticated workspaceId."),
      };
    }
    if (parsed.submittedByActorId && parsed.submittedByActorId !== input.actorUserIdentityId) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("submission.submittedByActorId must match authenticated actor."),
      };
    }

    return {
      ok: true,
      data: Object.freeze({
        ...parsed,
        workspaceId: input.workspaceId,
        submittedByActorId: input.actorUserIdentityId,
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(
          error.issues[0]?.message ?? "Run submission payload is invalid.",
        ),
      };
    }
    throw error;
  }
}

function parseAndValidateAuthoritativeRunExecutionUpdateMutationRequest(input: {
  readonly payload: unknown;
  readonly runId: string;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseRunLifecycleUpdateRequest>;
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(input.payload);
  try {
    const parsed = parseRunLifecycleUpdateRequest({
      ...bodyRecord,
      runId: input.runId,
    });

    if (!parsed.senderNodeId) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("senderNodeId is required."),
      };
    }

    return {
      ok: true,
      data: Object.freeze({
        ...parsed,
        runId: input.runId,
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Run execution update payload is invalid."),
      };
    }
    throw error;
  }
}

function parseAndValidateAuthoritativeRunCancellationMutationRequest(input: {
  readonly payload: unknown;
  readonly runId: string;
  readonly actorUserIdentityId: string;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseRunCancellationRequest>;
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(input.payload);
  try {
    const parsed = parseRunCancellationRequest({
      ...bodyRecord,
      runId: input.runId,
    });

    if (parsed.requestedByActorId && parsed.requestedByActorId !== input.actorUserIdentityId) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("cancellation.requestedByActorId must match authenticated actor."),
      };
    }

    return {
      ok: true,
      data: Object.freeze({
        ...parsed,
        runId: input.runId,
        requestedByActorId: input.actorUserIdentityId,
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Run cancellation payload is invalid."),
      };
    }
    throw error;
  }
}

function parseAndValidateAuthoritativeRunRetryMutationRequest(input: {
  readonly payload: unknown;
  readonly runId: string;
  readonly actorUserIdentityId: string;
}):
  | {
    readonly ok: true;
    readonly data: ReturnType<typeof parseRunRetryRequest>;
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(input.payload);
  try {
    const parsed = parseRunRetryRequest({
      ...bodyRecord,
      runId: input.runId,
    });

    if (parsed.requestedByActorId && parsed.requestedByActorId !== input.actorUserIdentityId) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse("retry.requestedByActorId must match authenticated actor."),
      };
    }

    return {
      ok: true,
      data: Object.freeze({
        ...parsed,
        runId: input.runId,
        requestedByActorId: input.actorUserIdentityId,
      }),
    };
  } catch (error) {
    if (error instanceof RunOrchestrationTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Run retry payload is invalid."),
      };
    }
    throw error;
  }
}

function parseAndValidateRuntimeCancelRunMutationRequest(executionId: string, payload: unknown):
  | {
    readonly ok: true;
    readonly data: {
      readonly executionId: string;
      readonly reason?: string;
      readonly cancelledAt?: string;
      readonly idempotencyKey?: string;
    };
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(payload);
  try {
    const parsed = parseRuntimeCancelRunRequest({
      ...bodyRecord,
      executionId,
    });
    return {
      ok: true,
      data: Object.freeze({
        executionId: parsed.executionId,
        reason: parsed.reason,
        cancelledAt: parsed.cancelledAt,
        idempotencyKey: parsed.idempotencyKey,
      }),
    };
  } catch (error) {
    if (error instanceof SystemRuntimeTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Runtime cancellation payload is invalid."),
      };
    }
    throw error;
  }
}

function parseAndValidateRuntimeDequeueMutationRequest(queueItemId: string, payload: unknown):
  | {
    readonly ok: true;
    readonly data: {
      readonly queueItemId: string;
      readonly reason?: string;
      readonly dequeuedAt?: string;
      readonly idempotencyKey?: string;
    };
  }
  | { readonly ok: false; readonly body: { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } } {
  const bodyRecord = asRecord(payload);
  try {
    const parsed = parseRuntimeDequeueRequest({
      ...bodyRecord,
      queueItemId,
    });
    return {
      ok: true,
      data: Object.freeze({
        queueItemId: parsed.queueItemId,
        reason: parsed.reason,
        dequeuedAt: parsed.dequeuedAt,
        idempotencyKey: parsed.idempotencyKey,
      }),
    };
  } catch (error) {
    if (error instanceof SystemRuntimeTransportSchemaValidationError) {
      return {
        ok: false,
        body: buildRuntimeInvalidRequestResponse(error.issues[0]?.message ?? "Runtime dequeue payload is invalid."),
      };
    }
    throw error;
  }
}

function parseAndValidateAssetPreviewRequest(
  actorUserIdentityId: string,
  workspaceId: string,
  assetId: string,
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly data: ResolveAssetPreviewApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: AssetManagementApiResponse<never> } {
  const preferredMimeTypes = searchParams
    .getAll("preferredMimeType")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return {
    ok: true,
    data: Object.freeze({
      actorUserIdentityId,
      workspaceId,
      assetId,
      versionId: normalizeOptionalString(searchParams.get("versionId")),
      preferredMimeTypes: preferredMimeTypes.length > 0 ? Object.freeze(preferredMimeTypes) : undefined,
      correlationId: normalizeOptionalString(searchParams.get("correlationId")),
      occurredAt: normalizeOptionalString(searchParams.get("occurredAt")),
    }),
  };
}

async function parseAndValidateAssetUploadInitiationRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  assetId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: InitiateAssetUploadApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: AssetManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildAssetManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "asset-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const bodyRecord = asRecord(parsedBody.value);
  if (!bodyRecord) {
    const body = buildAssetManagementInvalidRequestResponse("Request body must be an object.");
    return { ok: false, statusCode: 400, body };
  }

  return {
    ok: true,
    data: Object.freeze({
      ...bodyRecord,
      actorUserIdentityId,
      workspaceId,
      assetId,
    }) as InitiateAssetUploadApiRequest,
  };
}

async function parseAndValidateAssetDownloadAuthorizationRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  assetId: string,
  requestId: string,
  logger: IdentityHttpServerLogger,
  maxBodyBytes: number,
): Promise<
  | { readonly ok: true; readonly data: AuthorizeAssetDownloadApiRequest }
  | { readonly ok: false; readonly statusCode: number; readonly body: AssetManagementApiResponse<never> }
> {
  const parsedBody = await parseJsonBody(request, maxBodyBytes);
  if (!parsedBody.ok) {
    const body = buildAssetManagementInvalidRequestResponse(parsedBody.error);
    logger.warn(Object.freeze({
      event: "asset-management-http.request.invalid-json",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: 400,
    }));
    return { ok: false, statusCode: 400, body };
  }

  const bodyRecord = asRecord(parsedBody.value);
  if (!bodyRecord) {
    const body = buildAssetManagementInvalidRequestResponse("Request body must be an object.");
    return { ok: false, statusCode: 400, body };
  }

  return {
    ok: true,
    data: Object.freeze({
      ...bodyRecord,
      actorUserIdentityId,
      workspaceId,
      assetId,
    }) as AuthorizeAssetDownloadApiRequest,
  };
}

function parseAssetUploadContentRequest(
  request: IncomingMessage,
  actorUserIdentityId: string,
  workspaceId: string,
  uploadSessionId: string,
): IngestAssetUploadContentApiRequest {
  const contentType = normalizeRequestContentType(request.headers["content-type"]);

  return Object.freeze({
    actorUserIdentityId,
    workspaceId,
    uploadSessionId,
    contentType: contentType && contentType.length > 0 ? contentType : undefined,
    content: toRequestBodyStream(request),
  });
}

function buildContentDispositionHeader(
  disposition: "attachment" | "inline",
  fileName: string | undefined,
): string {
  return buildFileContentDispositionHeader(disposition, fileName);
}

function sanitizeDownloadFileName(fileName: string | undefined): string | undefined {
  return sanitizeDownloadFileNamePrimitive(fileName);
}

async function* toRequestBodyStream(request: IncomingMessage): AsyncIterable<Uint8Array> {
  yield* toRequestBodyByteStream(request);
}

async function parseJsonBody(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }> {
  return parseJsonRequestBody(request, maxBodyBytes);
}

function resolveRouteBackendAvailability(
  options: IdentityHttpServerOptions,
): Readonly<Record<AuthoritativeApiRouteBackendKey, boolean>> {
  return Object.freeze({
    [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
    [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: Boolean(options.workspaceBackendApi),
    [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: Boolean(options.workspaceAdministrationBackendApi),
    [AuthoritativeApiRouteBackendKeys.authorizationManagement]: Boolean(options.authorizationManagementBackendApi),
    [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: Boolean(options.deploymentPolicyReadBackendApi),
    [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: Boolean(options.deploymentPolicyWriteBackendApi),
    [AuthoritativeApiRouteBackendKeys.auditLedger]: Boolean(options.auditLedgerBackendApi),
    [AuthoritativeApiRouteBackendKeys.nodeTrust]: Boolean(options.nodeTrustBackendApi),
    [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: Boolean(options.executionNodeManagementBackendApi),
    [AuthoritativeApiRouteBackendKeys.certificateOperations]: Boolean(options.certificateOperationsBackendApi),
    [AuthoritativeApiRouteBackendKeys.secretMetadata]: Boolean(options.secretMetadataBackendApi),
    [AuthoritativeApiRouteBackendKeys.storageManagement]: Boolean(options.storageManagementBackendApi),
    [AuthoritativeApiRouteBackendKeys.assetManagement]: Boolean(
      options.assetManagementBackendApi
      || options.generatedResultManagementBackendApi,
    ),
    [AuthoritativeApiRouteBackendKeys.imageAssetManagement]: Boolean(options.imageAssetManagementBackendApi),
    [AuthoritativeApiRouteBackendKeys.systemRuntime]: Boolean(options.systemRuntimeBackendApi),
    [AuthoritativeApiRouteBackendKeys.runSubmission]: Boolean(options.authoritativeRunSubmissionBackendApi),
    [AuthoritativeApiRouteBackendKeys.runRead]: Boolean(options.authoritativeRunQueryBackendApi),
    [AuthoritativeApiRouteBackendKeys.runMutation]: Boolean(options.authoritativeRunMutationBackendApi),
    [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]:
      Boolean(options.authoritativeRunExecutionUpdateBackendApi && options.nodeTrustBackendApi),
  });
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

function parseOptionalMultiStringList(
  searchParams: URLSearchParams,
  repeatedKey: string,
  csvFallbackKey: string,
): ReadonlyArray<string> | undefined {
  return parseOptionalStringList(searchParams, repeatedKey, csvFallbackKey);
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

function buildRuntimeApiRequestContext(
  context: AuthenticatedWorkspaceRequestContext,
  operation: "read" | "mutation" = "read",
) {
  return Object.freeze({
    trustedInternal: true,
    trustedInternalAuthorization: Object.freeze({
      actorMode: "propagate-caller" as const,
      systemActionId: operation === "mutation"
        ? "identity-http-authoritative-runtime-mutation"
        : "identity-http-authoritative-runtime-read",
    }),
    accessContext: Object.freeze({
      callerKind: "user" as const,
      callerId: context.actor.userIdentityId,
      sessionId: context.session.sessionId,
      metadata: Object.freeze({
        workspaceId: context.workspace.workspaceId,
        activeWorkspaceId: context.workspace.workspaceId,
        authenticatedAt: context.session.issuedAt,
        accessChannel: context.session.accessChannel,
      }),
    }),
  });
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

function decodeImageAssetUploadSessionPath(
  path: string,
  suffix: "/content" | "/complete",
): { readonly assetId: string; readonly uploadSessionId: string } | undefined {
  if (!path.startsWith("/api/v1/image-assets/") || !path.endsWith(suffix)) {
    return undefined;
  }

  const stem = path.slice("/api/v1/image-assets/".length, path.length - suffix.length);
  const [rawAssetId, rawUploadSessionId] = stem.split("/uploads/");
  if (!rawAssetId || !rawUploadSessionId) {
    return undefined;
  }

  const assetId = decodeURIComponent(rawAssetId).trim();
  const uploadSessionId = decodeURIComponent(rawUploadSessionId).trim();
  if (!assetId || !uploadSessionId || assetId.includes("/") || uploadSessionId.includes("/")) {
    return undefined;
  }

  return Object.freeze({
    assetId,
    uploadSessionId,
  });
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

function decodeAuthorizationResourcePath(
  path: string,
  suffix: "/visibility" | "/sharing-grants" | "/access-state",
): { readonly resourceFamily: z.infer<typeof AuthorizationResourceFamilyValues>; readonly resourceType: string; readonly resourceId: string } | undefined {
  const prefix = "/api/v1/authorization/resources/";
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) {
    return undefined;
  }

  const raw = path.slice(prefix.length, path.length - suffix.length);
  const [resourceFamilyRaw, resourceTypeRaw, resourceIdRaw] = raw.split("/");
  const resourceFamily = decodeURIComponent(resourceFamilyRaw ?? "").trim();
  const resourceType = decodeURIComponent(resourceTypeRaw ?? "").trim();
  const resourceId = decodeURIComponent(resourceIdRaw ?? "").trim();

  if (!resourceFamily || !resourceType || !resourceId) {
    return undefined;
  }

  const familyValidation = AuthorizationResourceFamilyValues.safeParse(resourceFamily);
  if (!familyValidation.success) {
    return undefined;
  }

  return Object.freeze({
    resourceFamily: familyValidation.data,
    resourceType,
    resourceId,
  });
}

function decodeAuthorizationResourceAndGrantPath(
  path: string,
): {
  readonly resource: { readonly resourceFamily: z.infer<typeof AuthorizationResourceFamilyValues>; readonly resourceType: string; readonly resourceId: string };
  readonly grantId: string;
} | undefined {
  const prefix = "/api/v1/authorization/resources/";
  const marker = "/sharing-grants/";
  if (!path.startsWith(prefix) || !path.includes(marker)) {
    return undefined;
  }

  const markerIndex = path.indexOf(marker, prefix.length);
  if (markerIndex < 0) {
    return undefined;
  }

  const resourcePath = path.slice(0, markerIndex + marker.length - "/".length);
  const resource = decodeAuthorizationResourcePath(resourcePath, "/sharing-grants");
  if (!resource) {
    return undefined;
  }

  const grantId = decodeURIComponent(path.slice(markerIndex + marker.length)).trim();
  if (!grantId) {
    return undefined;
  }

  return Object.freeze({
    resource,
    grantId,
  });
}

function decodeAuthorizationWorkspaceReportingPath(path: string): string | undefined {
  const prefix = "/api/v1/authorization/reporting/workspaces/";
  if (!path.startsWith(prefix)) {
    return undefined;
  }

  const workspaceId = decodeURIComponent(path.slice(prefix.length)).trim();
  return workspaceId ? workspaceId : undefined;
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

function buildAuthorizationManagementInvalidRequestResponse(message: string): AuthorizationManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: AuthorizationManagementApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildNodeTrustInvalidRequestResponse(message: string): NodeTrustApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: NodeTrustApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildExecutionNodeManagementInvalidRequestResponse(
  message: string,
): ExecutionNodeManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: ExecutionNodeManagementApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildExecutionNodeManagementValidationErrorResponse(
  error: unknown,
): ExecutionNodeManagementApiResponse<never> {
  if (error instanceof ExecutionNodeManagementApiSchemaValidationError) {
    return Object.freeze({
      ok: false,
      error: {
        code: ExecutionNodeManagementApiErrorCodes.invalidRequest,
        message: "Request validation failed.",
        validationErrors: Object.freeze(error.issues.map((issue) => Object.freeze({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        }))),
      },
    });
  }

  return buildExecutionNodeManagementInvalidRequestResponse("Request validation failed.");
}

function buildCertificateOperationsInvalidRequestResponse(message: string): CertificateOperationsApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: CertificateOperationsApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildSecretMetadataInvalidRequestResponse(message: string): SecretMetadataApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: SecretMetadataApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildStorageManagementInvalidRequestResponse(message: string): StorageManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: StorageManagementApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildAssetManagementInvalidRequestResponse(message: string): AssetManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: AssetManagementApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildImageAssetManagementInvalidRequestResponse(message: string): ImageAssetManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: ImageAssetManagementApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildGeneratedResultManagementInvalidRequestResponse(message: string): GeneratedResultManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: GeneratedResultManagementApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildAuditLedgerInvalidRequestResponse(message: string): AuditLedgerApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: AuditLedgerApiErrorCodes.invalidRequest,
      message,
    },
  });
}

function buildRuntimeInvalidRequestResponse(message: string): {
  readonly ok: false;
  readonly error: {
    readonly code: "invalid-request";
    readonly message: string;
  };
} {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: "invalid-request" as const,
      message,
    }),
  });
}

function buildRouteFamilyCapabilityUnavailableResponse(input: {
  readonly routeFamilyId: string;
  readonly capabilityId?: string;
}): IdentityAuthApiResponse<never> {
  const capabilityDescription = input.capabilityId
    ? `Capability '${input.capabilityId}'`
    : "Required capability";
  return Object.freeze({
    ok: false,
    error: {
      code: IdentityAuthApiErrorCodes.forbidden,
      message: `${capabilityDescription} is not available for route family '${input.routeFamilyId}'.`,
    },
  });
}

function buildAssetManagementInternalErrorResponse(message: string): AssetManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: AssetManagementApiErrorCodes.internal,
      message,
    },
  });
}

function buildImageAssetManagementInternalErrorResponse(message: string): ImageAssetManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: ImageAssetManagementApiErrorCodes.internal,
      message,
    },
  });
}

function buildGeneratedResultManagementInternalErrorResponse(
  message: string,
): GeneratedResultManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: GeneratedResultManagementApiErrorCodes.internal,
      message,
    },
  });
}

function buildNodeTrustForbiddenResponse(message: string): NodeTrustApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: NodeTrustApiErrorCodes.forbidden,
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

function buildWorkspaceAdministrationQueryValidationError(
  path: string,
  message: string,
): WorkspaceAdministrationApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: WorkspaceAdministrationApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze([Object.freeze({
        path,
        code: "invalid_enum_value",
        message,
      })]),
    },
  });
}

function buildNodeTrustQueryValidationError(path: string, message: string): NodeTrustApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: NodeTrustApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze([Object.freeze({
        path,
        code: "invalid_enum_value",
        message,
      })]),
    },
  });
}

function buildStorageManagementQueryValidationError(
  path: string,
  message: string,
): StorageManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: StorageManagementApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze([Object.freeze({
        path,
        code: "invalid_enum_value",
        message,
      })]),
    },
  });
}

function buildStorageManagementValidationErrors(
  issues: ReadonlyArray<{ readonly path: string; readonly code: string; readonly message: string }>,
): StorageManagementApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: StorageManagementApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze(issues.map((issue) => Object.freeze({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      }))),
    },
  });
}

function buildCertificateOperationsQueryValidationError(
  path: string,
  message: string,
): CertificateOperationsApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: CertificateOperationsApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze([Object.freeze({
        path,
        code: "invalid_enum_value",
        message,
      })]),
    },
  });
}

function buildSecretMetadataValidationErrors(issues: ReadonlyArray<z.ZodIssue>): SecretMetadataApiResponse<never> {
  return Object.freeze({
    ok: false,
    error: {
      code: SecretMetadataApiErrorCodes.invalidRequest,
      message: "Request validation failed.",
      validationErrors: Object.freeze(issues.map((issue) => Object.freeze({
        path: issue.path.length > 0 ? issue.path.join(".") : "payload",
        code: issue.code,
        message: issue.message,
      }))),
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parseWebSocketSubprotocolHeader(headerValue: string | string[] | undefined): ReadonlyArray<string> {
  if (!headerValue) {
    return Object.freeze([]);
  }

  const combined = Array.isArray(headerValue) ? headerValue.join(",") : headerValue;
  return Object.freeze(
    combined
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function extractWebSocketBearerTokenFromSubprotocols(subprotocols: ReadonlyArray<string>): string | undefined {
  const encodedToken = subprotocols
    .find((value) => value.startsWith(RuntimeRealtimeWebSocketAuthSubprotocolPrefix))
    ?.slice(RuntimeRealtimeWebSocketAuthSubprotocolPrefix.length);
  if (!encodedToken) {
    return undefined;
  }

  return decodeBase64UrlToUtf8(encodedToken);
}

function resolveAcceptedWebSocketSubprotocol(subprotocols: ReadonlyArray<string>): string | undefined {
  const runtimeRealtimeProtocol = subprotocols.find((value) => value === RuntimeRealtimeWebSocketSubprotocol);
  return runtimeRealtimeProtocol || undefined;
}

function decodeBase64UrlToUtf8(value: string): string | undefined {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8").trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
}

function logResponse<TRequest extends Record<string, unknown>>(
  logger: IdentityHttpServerLogger,
  requestId: string,
  request: IncomingMessage,
  statusCode: number,
  requestPayload: TRequest,
  responsePayload: unknown,
): void {
  const correlationId = resolveRequestCorrelationId(request, requestId);
  const event = Object.freeze({
    event: "identity-http.request.completed",
    requestId,
    correlationId,
    method: request.method,
    path: resolveCanonicalRequestPath(request.url),
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

function isRootReadinessProbeRequest(method: string | undefined, path: string): boolean {
  return method === "GET" && path === "/";
}

function resolveRuntimeCapabilityGuardRouteFamilyId(input: {
  readonly method: string | undefined;
  readonly path: string;
  readonly matchedRouteFamilyId: string;
}): string {
  const method = input.method?.toUpperCase();
  if (!method) {
    return input.matchedRouteFamilyId;
  }

  if (method === "POST" && input.path === RunOrchestrationTransportRoutes.submitRun) {
    return "run-submission";
  }
  if (method === "POST" && input.path.startsWith("/api/v1/image-systems/") && input.path.endsWith("/runs")) {
    return "image-run-api";
  }

  if (method === "GET" && input.path === RunOrchestrationTransportRoutes.listRuns) {
    return "run-read";
  }
  if (method === "GET" && input.path === RunOrchestrationTransportRoutes.getExecutionReadiness) {
    return "run-read";
  }
  if (method === "GET" && input.path === RunOrchestrationTransportRoutes.listQueueStatus) {
    return "run-read";
  }
  if (method === "GET" && input.path === ImageRunApiRoutes.listRuns) {
    return "image-run-api";
  }
  if (
    method === "GET"
    && input.path.startsWith("/api/v1/image-runs/")
    && !input.path.endsWith("/status")
    && !input.path.endsWith("/cancel")
    && !input.path.endsWith("/events")
    && !input.path.endsWith("/generated-results")
  ) {
    return "image-run-api";
  }
  if (method === "POST" && input.path.startsWith("/api/v1/image-runs/") && input.path.endsWith("/cancel")) {
    return "image-run-api";
  }

  if (method === "POST" && input.path.startsWith("/api/v1/runtime/runs/") && input.path.endsWith("/cancel")) {
    return "run-mutation";
  }
  if (method === "POST" && input.path.startsWith("/api/v1/runtime/runs/") && input.path.endsWith("/retry")) {
    return "run-mutation";
  }
  if (method === "POST" && input.path.startsWith("/api/v1/runtime/runs/") && input.path.endsWith("/lifecycle")) {
    return "run-execution-update";
  }

  if (
    method === "GET"
    && input.path.startsWith("/api/v1/runtime/runs/")
    && !input.path.endsWith("/status")
    && !input.path.endsWith("/result")
    && !input.path.endsWith("/trace")
    && !input.path.endsWith("/cancel")
    && !input.path.endsWith("/retry")
    && !input.path.endsWith("/lifecycle")
    && !input.path.endsWith("/start")
  ) {
    return "run-read";
  }
  if (method === "GET" && input.path.startsWith("/api/v1/runtime/runs/") && input.path.endsWith("/status")) {
    return "run-read";
  }
  if (method === "GET" && input.path.startsWith("/api/v1/runtime/runs/") && input.path.endsWith("/result")) {
    return "system-runtime";
  }
  if (method === "GET" && input.path.startsWith("/api/v1/runtime/runs/") && input.path.endsWith("/trace")) {
    return "system-runtime";
  }
  if (method === "POST" && input.path.startsWith("/api/v1/runtime/queue/") && input.path.endsWith("/dequeue")) {
    return "system-runtime";
  }

  return input.matchedRouteFamilyId;
}

function resolveCanonicalRequestPath(requestUrl: string | undefined): string {
  return resolveRequestUrl(requestUrl).pathname;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveText(error.message);
  }
  return "Unknown error";
}

function createObservedIdentityHttpServerLogger(
  delegate: IdentityHttpServerLogger,
  onOperationalEvent: ((event: IdentityHttpServerLogEvent) => void) | undefined,
): IdentityHttpServerLogger {
  const emit = (level: "info" | "warn" | "error", event: IdentityHttpServerLogEvent) => {
    const sanitized = sanitizeIdentityHttpServerLogEvent(event);
    try {
      if (level === "info") {
        delegate.info(sanitized);
      } else if (level === "warn") {
        delegate.warn(sanitized);
      } else {
        delegate.error(sanitized);
      }
    } catch {
      // Keep request handling resilient even if external logger integration fails.
    }
    if (!onOperationalEvent) {
      return;
    }
    try {
      onOperationalEvent(sanitized);
    } catch {
      // Keep request handling resilient even if observability hook integration fails.
    }
  };

  return Object.freeze({
    info: (event) => emit("info", event),
    warn: (event) => emit("warn", event),
    error: (event) => emit("error", event),
  });
}

function sanitizeIdentityHttpServerLogEvent(event: IdentityHttpServerLogEvent): IdentityHttpServerLogEvent {
  return Object.freeze({
    ...event,
    details: redactSensitiveAuthPayload(event.details) as Readonly<Record<string, unknown>> | undefined,
  });
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const correlationHeader = response.getHeader(CORRELATION_ID_HEADER);
  const normalizedPayload = addCorrelationIdToErrorEnvelope(
    normalizeSharedApiErrorEnvelope(payload),
    normalizeResponseHeaderValue(correlationHeader),
  );
  writeJsonResponse(response, statusCode, normalizedPayload);
}

function writeNoContent(response: ServerResponse, statusCode: number): void {
  writeNoContentResponse(response, statusCode);
}

function resolveSessionActorContextWorkspaceId(
  requestedWorkspaceId: string | undefined,
  workspaces: ReadonlyArray<ResolveSessionActorWorkspaceContextApiRecord>,
): string | undefined {
  if (!requestedWorkspaceId) {
    return workspaces[0]?.workspaceId;
  }

  const matched = workspaces.find((workspace) => workspace.workspaceId === requestedWorkspaceId);
  return matched?.workspaceId ?? workspaces[0]?.workspaceId;
}

class ConsoleIdentityHttpServerLogger implements IdentityHttpServerLogger {
  public info(event: IdentityHttpServerLogEvent): void {
    console.info(`${JSON.stringify(event)}\n`);
  }

  public warn(event: IdentityHttpServerLogEvent): void {
    console.warn(`${JSON.stringify(event)}\n`);
  }

  public error(event: IdentityHttpServerLogEvent): void {
    console.error(`${JSON.stringify(event)}\n`);
  }
}



