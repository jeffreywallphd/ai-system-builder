import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createServer as createHttpsServer } from "node:https";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  createAuthProvider,
} from "@domain/identity/IdentityDomain";
import { IdentityIdNamespaces, type IdentityIdNamespace } from "@application/contracts/IdentityApplicationContracts";
import { IdentityPolicyService } from "@application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "@application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentitySessionLifecycleService } from "@application/identity/services/IdentitySessionLifecycleService";
import { IdentityAuthenticatedSessionService } from "@application/identity/services/IdentityAuthenticatedSessionService";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "@application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "@application/identity/ports/IIdentityLifecycleEventPublisher";
import { RegisterLocalAccountUseCase } from "@application/identity/use-cases/RegisterLocalAccountUseCase";
import { LoginLocalAccountUseCase } from "@application/identity/use-cases/LoginLocalAccountUseCase";
import { ChangeLocalPasswordCredentialUseCase } from "@application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import { LogoutIdentitySessionUseCase } from "@application/identity/use-cases/LogoutIdentitySessionUseCase";
import { RevokeIdentitySessionUseCase } from "@application/identity/use-cases/RevokeIdentitySessionUseCase";
import { ListLocalIdentityAccountsUseCase } from "@application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import { GetLocalIdentityAccountStatusUseCase } from "@application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import { SetLocalIdentityAccountStatusUseCase } from "@application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import { ScryptLocalPasswordCredentialService } from "@infrastructure/security/identity/ScryptLocalPasswordCredentialService";
import { OpaqueIdentitySessionTokenService } from "@infrastructure/security/identity/OpaqueIdentitySessionTokenService";
import { IdentityAuthBackendApi } from "@infrastructure/api/identity/IdentityAuthBackendApi";
import { IdentitySessionPolicyConfig } from "@infrastructure/config/IdentitySessionPolicyConfig";
import { IdentitySessionTrustPolicyConfig } from "@infrastructure/config/IdentitySessionTrustPolicyConfig";
import { IdentityProviderAccountPolicyConfig } from "@infrastructure/config/IdentityProviderAccountPolicyConfig";
import { resolveAuditRetentionLifecycleConfig } from "@infrastructure/config/AuditRetentionLifecycleConfig";
import {
  HostSecureTransportKinds,
  resolveHostSecureTransportConfig,
} from "@infrastructure/config/HostSecureTransportConfig";
import { SqliteIdentityPersistenceAdapter } from "@infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter";
import { SqliteTrustedDevicePersistenceAdapter } from "@infrastructure/persistence/identity/SqliteTrustedDevicePersistenceAdapter";
import { TrustedDeviceManagementService } from "@application/identity/services/TrustedDeviceManagementService";
import { TrustedDevicePairingService } from "@application/identity/services/TrustedDevicePairingService";
import { TrustedDeviceSessionTrustService } from "@application/identity/services/TrustedDeviceSessionTrustService";
import { ListTrustedDevicesUseCase } from "@application/identity/use-cases/ListTrustedDevicesUseCase";
import { GetTrustedDeviceUseCase } from "@application/identity/use-cases/GetTrustedDeviceUseCase";
import { RevokeTrustedDeviceUseCase } from "@application/identity/use-cases/RevokeTrustedDeviceUseCase";
import { UpdateTrustedDeviceDisplayNameUseCase } from "@application/identity/use-cases/UpdateTrustedDeviceDisplayNameUseCase";
import { InitiateTrustedDevicePairingUseCase } from "@application/identity/use-cases/InitiateTrustedDevicePairingUseCase";
import { ValidateTrustedDevicePairingUseCase } from "@application/identity/use-cases/ValidateTrustedDevicePairingUseCase";
import { CompleteTrustedDevicePairingUseCase } from "@application/identity/use-cases/CompleteTrustedDevicePairingUseCase";
import { SqliteIdentityLifecycleEventPublisher } from "@infrastructure/persistence/identity/SqliteIdentityLifecycleEventPublisher";
import {
  FanoutIdentityLifecycleEventPublisher,
  FanoutStorageManagementAuditSink,
  FanoutAssetAuditSink,
  FanoutNodeTrustAuditSink,
  FanoutRunSubmissionAuditSink,
  FanoutDeploymentPolicyGovernanceEventSink,
} from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeIdentityLifecycleEventPublisher } from "@infrastructure/audit/AuthoritativeIdentityLifecycleEventPublisher";
import { AuthoritativeNodeTrustAuditSink } from "@infrastructure/audit/AuthoritativeNodeTrustAuditSink";
import { AuthoritativeAuthorizationPolicyEventRecorder } from "@infrastructure/audit/AuthoritativeAuthorizationPolicyEventRecorder";
import { AuthoritativeStorageManagementAuditSink } from "@infrastructure/audit/AuthoritativeStorageManagementAuditSink";
import { AuthoritativeProtectedAssetAuditSink } from "@infrastructure/audit/AuthoritativeProtectedAssetAuditSink";
import { AuthoritativeImageAssetAuditSink } from "@infrastructure/audit/AuthoritativeImageAssetAuditSink";
import { AuthoritativeRunSubmissionAuditSink } from "@infrastructure/audit/AuthoritativeRunSubmissionAuditSink";
import { AuthoritativeDeploymentPolicyGovernanceEventSink } from "@infrastructure/audit/AuthoritativeDeploymentPolicyGovernanceEventSink";
import {
  composeBestEffortSecretAuditHooks,
  createAuthoritativeSecretAccessAuditHook,
} from "@infrastructure/audit/AuthoritativeSecretAccessAuditHook";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { AuditLedgerQueryService } from "@application/audit/use-cases/AuditLedgerQueryService";
import { WorkspaceAuditLedgerReadAuthorizer } from "@application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer";
import { ReconcileAuditLedgerStartupStateUseCase } from "@application/audit/use-cases/ReconcileAuditLedgerStartupStateUseCase";
import { WorkspaceInvitationBackendApi } from "@infrastructure/api/workspaces/WorkspaceInvitationBackendApi";
import { WorkspaceAdministrationBackendApi } from "@infrastructure/api/workspaces/WorkspaceAdministrationBackendApi";
import { AuthorizationManagementBackendApi } from "@infrastructure/api/authorization/AuthorizationManagementBackendApi";
import { AuditLedgerBackendApi } from "@infrastructure/api/audit/AuditLedgerBackendApi";
import { AuditLedgerObservability } from "@infrastructure/api/audit/AuditLedgerObservability";
import { NodeTrustBackendApi } from "@infrastructure/api/nodes/NodeTrustBackendApi";
import { CertificateOperationsBackendApi } from "@infrastructure/api/security/CertificateOperationsBackendApi";
import { SecretMetadataBackendApi } from "@infrastructure/api/security/SecretMetadataBackendApi";
import { StorageManagementBackendApi } from "@infrastructure/api/storage/StorageManagementBackendApi";
import { WorkspaceAwareStoragePolicyEvaluationAdapter } from "@infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter";
import { AssetManagementBackendApi } from "@infrastructure/api/assets/AssetManagementBackendApi";
import { ImageAssetManagementBackendApi } from "@infrastructure/api/image-assets/ImageAssetManagementBackendApi";
import { ImageAssetManagementObservability } from "@infrastructure/api/image-assets/ImageAssetManagementObservability";
import { AuthoritativeRunSubmissionBackendApi } from "@infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi";
import { AuthoritativeRunQueryBackendApi } from "@infrastructure/api/runs/AuthoritativeRunQueryBackendApi";
import { AuthoritativeRunMutationBackendApi } from "@infrastructure/api/runs/AuthoritativeRunMutationBackendApi";
import { AuthoritativeRunExecutionUpdateBackendApi } from "@infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi";
import { DeploymentPolicyReadBackendApi } from "@infrastructure/api/deployment/DeploymentPolicyReadBackendApi";
import { DeploymentPolicyWriteBackendApi } from "@infrastructure/api/deployment/DeploymentPolicyWriteBackendApi";
import { PlatformDeploymentPolicyAdministrationObservabilityPort } from "@infrastructure/api/deployment/PlatformDeploymentPolicyAdministrationObservabilityPort";
import { PlatformDeploymentPolicyGovernanceEventSink } from "@infrastructure/api/deployment/PlatformDeploymentPolicyGovernanceEventSink";
import { WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService } from "@infrastructure/api/deployment/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService";
import { RunOrchestrationObservability } from "@infrastructure/api/runs/RunOrchestrationObservability";
import { AssetBackedRunSubmissionTargetResolver } from "@infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver";
import { PlatformRunSubmissionAuditSink } from "@infrastructure/api/runs/PlatformRunSubmissionAuditSink";
import { StorageSyncDeploymentAvailabilities } from "@infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter";
import { SqliteWorkspacePersistenceAdapter } from "@infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import { WorkspaceAuthorizationPolicyReadAdapter } from "@infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter";
import { SqliteAuthorizationPersistenceAdapter } from "@infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "@infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";
import { SqliteNodeTrustPersistenceAdapter } from "@infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import { SqliteCertificateAuthorityPersistenceAdapter } from "@infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import { SqliteStorageInstancePersistenceAdapter } from "@infrastructure/persistence/storage/SqliteStorageInstancePersistenceAdapter";
import { SqliteStorageManagementAuditRecorder } from "@infrastructure/persistence/storage/SqliteStorageManagementAuditRecorder";
import { SqliteAssetPersistenceAdapter } from "@infrastructure/persistence/assets/SqliteAssetPersistenceAdapter";
import { SqliteAssetAuditRecorder } from "@infrastructure/persistence/assets/SqliteAssetAuditRecorder";
import { SqliteAssetUploadSessionPersistenceAdapter } from "@infrastructure/persistence/assets/SqliteAssetUploadSessionPersistenceAdapter";
import { SqliteImageAssetPersistenceAdapter } from "@infrastructure/persistence/image-assets/SqliteImageAssetPersistenceAdapter";
import {
  createAuthoritativePersistentPlatformServices,
  type AuthoritativePersistentPlatformServices,
} from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { StorageManagementService } from "@application/storage/use-cases/StorageManagementService";
import { AssetUploadInitiationService } from "@application/assets/use-cases/AssetUploadInitiationService";
import { AssetGeneratedOutputRegistrationService } from "@application/assets/use-cases/AssetGeneratedOutputRegistrationService";
import { AssetUploadIngestionService } from "@application/assets/use-cases/AssetUploadIngestionService";
import { AssetDiscoveryService } from "@application/assets/use-cases/AssetDiscoveryService";
import { AssetDetailService } from "@application/assets/use-cases/AssetDetailService";
import { AssetDownloadService } from "@application/assets/use-cases/AssetDownloadService";
import { AssetPreviewService } from "@application/assets/use-cases/AssetPreviewService";
import { AssetLifecycleService } from "@application/assets/use-cases/AssetLifecycleService";
import { FinalizeImageAssetUploadUseCase } from "@application/image-assets/use-cases/FinalizeImageAssetUploadUseCase";
import { GetImageAssetMetadataUseCase } from "@application/image-assets/use-cases/GetImageAssetMetadataUseCase";
import { GetImageAssetOriginalContentUseCase } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCase";
import { OpenImageAssetPreviewContentUseCase } from "@application/image-assets/use-cases/OpenImageAssetPreviewContentUseCase";
import { RequestImageAssetPreviewContentUseCase } from "@application/image-assets/use-cases/RequestImageAssetPreviewContentUseCase";
import { InitiateImageAssetCreationUseCase } from "@application/image-assets/use-cases/InitiateImageAssetCreationUseCase";
import { ListImageAssetMetadataUseCase } from "@application/image-assets/use-cases/ListImageAssetMetadataUseCase";
import { StorageLogicalAccessResolutionService } from "@application/storage/use-cases/StorageLogicalAccessResolutionService";
import { EncryptionPolicyEvaluationService } from "@application/security/use-cases/EncryptionPolicyEvaluationService";
import { EncryptionKeyResolutionService } from "@application/security/use-cases/EncryptionKeyResolutionService";
import { StorageBackendProvisioningOrchestrator } from "@infrastructure/storage/StorageBackendProvisioningOrchestrator";
import { createStorageBackendAdapterRegistry } from "@infrastructure/storage/StorageBackendAdapterRegistry";
import {
  ServerManagedLocalStorageBackendAdapter,
  ServerManagedLocalStorageObjectAdapter,
} from "@infrastructure/storage/local";
import { ServerManagedStorageSynchronizationAdapter } from "@infrastructure/storage/sync/ServerManagedStorageSynchronizationAdapter";
import { ManagedImageAssetStorageAdapter } from "@infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter";
import { EncryptedAssetDownloadGrantAdapter } from "@infrastructure/security/assets/EncryptedAssetDownloadGrantAdapter";
import { AesGcmAssetContentCipherPort } from "@infrastructure/security/encryption/AesGcmAssetContentCipherPort";
import { DeterministicScopeEncryptionKeyPort } from "@infrastructure/security/encryption/DeterministicScopeEncryptionKeyPort";
import { WorkspaceStorageEncryptionPolicyContextResolver } from "@infrastructure/security/encryption/WorkspaceStorageEncryptionPolicyContextResolver";
import {
  assertCertificateAuthorityStartupSafe,
  ResolveCertificateAuthorityStartupStateUseCase,
} from "@application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase";
import {
  InitializeCertificateAuthorityUseCase,
  type InitializeCertificateAuthorityUseCaseInput,
  type InitializeCertificateAuthorityUseCaseResult,
  type CertificateAuthorityInitializationAuditEvent,
} from "@application/security/use-cases/InitializeCertificateAuthorityUseCase";
import type { HostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import {
  EnvironmentCertificateAuthorityBootstrapConfigurationProvider,
  EnvironmentCertificateAuthoritySecretService,
} from "@infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter";
import { ServerManagedTransportTrustStateResolver } from "@infrastructure/security/ServerManagedTransportTrustStateResolver";
import { TransportSecurityObservabilityReporter } from "@infrastructure/security/TransportSecurityObservabilityReporter";
import { EncryptionEnforcementObservabilityReporter } from "@infrastructure/security/EncryptionEnforcementObservabilityReporter";
import { createFileSystemProtectedSecretStoreFromEnvironment } from "@infrastructure/security/secrets/FileSystemProtectedSecretStore";
import { composeServerSecretService, type ServerComposedSecretService } from "@infrastructure/security/secrets/SecretServiceComposition";
import { SecretServiceOperationalDiagnosticsProvider } from "@infrastructure/security/secrets/SecretServiceOperationalDiagnostics";
import { ServerPlatformSecretConsumers } from "@infrastructure/security/secrets/ServerPlatformSecretConsumers";
import { assertSystemSecretBootstrapSafe } from "@infrastructure/security/secrets/SystemSecretBootstrapService";
import type { ICertificateAuthorityIssuerPort } from "@application/security/ports/ICertificateAuthorityIssuerPort";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "@infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage";
import { RuntimeTrustMaterialDistributionService } from "@infrastructure/security/certificates/RuntimeTrustMaterialDistributionService";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "@application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import { ResolveCertificateRevocationStatusUseCase } from "@application/security/use-cases/ResolveCertificateRevocationStatusUseCase";
import { ValidateTransportConnectionTrustUseCase } from "@application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import { GetCertificateAuthorityStatusIntrospectionUseCase } from "@application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import { ListIssuedCertificateMetadataUseCase } from "@application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import { GetIssuedCertificateMetadataUseCase } from "@application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import { RevokeIssuedCertificateUseCase } from "@application/security/use-cases/RevokeIssuedCertificateUseCase";
import { RenewIssuedCertificateUseCase } from "@application/security/use-cases/RenewIssuedCertificateUseCase";
import { TrustMaterialKinds } from "@domain/security/CertificateAuthorityDomain";
import { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { ValidateRunSubmissionUseCase } from "@application/runs/use-cases/ValidateRunSubmissionUseCase";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { SubmitImageRunUseCase } from "@application/runs/use-cases/SubmitImageRunUseCase";
import { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import { ListStaleSchedulingReservationsUseCase } from "@application/runs/use-cases/ListStaleSchedulingReservationsUseCase";
import { IngestRunExecutionUpdateUseCase } from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import { ReevaluateDeferredSchedulingRunsUseCase } from "@application/runs/use-cases/ReevaluateDeferredSchedulingRunsUseCase";
import { ReleaseStaleSchedulingReservationUseCase } from "@application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase";
import { RequestAuthoritativeRunCancellationUseCase } from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import { RequestAuthoritativeRunRetryUseCase } from "@application/runs/use-cases/RequestAuthoritativeRunRetryUseCase";
import { RecoverRunOrchestrationStartupStateUseCase } from "@application/runs/use-cases/RecoverRunOrchestrationStartupStateUseCase";
import { ReadDeploymentPolicyAdministrationUseCase } from "@application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase";
import { DeploymentPolicyAdministrationAuthoritativeUpdateUseCase } from "@application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import { AuthorizationPolicyMutationService } from "@application/authorization/use-cases/AuthorizationPolicyMutationService";
import { GrantAuthorizationSharingAccessUseCase } from "@application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import { GetImageManipulationExecutionReadinessUseCase } from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "@application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "@application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "@application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "@application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import {
  IssueWorkspaceInvitationUseCase,
  type WorkspaceInvitationIssuanceClock,
  type WorkspaceInvitationIssuanceIdGenerator,
  Sha256WorkspaceInvitationTokenIssuer,
} from "@application/workspaces/use-cases/IssueWorkspaceInvitationUseCase";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  type WorkspaceInvitationLifecycleClock,
  type WorkspaceInvitationLifecycleIdGenerator,
} from "@application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  type AuthenticatedWorkspaceOnboardingClock,
} from "@application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";
import { WorkspaceAdministrationQueryService } from "@application/workspaces/use-cases/WorkspaceAdministrationQueryService";
import { CreateWorkspaceUseCase } from "@application/workspaces/use-cases/CreateWorkspaceUseCase";
import { UpdateWorkspaceUseCase } from "@application/workspaces/use-cases/UpdateWorkspaceUseCase";
import { TransitionWorkspaceLifecycleUseCase } from "@application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase";
import { AddWorkspaceMemberUseCase } from "@application/workspaces/use-cases/AddWorkspaceMemberUseCase";
import { ChangeWorkspaceMembershipStatusUseCase } from "@application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase";
import { RemoveWorkspaceMemberUseCase } from "@application/workspaces/use-cases/RemoveWorkspaceMemberUseCase";
import { AssignWorkspaceRoleUseCase } from "@application/workspaces/use-cases/AssignWorkspaceRoleUseCase";
import { ReassignWorkspaceRoleUseCase } from "@application/workspaces/use-cases/ReassignWorkspaceRoleUseCase";
import { RevokeWorkspaceRoleUseCase } from "@application/workspaces/use-cases/RevokeWorkspaceRoleUseCase";
import { ApproveNodeEnrollmentUseCase } from "@application/nodes/use-cases/ApproveNodeEnrollmentUseCase";
import { GetNodeInventoryDetailUseCase } from "@application/nodes/use-cases/GetNodeInventoryDetailUseCase";
import { GetNodeEnrollmentDetailUseCase } from "@application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { ListNodeInventoryUseCase } from "@application/nodes/use-cases/ListNodeInventoryUseCase";
import { ListTrustedNodeInventoryUseCase } from "@application/nodes/use-cases/ListTrustedNodeInventoryUseCase";
import { RecordNodeHeartbeatUseCase } from "@application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RecordNodeOperationalUpdateUseCase } from "@application/nodes/use-cases/RecordNodeOperationalUpdateUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "@application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "@application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ResolveApprovedNodeCertificateEligibilityUseCase } from "@application/nodes/use-cases/ResolveApprovedNodeCertificateEligibilityUseCase";
import { ResolveApprovedNodeRuntimeTrustMaterialUseCase } from "@application/nodes/use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase";
import { ResolveNodeMutualTlsTransportIdentityUseCase } from "@application/nodes/use-cases/ResolveNodeMutualTlsTransportIdentityUseCase";
import { RevokeNodeTrustUseCase } from "@application/nodes/use-cases/RevokeNodeTrustUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "@application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import { InternalCertificateAuthorityIssuer } from "@infrastructure/security/ca/InternalCertificateAuthorityIssuer";
import {
  HttpTransportTrustValidationAdapter,
  WebSocketTransportTrustValidationAdapter,
} from "@infrastructure/transport/TransportTrustValidationAdapters";
import type { WorkspaceIdNamespace } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";
import {
  createIdentityHttpServer,
  type IdentityHttpServerFactory,
  type IdentityHttpServerLogger,
} from "@infrastructure/transport/http-server/identity/IdentityHttpServer";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import type { AuthoritativeRunExecutionAdapterRegistration } from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import type { IdentitySessionLifecyclePolicies } from "@application/identity/services/IdentitySessionLifecycleService";
import type { AuthProvider, CredentialPolicy } from "@domain/identity/IdentityDomain";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
} from "@application/security/ports/TransportSecurityPorts";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";

export interface IdentityServerHostOptions {
  readonly databasePath: string;
  readonly port?: number;
  readonly host?: string;
  readonly deploymentProfile?: HostDeploymentProfile;
  readonly deploymentPolicyBootstrap?: DeploymentPolicyBootstrapResolutionResult;
  readonly cors?: {
    readonly enabled?: boolean;
    readonly allowedOrigins?: ReadonlyArray<string>;
    readonly allowLoopbackOrigins?: boolean;
    readonly allowNullOrigin?: boolean;
    readonly allowedMethods?: ReadonlyArray<string>;
    readonly allowedHeaders?: ReadonlyArray<string>;
    readonly maxAgeSeconds?: number;
  };
  readonly logger?: IdentityHttpServerLogger;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly sessionPolicies?: IdentitySessionLifecyclePolicies;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
  readonly providerAccountPolicies?: IdentityProviderAccountPolicyConfig;
  readonly persistentPlatformServices?: AuthoritativePersistentPlatformServices;
  readonly routeRegistrationPlan?: AuthoritativeApiRouteRegistrationPlan;
  readonly runExecutionAdapters?: AuthoritativeRunExecutionAdapterRegistration;
}

export interface IdentityServerHost {
  readonly port: number;
  readonly address: string;
  readonly secretService: ServerComposedSecretService;
  readonly platformSecretConsumers: ServerPlatformSecretConsumers;
  close(): Promise<void>;
}

export interface InitializeCertificateAuthorityForFirstSetupOptions {
  readonly databasePath: string;
  readonly issuer: ICertificateAuthorityIssuerPort;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly auditHook?: (event: CertificateAuthorityInitializationAuditEvent) => Promise<void> | void;
}

interface ManagedIdentityServerTlsRuntimeMaterial {
  readonly certPem: string;
  readonly keyPem: string;
  readonly caPem?: string;
}

const MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS = Object.freeze({
  enabled: "AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED",
  targetReferenceId: "AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID",
  actorUserIdentityId: "AI_LOOM_INTERNAL_CA_SERVER_TLS_ACTOR_USER_IDENTITY_ID",
  workspaceId: "AI_LOOM_INTERNAL_CA_SERVER_TLS_WORKSPACE_ID",
  certificateAuthorityId: "AI_LOOM_INTERNAL_CA_SERVER_TLS_CERTIFICATE_AUTHORITY_ID",
  serialNumber: "AI_LOOM_INTERNAL_CA_SERVER_TLS_SERIAL_NUMBER",
  privateKeyMaterialRef: "AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF",
});

interface IdentityDefaultConfigurationRepository {
  saveAuthProvider(provider: AuthProvider): Promise<AuthProvider>;
  saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy>;
}

class SystemIdentityClock implements IIdentityClock {
  public now(): Date {
    return new Date();
  }
}

class RandomIdentityIdGenerator implements IIdentityIdGenerator {
  public nextId(namespace: IdentityIdNamespace): string {
    return `${normalizeNamespace(namespace)}:${randomUUID()}`;
  }
}

class SystemWorkspaceClock
  implements WorkspaceInvitationIssuanceClock, WorkspaceInvitationLifecycleClock, AuthenticatedWorkspaceOnboardingClock {
  public now(): Date {
    return new Date();
  }
}

class RandomWorkspaceIdGenerator
  implements WorkspaceInvitationIssuanceIdGenerator, WorkspaceInvitationLifecycleIdGenerator {
  public nextId(namespace: WorkspaceIdNamespace): string {
    return `${namespace}:${randomUUID()}`;
  }
}

class BaselineTransportSecurityPolicyResolver {
  public async resolveTransportSecurityPolicy(request: ResolveTransportSecurityPolicyRequest) {
    return Object.freeze({
      policy: resolveBaselineTransportSecurityPolicy(request.scenario),
      source: "baseline" as const,
    });
  }
}

class DomainTransportConnectionPolicyEvaluator {
  public async evaluateTransportConnectionPolicy(request: EvaluateTransportConnectionPolicyRequest) {
    return evaluateTransportConnectionTrust({
      policy: request.policy,
      context: request.context,
      evaluatedAt: request.evaluatedAt,
    });
  }
}

export async function startIdentityServerHost(options: IdentityServerHostOptions): Promise<IdentityServerHost> {
  const databasePath = path.resolve(options.databasePath);
  const persistentPlatformServices = options.persistentPlatformServices
    ?? createAuthoritativePersistentPlatformServices({
      databasePath,
    });
  const ownsPersistentPlatformServices = !options.persistentPlatformServices;
  const repository = persistentPlatformServices.identityRepository;
  const trustedDeviceRepository = persistentPlatformServices.trustedDeviceRepository;
  const workspaceRepository = persistentPlatformServices.workspaceRepository;
  const authorizationRepository = persistentPlatformServices.authorizationRepository;
  const nodeTrustRepository = persistentPlatformServices.nodeTrustRepository;
  const nodeTrustAuditRecorder = persistentPlatformServices.nodeTrustAuditRecorder;
  const certificateAuthorityRepository = persistentPlatformServices.certificateAuthorityRepository;
  const storageInstanceRepository = persistentPlatformServices.storageInstanceRepository;
  const storageManagementAuditRecorder = persistentPlatformServices.storageManagementAuditRecorder;
  const assetRepository = persistentPlatformServices.assetRepository;
  const assetAuditRecorder = persistentPlatformServices.assetAuditRecorder;
  const assetUploadSessionRepository = persistentPlatformServices.assetUploadSessionRepository;
  const imageAssetRepository = new SqliteImageAssetPersistenceAdapter(databasePath);
  const env = options.env ?? process.env;
  const hostAddress = options.host ?? "127.0.0.1";
  const secureTransportConfig = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.server,
    hostAddress,
    env,
  });
  let secretService: ServerComposedSecretService | undefined;
  try {
    const auditRetentionLifecycleConfig = resolveAuditRetentionLifecycleConfig({
      env,
      deploymentProfile: options.deploymentProfile
        ? {
          profileId: options.deploymentProfile.profileId,
        }
        : undefined,
    });
    const auditLedgerObservability = new AuditLedgerObservability({
      logger: createAuditLedgerOperationalLogger(options.logger),
    });
    const authoritativeAuditRecorder = new AuthoritativeAuditRecordingService({
      repository: persistentPlatformServices.auditLedgerRepository,
      observabilityPort: auditLedgerObservability,
      retentionLifecycleDefaults: {
        policyKey: auditRetentionLifecycleConfig.defaultPolicyKey,
        policyVersion: auditRetentionLifecycleConfig.defaultPolicyVersion,
        retentionAnchor: auditRetentionLifecycleConfig.defaultRetentionAnchor,
      },
    });
    const legacySecretAccessAuditHook = createSecretAccessAuditHook(options.logger);
    const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(env);
    secretService = composeServerSecretService({
      databasePath: options.databasePath,
      env,
      observabilityLogger: createSecretOperationalLogger(options.logger),
      auditHook: composeBestEffortSecretAuditHooks(
        legacySecretAccessAuditHook
          ? (event) => legacySecretAccessAuditHook(event as unknown as Record<string, unknown>)
          : undefined,
        createAuthoritativeSecretAccessAuditHook(authoritativeAuditRecorder),
      ),
    });
    await assertSystemSecretBootstrapSafe({
      env,
      secretService,
    });
    const providerAccountPolicies = options.providerAccountPolicies
      ?? IdentityProviderAccountPolicyConfig.fromEnv(env);
    await applyIdentityStartupConfiguration(repository, providerAccountPolicies);
    await validateCertificateAuthorityStartup(certificateAuthorityRepository, env);

    const authenticator = new LocalPasswordIdentityAuthenticator(new ScryptLocalPasswordCredentialService());
    const identityPolicyService = new IdentityPolicyService(repository);
    const clock = new SystemIdentityClock();
    const idGenerator = new RandomIdentityIdGenerator();
    const sessionPolicies = options.sessionPolicies
      ?? IdentitySessionPolicyConfig.fromEnv(env).policies;
    const sessionTrustPolicies = IdentitySessionTrustPolicyConfig.fromEnv(env).policies;
    const baseIdentityLifecyclePublisher = options.eventPublisher ?? new SqliteIdentityLifecycleEventPublisher(databasePath);
    const eventPublisher = new FanoutIdentityLifecycleEventPublisher([
      baseIdentityLifecyclePublisher,
      new AuthoritativeIdentityLifecycleEventPublisher(authoritativeAuditRecorder),
    ]);
    const workspaceClock = new SystemWorkspaceClock();
    const workspaceIdGenerator = new RandomWorkspaceIdGenerator();
    const workspaceAuthorizationPolicyReadAdapter = new WorkspaceAuthorizationPolicyReadAdapter({
      workspaceAuthorizationReadRepository: workspaceRepository,
    });
    const workspaceAdministrationAuthorizationDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: workspaceAuthorizationPolicyReadAdapter,
      sharingGrantReadRepository: workspaceAuthorizationPolicyReadAdapter,
      resourcePolicyMetadataReadRepository: workspaceAuthorizationPolicyReadAdapter,
      clock: workspaceClock,
    });
    const authorizationPolicyReadAdapter = new SqliteAuthorizationPolicyReadAdapter({
      authorizationPersistenceAdapter: authorizationRepository,
    });
    const authorizationDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: authorizationPolicyReadAdapter,
      sharingGrantReadRepository: authorizationPolicyReadAdapter,
      resourcePolicyMetadataReadRepository: authorizationPolicyReadAdapter,
      clock: workspaceClock,
    });
    const authorizationMutationService = new AuthorizationPolicyMutationService({
      ports: {
        roleAssignmentPersistenceRepository: authorizationRepository,
        sharingGrantPersistenceRepository: authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: authorizationRepository,
      },
      policyEventRecorder: new AuthoritativeAuthorizationPolicyEventRecorder(authoritativeAuditRecorder),
      clock: workspaceClock,
    });
    const nodeTrustAuditSink = new FanoutNodeTrustAuditSink([
      nodeTrustAuditRecorder,
      new AuthoritativeNodeTrustAuditSink(authoritativeAuditRecorder),
    ]);
    const sessionTrustService = new TrustedDeviceSessionTrustService({
      trustedDeviceRepository,
      policies: sessionTrustPolicies,
    });
    const trustedDeviceAdminUserIdentityIds = parseOptionalCsvList(env.IDENTITY_TRUSTED_DEVICE_ADMIN_USER_IDS);
    const trustedDeviceManagementService = new TrustedDeviceManagementService(
      trustedDeviceRepository,
      idGenerator,
      clock,
      eventPublisher,
    );
    const trustedDevicePairingService = new TrustedDevicePairingService({
      trustedDeviceRepository,
      pairingRepository: trustedDeviceRepository,
      idGenerator,
      clock,
      eventPublisher,
    });
    const sessionLifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: repository,
      clock,
      idGenerator,
      policies: sessionPolicies,
    });
    const authenticatedSessionService = new IdentityAuthenticatedSessionService({
      lifecycleService: sessionLifecycleService,
      sessionRepository: repository,
      tokenMaterialRepository: repository,
      tokenService: new OpaqueIdentitySessionTokenService(),
      clock,
      sessionTrustEvaluator: sessionTrustService,
      eventPublisher,
    });

  const backendApi = new IdentityAuthBackendApi({
    registerLocalAccountUseCase: new RegisterLocalAccountUseCase({
      lookupRepository: repository,
      persistenceRepository: repository,
      credentialMaterialRepository: repository,
      identityPolicyService,
      credentialAuthenticator: authenticator,
      idGenerator,
      clock,
      eventPublisher,
    }),
    loginLocalAccountUseCase: new LoginLocalAccountUseCase({
      lookupRepository: repository,
      credentialMaterialRepository: repository,
      identityPolicyService,
      credentialAuthenticator: authenticator,
      clock,
      eventPublisher,
    }),
    changeLocalPasswordCredentialUseCase: new ChangeLocalPasswordCredentialUseCase({
      lookupRepository: repository,
      persistenceRepository: repository,
      credentialMaterialRepository: repository,
      transactionManager: repository,
      identityPolicyService,
      credentialAuthenticator: authenticator,
      idGenerator,
      clock,
      eventPublisher,
    }),
    logoutIdentitySessionUseCase: new LogoutIdentitySessionUseCase({
      authenticatedSessionService,
      eventPublisher,
    }),
    revokeIdentitySessionUseCase: new RevokeIdentitySessionUseCase({
      sessionRepository: repository,
      authenticatedSessionService,
    }),
    listLocalIdentityAccountsUseCase: new ListLocalIdentityAccountsUseCase({
      lookupRepository: repository,
      sessionRepository: repository,
    }),
    getLocalIdentityAccountStatusUseCase: new GetLocalIdentityAccountStatusUseCase({
      lookupRepository: repository,
      sessionRepository: repository,
    }),
    setLocalIdentityAccountStatusUseCase: new SetLocalIdentityAccountStatusUseCase({
      lookupRepository: repository,
      persistenceRepository: repository,
      sessionRepository: repository,
      authenticatedSessionService,
      clock,
      eventPublisher,
    }),
    listTrustedDevicesUseCase: new ListTrustedDevicesUseCase({
      trustedDeviceManagementService,
    }),
    getTrustedDeviceUseCase: new GetTrustedDeviceUseCase({
      trustedDeviceManagementService,
    }),
    revokeTrustedDeviceUseCase: new RevokeTrustedDeviceUseCase({
      trustedDeviceManagementService,
    }),
    updateTrustedDeviceDisplayNameUseCase: new UpdateTrustedDeviceDisplayNameUseCase({
      trustedDeviceManagementService,
    }),
    initiateTrustedDevicePairingUseCase: new InitiateTrustedDevicePairingUseCase({
      pairingService: trustedDevicePairingService,
    }),
    validateTrustedDevicePairingUseCase: new ValidateTrustedDevicePairingUseCase({
      pairingService: trustedDevicePairingService,
    }),
    completeTrustedDevicePairingUseCase: new CompleteTrustedDevicePairingUseCase({
      pairingService: trustedDevicePairingService,
    }),
    identityLookupRepository: repository,
    sessionRepository: repository,
    authenticatedSessionService,
    sessionTrustService,
    featurePolicies: {
      allowLocalRegistration: providerAccountPolicies.allowLocalRegistration,
      allowLocalAdministration: providerAccountPolicies.allowLocalAdministration,
    },
    trustedDeviceAdministration: {
      bootstrapAdminUserIdentityIds: trustedDeviceAdminUserIdentityIds,
    },
  });

  const resolveWorkspaceInvitationLifecycleUseCase = new ResolveWorkspaceInvitationLifecycleUseCase({
    workspaceRepository,
    invitationRepository: workspaceRepository,
    membershipRepository: workspaceRepository,
    roleAssignmentRepository: workspaceRepository,
    authorizationReadRepository: workspaceRepository,
    transactionManager: workspaceRepository,
    idGenerator: workspaceIdGenerator,
    clock: workspaceClock,
  });
  const workspaceBackendApi = new WorkspaceInvitationBackendApi({
    issueWorkspaceInvitationUseCase: new IssueWorkspaceInvitationUseCase({
      invitationRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator: workspaceIdGenerator,
      tokenIssuer: new Sha256WorkspaceInvitationTokenIssuer(),
      clock: workspaceClock,
    }),
    resolveAuthenticatedWorkspaceOnboardingUseCase: new ResolveAuthenticatedWorkspaceOnboardingUseCase({
      invitationLifecycleUseCase: resolveWorkspaceInvitationLifecycleUseCase,
      clock: workspaceClock,
    }),
  });
  const workspaceAdministrationBackendApi = new WorkspaceAdministrationBackendApi({
    workspaceQueryService: new WorkspaceAdministrationQueryService({
      workspaceRepository,
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      invitationRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      clock: workspaceClock,
    }),
    workspaceRepository,
    membershipRepository: workspaceRepository,
    roleAssignmentRepository: workspaceRepository,
    invitationRepository: workspaceRepository,
    authorizationReadRepository: workspaceRepository,
    createWorkspaceUseCase: new CreateWorkspaceUseCase({
      workspaceRepository,
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
      deploymentAuthorizationPolicyPort: options.deploymentPolicyBootstrap?.evaluationService,
      deploymentPolicyContextResolver: options.deploymentPolicyBootstrap?.contextResolver,
    }),
    updateWorkspaceUseCase: new UpdateWorkspaceUseCase({
      workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      clock: workspaceClock,
    }),
    transitionWorkspaceLifecycleUseCase: new TransitionWorkspaceLifecycleUseCase({
      workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      clock: workspaceClock,
    }),
    addWorkspaceMemberUseCase: new AddWorkspaceMemberUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
    }),
    changeWorkspaceMembershipStatusUseCase: new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      clock: workspaceClock,
    }),
    removeWorkspaceMemberUseCase: new RemoveWorkspaceMemberUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      clock: workspaceClock,
    }),
    assignWorkspaceRoleUseCase: new AssignWorkspaceRoleUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
    }),
    reassignWorkspaceRoleUseCase: new ReassignWorkspaceRoleUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      idGenerator: workspaceIdGenerator,
      clock: workspaceClock,
    }),
    revokeWorkspaceRoleUseCase: new RevokeWorkspaceRoleUseCase({
      membershipRepository: workspaceRepository,
      roleAssignmentRepository: workspaceRepository,
      authorizationReadRepository: workspaceRepository,
      transactionManager: workspaceRepository,
      clock: workspaceClock,
    }),
    resolveWorkspaceInvitationLifecycleUseCase: resolveWorkspaceInvitationLifecycleUseCase,
    authorizationPolicyDecisionEvaluator: workspaceAdministrationAuthorizationDecisionEvaluator,
    workspaceAdministrationCapabilityResourceType: "workspace-administration",
    clock: workspaceClock,
  });
  const authorizationManagementBackendApi = new AuthorizationManagementBackendApi({
    grantSharingAccessUseCase: new GrantAuthorizationSharingAccessUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: authorizationRepository,
        sharingGrantPersistenceRepository: authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: authorizationRepository,
      },
      clock: workspaceClock,
    }),
    revokeSharingAccessUseCase: new RevokeAuthorizationSharingAccessUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: authorizationRepository,
        sharingGrantPersistenceRepository: authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: authorizationRepository,
      },
      clock: workspaceClock,
    }),
    updateVisibilityUseCase: new UpdateAuthorizationVisibilityUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: authorizationRepository,
        sharingGrantPersistenceRepository: authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: authorizationRepository,
      },
      clock: workspaceClock,
    }),
    bulkGrantWorkspaceRoleAccessUseCase: new BulkGrantAuthorizationWorkspaceRoleAccessUseCase({
      mutationService: authorizationMutationService,
      decisionEvaluator: authorizationDecisionEvaluator,
      persistencePorts: {
        roleAssignmentPersistenceRepository: authorizationRepository,
        sharingGrantPersistenceRepository: authorizationRepository,
        resourcePolicyMetadataPersistenceRepository: authorizationRepository,
      },
      clock: workspaceClock,
    }),
    listEffectiveAccessUseCase: new ListAuthorizationEffectiveAccessUseCase({
      decisionEvaluator: authorizationDecisionEvaluator,
      roleGrantReadRepository: authorizationPolicyReadAdapter,
      sharingGrantReadRepository: authorizationPolicyReadAdapter,
      resourcePolicyMetadataReadRepository: authorizationPolicyReadAdapter,
    }),
    decisionEvaluator: authorizationDecisionEvaluator,
    roleAssignmentPersistenceRepository: authorizationRepository,
    sharingGrantPersistenceRepository: authorizationRepository,
    resourcePolicyMetadataPersistenceRepository: authorizationRepository,
    clock: workspaceClock,
  });
  const runtimeTrustMaterialDistributionService = protectedSecretStore
    ? new RuntimeTrustMaterialDistributionService({
      certificateAuthorityRepository,
      issuedCertificateRepository: certificateAuthorityRepository,
      trustMaterialReferenceRepository: certificateAuthorityRepository,
      certificateMaterialStorage: new ProtectedCertificateAuthorityRootMaterialStorage(protectedSecretStore),
      certificateLifecycleEventRepository: certificateAuthorityRepository,
    })
    : undefined;
  const resolveRuntimeTrustMaterialPackageUseCase = runtimeTrustMaterialDistributionService
    ? new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: runtimeTrustMaterialDistributionService,
    })
    : undefined;
  const startupStateResolver = new ResolveCertificateAuthorityStartupStateUseCase({
    configurationProvider: new EnvironmentCertificateAuthorityBootstrapConfigurationProvider(env),
    secretService: new EnvironmentCertificateAuthoritySecretService(env, {
      protectedSecretStore,
    }),
    certificateAuthorityRepository,
    trustMaterialRepository: certificateAuthorityRepository,
  });
  const certificateMaterialStorage = protectedSecretStore
    ? new ProtectedCertificateAuthorityRootMaterialStorage(protectedSecretStore)
    : undefined;
  const certificateAuthorityIssuer = certificateMaterialStorage
    ? new InternalCertificateAuthorityIssuer({
      certificateAuthorityRepository,
      trustMaterialRepository: certificateAuthorityRepository,
      rootMaterialStorage: certificateMaterialStorage,
    })
    : undefined;
  const nodeCertificateEligibilityPort = new ResolveApprovedNodeCertificateEligibilityUseCase({
    nodeRepository: nodeTrustRepository,
    enrollmentRequestRepository: nodeTrustRepository,
  });
  const renewIssuedCertificateUseCase = certificateMaterialStorage && certificateAuthorityIssuer
    ? new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository,
      issuedCertificateRepository: certificateAuthorityRepository,
      trustMaterialRepository: certificateAuthorityRepository,
      certificateMaterialStorage,
      issuer: certificateAuthorityIssuer,
      nodeCertificateEligibilityPort,
    })
    : {
      execute: async () => {
        throw new Error("Certificate renewal is unavailable because protected secret storage is not configured.");
      },
    } as RenewIssuedCertificateUseCase;
  const certificateOperationsBackendApi = new CertificateOperationsBackendApi({
    getCertificateAuthorityStatusIntrospectionUseCase: new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository,
      issuedCertificateRepository: certificateAuthorityRepository,
      certificateLifecycleEventRepository: certificateAuthorityRepository,
    }),
    listIssuedCertificateMetadataUseCase: new ListIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: certificateAuthorityRepository,
    }),
    getIssuedCertificateMetadataUseCase: new GetIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: certificateAuthorityRepository,
    }),
    revokeIssuedCertificateUseCase: new RevokeIssuedCertificateUseCase({
      issuedCertificateRepository: certificateAuthorityRepository,
      certificateLifecycleEventRepository: certificateAuthorityRepository,
    }),
    renewIssuedCertificateUseCase,
  });
  const secretMetadataBackendApi = new SecretMetadataBackendApi({
    createSecretUseCase: secretService.createSecretUseCase,
    getSecretMetadataUseCase: secretService.getSecretMetadataUseCase,
    listSecretsUseCase: secretService.listSecretsUseCase,
    disableSecretUseCase: secretService.disableSecretUseCase,
    rotateSecretUseCase: secretService.rotateSecretUseCase,
    reEncryptSecretsUseCase: secretService.reEncryptSecretsUseCase,
    workspaceAuthorizationReadRepository: workspaceRepository,
    secretOperationalDiagnosticsProvider: new SecretServiceOperationalDiagnosticsProvider({
      env,
      secretService,
    }),
  });
  const nodeTrustBackendApi = new NodeTrustBackendApi({
    registerNodeEnrollmentRequestUseCase: new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    reviewPendingNodeEnrollmentUseCase: new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    getNodeEnrollmentDetailUseCase: new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
    }),
    getNodeInventoryDetailUseCase: new GetNodeInventoryDetailUseCase({
      nodeRepository: nodeTrustRepository,
      enrollmentRequestRepository: nodeTrustRepository,
    }),
    approveNodeEnrollmentUseCase: new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      nodeRepository: nodeTrustRepository,
      transactionManager: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      nodeRepository: nodeTrustRepository,
      transactionManager: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    revokeNodeTrustUseCase: new RevokeNodeTrustUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    recordNodeHeartbeatUseCase: new RecordNodeHeartbeatUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    recordNodeOperationalUpdateUseCase: new RecordNodeOperationalUpdateUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    resolveApprovedNodeRuntimeTrustMaterialUseCase: new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository: nodeTrustRepository,
      runtimeTrustMaterialResolver: resolveRuntimeTrustMaterialPackageUseCase,
    }),
    resolveNodeMutualTlsTransportIdentityUseCase: new ResolveNodeMutualTlsTransportIdentityUseCase({
      nodeRepository: nodeTrustRepository,
    }),
    listTrustedNodeInventoryUseCase: new ListTrustedNodeInventoryUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    listNodeInventoryUseCase: new ListNodeInventoryUseCase({
      nodeRepository: nodeTrustRepository,
      enrollmentRequestRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
  });
  const managedStorageRootPath = resolveManagedStorageRootPath(path.resolve(options.databasePath), env);
  const localStorageBackendAdapter = new ServerManagedLocalStorageBackendAdapter({
    managedStorageRootPath,
  });
  const localStorageObjectAdapter = new ServerManagedLocalStorageObjectAdapter({
    managedStorageRootPath,
  });
  const storageBackendAdapterRegistry = createStorageBackendAdapterRegistry([{
    backendType: "managed-filesystem",
    provisioningPort: localStorageBackendAdapter,
    capabilityInspectionPort: localStorageBackendAdapter,
    objectPort: localStorageObjectAdapter,
  }]);
  const storageProvisioningOrchestrator = new StorageBackendProvisioningOrchestrator(
    storageBackendAdapterRegistry,
  );
  const storageSynchronizationAdapter = new ServerManagedStorageSynchronizationAdapter({
    availability: resolveStorageSyncDeploymentAvailability(env),
  });
  const workspaceAwareStoragePolicyEvaluationAdapter = new WorkspaceAwareStoragePolicyEvaluationAdapter({
    workspaceAuthorizationReadRepository: workspaceRepository,
  });
  const storageManagementService = new StorageManagementService({
    repository: storageInstanceRepository,
    policyPort: workspaceAwareStoragePolicyEvaluationAdapter,
    provisioningPort: storageProvisioningOrchestrator,
    capabilityPort: storageProvisioningOrchestrator,
    auditSink: new FanoutStorageManagementAuditSink([
      storageManagementAuditRecorder,
      new AuthoritativeStorageManagementAuditSink(authoritativeAuditRecorder),
    ]),
  });
  const assetAuditSink = new FanoutAssetAuditSink([
    assetAuditRecorder,
    new AuthoritativeProtectedAssetAuditSink(authoritativeAuditRecorder),
  ]);
  const storageManagementBackendApi = new StorageManagementBackendApi({
    storageManagementService,
    capabilityInspectionPort: storageProvisioningOrchestrator,
    synchronizationAdapter: storageSynchronizationAdapter,
  });
  const assetUploadInitiationService = new AssetUploadInitiationService({
    repository: assetRepository,
    uploadSessionRepository: assetUploadSessionRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort: workspaceAwareStoragePolicyEvaluationAdapter,
    auditSink: assetAuditSink,
  });
  const assetGeneratedOutputRegistrationService = new AssetGeneratedOutputRegistrationService({
    repository: assetRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort: workspaceAwareStoragePolicyEvaluationAdapter,
    auditSink: assetAuditSink,
  });
  const storageLogicalAccessResolutionService = new StorageLogicalAccessResolutionService({
    repository: storageInstanceRepository,
    policyPort: workspaceAwareStoragePolicyEvaluationAdapter,
    objectAccessResolver: storageBackendAdapterRegistry,
  });
  const assetContentKeyPort = new DeterministicScopeEncryptionKeyPort({
    encodedKey: resolveAssetContentEncryptionKey(env),
    keyPrefix: normalizeOptional(env.AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY_PREFIX) ?? "kek:asset-content",
  });
  const assetEncryptionPolicyContextResolver = new WorkspaceStorageEncryptionPolicyContextResolver({
    workspaceRepository,
    storageInstanceRepository,
  });
  const encryptionObservabilityReporter = new EncryptionEnforcementObservabilityReporter({
    logger: createEncryptionOperationalLogger(options.logger),
  });
  const assetEncryptionPolicyEvaluationService = new EncryptionPolicyEvaluationService({
    encryptionAtRestPolicyContextResolverPort: assetEncryptionPolicyContextResolver,
    observabilityPort: encryptionObservabilityReporter,
  });
  const assetEncryptionKeyResolutionService = new EncryptionKeyResolutionService({
    encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
    encryptionKeyCatalogPort: assetContentKeyPort,
    observabilityPort: encryptionObservabilityReporter,
  });
  const assetContentCipherPort = new AesGcmAssetContentCipherPort({
    keyMaterialPort: assetContentKeyPort,
  });
  const assetUploadIngestionService = new AssetUploadIngestionService({
    repository: assetRepository,
    uploadSessionRepository: assetUploadSessionRepository,
    storageLogicalAccessResolutionService,
    encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
    encryptionKeyResolutionService: assetEncryptionKeyResolutionService,
    assetContentCipherPort,
    encryptionObservabilityPort: encryptionObservabilityReporter,
    auditSink: assetAuditSink,
  });
  const assetDiscoveryService = new AssetDiscoveryService({
    repository: assetRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    auditSink: assetAuditSink,
  });
  const assetDetailService = new AssetDetailService({
    repository: assetRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    auditSink: assetAuditSink,
  });
  const assetDownloadGrantAdapter = new EncryptedAssetDownloadGrantAdapter({
    secret: resolveAssetDownloadGrantSecret(env),
  });
  const assetDownloadService = new AssetDownloadService({
    repository: assetRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    storageLogicalAccessResolutionService,
    downloadGrantPort: assetDownloadGrantAdapter,
    encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
    assetContentCipherPort,
    encryptionObservabilityPort: encryptionObservabilityReporter,
    auditSink: assetAuditSink,
  });
  const assetPreviewService = new AssetPreviewService({
    repository: assetRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    auditSink: assetAuditSink,
  });
  const assetLifecycleService = new AssetLifecycleService({
    repository: assetRepository,
    workspaceAuthorizationReadRepository: workspaceRepository,
    auditSink: assetAuditSink,
  });
  const assetManagementBackendApi = new AssetManagementBackendApi({
    uploadInitiationService: assetUploadInitiationService,
    generatedOutputRegistrationService: assetGeneratedOutputRegistrationService,
    uploadIngestionService: assetUploadIngestionService,
    discoveryService: assetDiscoveryService,
    detailService: assetDetailService,
    downloadService: assetDownloadService,
    previewService: assetPreviewService,
    lifecycleService: assetLifecycleService,
  });
  const imageAssetStorageAdapter = new ManagedImageAssetStorageAdapter({
    storageLogicalAccessResolutionService,
    tokenSecret: resolveImageAssetStorageTokenSecret(env),
  });
  const imageAssetAuditSink = new AuthoritativeImageAssetAuditSink(authoritativeAuditRecorder);
  const imageAssetManagementBackendApi = new ImageAssetManagementBackendApi({
    initiateImageAssetCreationUseCase: new InitiateImageAssetCreationUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: workspaceRepository,
      storageInstanceRepository,
      storagePolicyEvaluationPort: workspaceAwareStoragePolicyEvaluationAdapter,
      authorizationPolicyDecisionEvaluator: authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    finalizeImageAssetUploadUseCase: new FinalizeImageAssetUploadUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: workspaceRepository,
      auditSink: imageAssetAuditSink,
    }),
    getImageAssetMetadataUseCase: new GetImageAssetMetadataUseCase({
      imageAssetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      authorizationPolicyDecisionEvaluator: authorizationDecisionEvaluator,
    }),
    listImageAssetMetadataUseCase: new ListImageAssetMetadataUseCase({
      imageAssetRepository,
      workspaceAuthorizationReadRepository: workspaceRepository,
      authorizationPolicyDecisionEvaluator: authorizationDecisionEvaluator,
    }),
    getImageAssetOriginalContentUseCase: new GetImageAssetOriginalContentUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: workspaceRepository,
      authorizationPolicyDecisionEvaluator: authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    requestImageAssetPreviewContentUseCase: new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: workspaceRepository,
      authorizationPolicyDecisionEvaluator: authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    openImageAssetPreviewContentUseCase: new OpenImageAssetPreviewContentUseCase({
      imageAssetRepository,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository: workspaceRepository,
      authorizationPolicyDecisionEvaluator: authorizationDecisionEvaluator,
      auditSink: imageAssetAuditSink,
    }),
    imageAssetStoragePort: imageAssetStorageAdapter,
    uploadSessionTokenSecret: resolveImageAssetUploadSessionTokenSecret(env),
    observability: new ImageAssetManagementObservability({
      logger: createImageAssetManagementOperationalLogger(options.logger),
    }),
  });
  const runSubmissionAuditSink = new PlatformRunSubmissionAuditSink(
    persistentPlatformServices.platformPersistenceRepository,
  );
  const authoritativeRunSubmissionAuditSink = new FanoutRunSubmissionAuditSink([
    runSubmissionAuditSink,
    new AuthoritativeRunSubmissionAuditSink(authoritativeAuditRecorder),
  ]);
  const validateRunSubmissionUseCase = new ValidateRunSubmissionUseCase({
    workspaceRepository,
    authorizationDecisionEvaluator,
    targetResolver: new AssetBackedRunSubmissionTargetResolver(assetRepository),
    storageInstanceRepository,
    storagePolicyEvaluationPort: workspaceAwareStoragePolicyEvaluationAdapter,
    encryptionPolicyEvaluationService: assetEncryptionPolicyEvaluationService,
    deploymentSchedulingPolicyEvaluationPort: options.deploymentPolicyBootstrap?.evaluationService,
    deploymentPolicyContextResolver: options.deploymentPolicyBootstrap?.contextResolver,
    auditSink: authoritativeRunSubmissionAuditSink,
    clock: workspaceClock,
  });
  const createAuthoritativeRunUseCase = new CreateAuthoritativeRunUseCase({
    runRepository: persistentPlatformServices.platformPersistenceRepository,
    queueRepository: persistentPlatformServices.platformPersistenceRepository,
    orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
    auditSink: authoritativeRunSubmissionAuditSink,
    transactionManager: persistentPlatformServices.platformPersistenceRepository,
  });
  const submitImageRunUseCase = new SubmitImageRunUseCase({
    validateRunSubmissionUseCase,
    createAuthoritativeRunUseCase,
    now: () => workspaceClock.now(),
  });
  const runOrchestrationObservability = new RunOrchestrationObservability({
    logger: createRunOrchestrationOperationalLogger(options.logger),
  });
  const authoritativeRunSubmissionBackendApi = new AuthoritativeRunSubmissionBackendApi({
    submitImageRunUseCase,
    observability: runOrchestrationObservability,
  });
  const authoritativeRunQueryBackendApi = new AuthoritativeRunQueryBackendApi({
    listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(
      persistentPlatformServices.platformPersistenceRepository,
    ),
    listAuthoritativeRunQueueStatusUseCase: new ListAuthoritativeRunQueueStatusUseCase({
      runRepository: persistentPlatformServices.platformPersistenceRepository,
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      now: () => workspaceClock.now(),
    }),
    listStaleSchedulingReservationsUseCase: new ListStaleSchedulingReservationsUseCase({
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      now: () => workspaceClock.now(),
    }),
    getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(
      persistentPlatformServices.platformPersistenceRepository,
    ),
    getImageManipulationExecutionReadinessUseCase: new GetImageManipulationExecutionReadinessUseCase({
      capabilityPort: options.runExecutionAdapters?.capabilityProbePort,
      now: () => workspaceClock.now(),
    }),
    runRepository: persistentPlatformServices.platformPersistenceRepository,
    auditEventRepository: persistentPlatformServices.platformPersistenceRepository,
    authorizationDecisionEvaluator,
    observability: runOrchestrationObservability,
    now: () => workspaceClock.now(),
  });
  const deploymentPolicyPermissionService = new WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService({
    workspaceRoleAssignmentRepository: persistentPlatformServices.workspaceRepository,
  });
  const deploymentPolicyAdministrationObservabilityPort = new PlatformDeploymentPolicyAdministrationObservabilityPort({
    logger: createDeploymentPolicyAdministrationOperationalLogger(options.logger),
  });
  const deploymentPolicyReadBackendApi = new DeploymentPolicyReadBackendApi({
    readDeploymentPolicyStateUseCase: new ReadDeploymentPolicyAdministrationUseCase({
      deploymentPolicyRepository: persistentPlatformServices.deploymentPolicyRepository,
      permissionService: deploymentPolicyPermissionService,
      observabilityPort: deploymentPolicyAdministrationObservabilityPort,
    }),
    observabilityPort: deploymentPolicyAdministrationObservabilityPort,
  });
  const deploymentPolicyGovernanceEventSink = new FanoutDeploymentPolicyGovernanceEventSink([
    new PlatformDeploymentPolicyGovernanceEventSink(
      persistentPlatformServices.platformPersistenceRepository,
      options.logger
        ? {
          info: (event) => options.logger?.info(Object.freeze({
            event: event.event,
            requestId: "deployment-policy-governance",
            details: Object.freeze({
              operation: event.operation,
              outcome: event.outcome,
              scopeKind: event.scopeKind,
              scopeId: event.scopeId,
              actorUserIdentityId: event.actorUserIdentityId,
              profileId: event.profileId,
              policyFamilyIds: event.policyFamilyIds,
              details: event.details,
              occurredAt: event.occurredAt,
            }),
          })),
        }
        : undefined,
    ),
    new AuthoritativeDeploymentPolicyGovernanceEventSink(authoritativeAuditRecorder),
  ]);
  const deploymentPolicyWriteBackendApi = new DeploymentPolicyWriteBackendApi({
    updateDeploymentPolicyStateUseCase: new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: persistentPlatformServices.deploymentPolicyRepository,
      permissionService: deploymentPolicyPermissionService,
      governanceEventSink: deploymentPolicyGovernanceEventSink,
      observabilityPort: deploymentPolicyAdministrationObservabilityPort,
    }),
    observabilityPort: deploymentPolicyAdministrationObservabilityPort,
  });
  const auditLedgerBackendApi = new AuditLedgerBackendApi({
    auditLedgerQueryService: new AuditLedgerQueryService({
      repository: persistentPlatformServices.auditLedgerRepository,
      authorizer: new WorkspaceAuditLedgerReadAuthorizer({
        workspaceAuthorizationReadRepository: persistentPlatformServices.workspaceRepository,
        clock: workspaceClock,
      }),
    }),
    observability: auditLedgerObservability,
  });
  const authoritativeRunMutationBackendApi = new AuthoritativeRunMutationBackendApi({
    requestAuthoritativeRunCancellationUseCase: new RequestAuthoritativeRunCancellationUseCase({
      runRepository: persistentPlatformServices.platformPersistenceRepository,
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      cancellationSignalPort: options.runExecutionAdapters?.cancellationSignalPort,
      transactionManager: persistentPlatformServices.platformPersistenceRepository,
      authoritativeAuditRecorder: authoritativeAuditRecorder,
      now: () => workspaceClock.now(),
    }),
    requestAuthoritativeRunRetryUseCase: new RequestAuthoritativeRunRetryUseCase({
      runRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      validateRunSubmissionUseCase,
      createAuthoritativeRunUseCase,
      authoritativeAuditRecorder: authoritativeAuditRecorder,
      now: () => workspaceClock.now(),
    }),
    releaseStaleSchedulingReservationUseCase: new ReleaseStaleSchedulingReservationUseCase({
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      authoritativeAuditRecorder: authoritativeAuditRecorder,
      now: () => workspaceClock.now(),
    }),
    reevaluateDeferredSchedulingRunsUseCase: new ReevaluateDeferredSchedulingRunsUseCase({
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      authoritativeAuditRecorder: authoritativeAuditRecorder,
      now: () => workspaceClock.now(),
    }),
    authorizationDecisionEvaluator,
    observability: runOrchestrationObservability,
    now: () => workspaceClock.now(),
  });
  const authoritativeRunExecutionUpdateBackendApi = new AuthoritativeRunExecutionUpdateBackendApi({
    ingestRunExecutionUpdateUseCase: new IngestRunExecutionUpdateUseCase({
      runRepository: persistentPlatformServices.platformPersistenceRepository,
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      transactionManager: persistentPlatformServices.platformPersistenceRepository,
      now: () => workspaceClock.now(),
    }),
    observability: runOrchestrationObservability,
  });
  const runStartupRecovery = await new RecoverRunOrchestrationStartupStateUseCase({
    runRepository: persistentPlatformServices.platformPersistenceRepository,
    queueRepository: persistentPlatformServices.platformPersistenceRepository,
    placementHoldRepository: persistentPlatformServices.platformPersistenceRepository,
    orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
    transactionManager: persistentPlatformServices.platformPersistenceRepository,
    now: () => workspaceClock.now(),
  }).execute();
  if (runStartupRecovery.summary.appliedCount > 0 || runStartupRecovery.summary.manualFollowUpCount > 0) {
    options.logger?.info({
      event: "run.orchestration-recovery.startup",
      requestId: "server-startup",
      details: Object.freeze({
        asOf: runStartupRecovery.asOf,
        appliedCount: runStartupRecovery.summary.appliedCount,
        manualFollowUpCount: runStartupRecovery.summary.manualFollowUpCount,
      }),
    });
  }
  const auditStartupReconciliation = await new ReconcileAuditLedgerStartupStateUseCase({
    repository: persistentPlatformServices.auditLedgerRepository,
    observabilityPort: auditLedgerObservability,
    now: () => workspaceClock.now(),
  }).execute();
  if (auditStartupReconciliation.manualFollowUpCount > 0 || auditStartupReconciliation.repairedCount > 0) {
    options.logger?.warn({
      event: "audit-ledger.write-reconciliation.startup",
      requestId: "server-startup",
      details: Object.freeze({
        checkedAt: auditStartupReconciliation.checkedAt,
        supported: auditStartupReconciliation.supported,
        repairedCount: auditStartupReconciliation.repairedCount,
        manualFollowUpCount: auditStartupReconciliation.manualFollowUpCount,
        issueCount: auditStartupReconciliation.issueCount,
      }),
    });
  }
  const transportTrustStateResolver = new ServerManagedTransportTrustStateResolver({
    trustedDeviceManagementService: trustedDeviceManagementService,
    nodeTrustIdentityRepository: nodeTrustRepository,
    certificateRevocationStatusRegistry: new ResolveCertificateRevocationStatusUseCase({
      issuedCertificateRepository: certificateAuthorityRepository,
      certificateLifecycleEventRepository: certificateAuthorityRepository,
    }),
  });
  const transportSecurityObservability = new TransportSecurityObservabilityReporter({
    logger: {
      info: (event) => options.logger?.info({
        event: event.event,
        requestId: event.details.connectionId,
        details: Object.freeze({
          level: event.level,
          transport: event.details,
        }),
      }),
      warn: (event) => options.logger?.warn({
        event: event.event,
        requestId: event.details.connectionId,
        details: Object.freeze({
          level: event.level,
          transport: event.details,
        }),
      }),
      error: (event) => options.logger?.error({
        event: event.event,
        requestId: event.details.connectionId,
        details: Object.freeze({
          level: event.level,
          transport: event.details,
        }),
      }),
    },
  });
  const transportTrustValidator = new ValidateTransportConnectionTrustUseCase({
    transportSecurityPolicyResolverPort: new BaselineTransportSecurityPolicyResolver(),
    transportConnectionPolicyEvaluatorPort: new DomainTransportConnectionPolicyEvaluator(),
    trustedDeviceStateResolverPort: transportTrustStateResolver,
    nodeStateResolverPort: transportTrustStateResolver,
    peerCertificateStateResolverPort: transportTrustStateResolver,
    transportConnectionPolicyAuditPort: transportSecurityObservability,
  });
  const httpTransportTrustValidator = new HttpTransportTrustValidationAdapter(
    transportTrustValidator,
    transportSecurityObservability,
  );
  const websocketTransportTrustValidator = new WebSocketTransportTrustValidationAdapter(
    transportTrustValidator,
    transportSecurityObservability,
  );
  const managedTlsMaterial = await resolveManagedIdentityServerTlsRuntimeMaterial({
    certificateAuthorityRepository,
    env,
  });
  const enableDevLoginRoute = resolveIdentityDevLoginRouteEnabled(env);
  if (secureTransportConfig.requireSecureHttp && !managedTlsMaterial) {
    throw new Error(
      "Identity server secure transport configuration requires HTTPS startup, but managed TLS material is unavailable.",
    );
  }

  const server = createIdentityHttpServer({
    backendApi,
    certificateOperationsBackendApi,
    secretMetadataBackendApi,
    storageManagementBackendApi,
    assetManagementBackendApi,
    imageAssetManagementBackendApi,
    auditLedgerBackendApi,
    deploymentPolicyReadBackendApi,
    deploymentPolicyWriteBackendApi,
    authoritativeRunSubmissionBackendApi,
    authoritativeRunQueryBackendApi,
    authoritativeRunMutationBackendApi,
    authoritativeRunExecutionUpdateBackendApi,
    nodeTrustBackendApi,
    authorizationManagementBackendApi,
    workspaceBackendApi,
    workspaceAdministrationBackendApi,
    routeRegistrationPlan: options.routeRegistrationPlan,
    cors: options.cors,
    logger: options.logger,
    secureTransport: Object.freeze({
      requireHttps: secureTransportConfig.requireSecureHttp,
      requireWss: secureTransportConfig.requireSecureWebSocket,
      allowInsecureLoopback: secureTransportConfig.allowInsecureLoopback,
    }),
    serverFactory: managedTlsMaterial
      ? createManagedIdentityServerTlsFactory(managedTlsMaterial)
      : undefined,
    transportTrust: secureTransportConfig.enforceTransportTrustValidation
      ? Object.freeze({
        httpValidator: httpTransportTrustValidator,
        websocketValidator: websocketTransportTrustValidator,
        allowInsecureLoopback: secureTransportConfig.allowInsecureLoopback,
      })
      : undefined,
    webSocket: Object.freeze({
      channelPathPrefix: "/ws",
    }),
    development: Object.freeze({
      enableDevLoginRoute,
    }),
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, hostAddress, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const addressInfo = server.address() as AddressInfo;
  if (!secretService) {
    throw new Error("Secret service composition is unavailable.");
  }
  const platformSecretConsumers = new ServerPlatformSecretConsumers(
    secretService.runtimeSecretConsumptionAdapters,
  );

  return Object.freeze({
    port: addressInfo.port,
    address: `${addressInfo.address}:${addressInfo.port}`,
    secretService,
    platformSecretConsumers,
      close: () => new Promise<void>((resolve, reject) => {
        server.close((error) => {
          imageAssetRepository.dispose();
          if (ownsPersistentPlatformServices) {
            persistentPlatformServices.dispose();
          }
          secretService?.dispose();
          const disposablePublisher = eventPublisher as Partial<{ dispose: () => void }>;
          if (typeof disposablePublisher.dispose === "function") {
            disposablePublisher.dispose();
          }
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
    });
  } catch (error) {
    imageAssetRepository.dispose();
    if (ownsPersistentPlatformServices) {
      persistentPlatformServices.dispose();
    }
    secretService?.dispose();
    throw error;
  }
}

export async function applyIdentityStartupConfiguration(
  repository: IdentityDefaultConfigurationRepository,
  policies: IdentityProviderAccountPolicyConfig,
): Promise<void> {
  if (!policies.bootstrapSeedDefaults) {
    return;
  }

  await repository.saveAuthProvider(createAuthProvider({
    id: policies.localProviderId,
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: policies.localProviderDisplayName,
    status: policies.localProviderStatus,
  }));

  await repository.saveCredentialPolicy(policies.buildLocalCredentialPolicy());
}

function normalizeNamespace(namespace: IdentityIdNamespace): string {
  switch (namespace) {
    case IdentityIdNamespaces.userIdentity:
      return "user";
    case IdentityIdNamespaces.identitySession:
      return "session";
    case IdentityIdNamespaces.provider:
      return "provider";
    case IdentityIdNamespaces.credentialPolicy:
      return "policy";
    case IdentityIdNamespaces.credentialMaterial:
      return "credential";
    default:
      return namespace;
  }
}

function parseOptionalCsvList(value: string | undefined): ReadonlyArray<string> | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  const entries = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.length > 0 ? Object.freeze(entries) : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function resolveStorageSyncDeploymentAvailability(
  env: Readonly<Record<string, string | undefined>>,
): typeof StorageSyncDeploymentAvailabilities[keyof typeof StorageSyncDeploymentAvailabilities] {
  const configured = env.AI_LOOM_STORAGE_SYNC_DEPLOYMENT_AVAILABILITY?.trim().toLowerCase();
  switch (configured) {
    case StorageSyncDeploymentAvailabilities.active:
      return StorageSyncDeploymentAvailabilities.active;
    case StorageSyncDeploymentAvailabilities.configuredInactive:
      return StorageSyncDeploymentAvailabilities.configuredInactive;
    case StorageSyncDeploymentAvailabilities.unavailable:
      return StorageSyncDeploymentAvailabilities.unavailable;
    default:
      return StorageSyncDeploymentAvailabilities.configuredInactive;
  }
}

function resolveManagedStorageRootPath(
  databasePath: string,
  env: Readonly<Record<string, string | undefined>>,
): string {
  const configured = env.AI_LOOM_STORAGE_MANAGED_ROOT_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(path.dirname(databasePath), "runtime-assets", "managed-storage");
}

function resolveAssetDownloadGrantSecret(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const configured = env.AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET?.trim();
  if (configured) {
    return configured;
  }
  return `asset-download-grant:${randomUUID()}`;
}

function resolveAssetContentEncryptionKey(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const configured = env.AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY?.trim();
  if (configured) {
    return configured;
  }

  const inheritedSecretKey = env.AI_LOOM_SECRET_MASTER_KEY?.trim();
  if (inheritedSecretKey) {
    return inheritedSecretKey;
  }

  return createHash("sha256")
    .update(`asset-content:${randomUUID()}`)
    .digest("base64");
}

function resolveImageAssetStorageTokenSecret(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const configured = env.AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET?.trim();
  if (configured) {
    return configured;
  }

  const inheritedSecretKey = env.AI_LOOM_SECRET_MASTER_KEY?.trim();
  if (inheritedSecretKey) {
    return inheritedSecretKey;
  }

  return createHash("sha256")
    .update(`image-asset-storage:${randomUUID()}`)
    .digest("base64");
}

function resolveImageAssetUploadSessionTokenSecret(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const configured = env.AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET?.trim();
  if (configured) {
    return configured;
  }

  const inheritedSecretKey = env.AI_LOOM_SECRET_MASTER_KEY?.trim();
  if (inheritedSecretKey) {
    return inheritedSecretKey;
  }

  return createHash("sha256")
    .update(`image-asset-upload-session:${randomUUID()}`)
    .digest("base64");
}

function resolveIdentityDevLoginRouteEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const explicit = parseOptionalBoolean(env.AI_LOOM_ENABLE_DEV_LOGIN);
  if (typeof explicit === "boolean") {
    return explicit;
  }

  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv !== "production";
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function createSecretOperationalLogger(logger: IdentityHttpServerLogger | undefined): {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
} | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: "secret.operation",
        requestId: resolveOptionalString(event.secretId) ?? resolveOptionalString(event.actorId),
        details: Object.freeze({
          secret: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: "secret.operation",
        requestId: resolveOptionalString(event.secretId) ?? resolveOptionalString(event.actorId),
        details: Object.freeze({
          secret: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: "secret.operation",
        requestId: resolveOptionalString(event.secretId) ?? resolveOptionalString(event.actorId),
        details: Object.freeze({
          secret: event,
        }),
      });
    },
  });
}

function createRunOrchestrationOperationalLogger(logger: IdentityHttpServerLogger | undefined): {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
} | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "run.orchestration.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.runId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          orchestration: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "run.orchestration.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.runId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          orchestration: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "run.orchestration.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.runId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          orchestration: event,
        }),
      });
    },
  });
}

function createDeploymentPolicyAdministrationOperationalLogger(logger: IdentityHttpServerLogger | undefined): {
  info(event: Readonly<Record<string, unknown>>): void;
  warn(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
} | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Readonly<Record<string, unknown>>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "deployment-policy-admin.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          deploymentPolicyAdministration: event,
        }),
      });
    },
    warn: (event: Readonly<Record<string, unknown>>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "deployment-policy-admin.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          deploymentPolicyAdministration: event,
        }),
      });
    },
    error: (event: Readonly<Record<string, unknown>>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "deployment-policy-admin.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          deploymentPolicyAdministration: event,
        }),
      });
    },
  });
}

function createAuditLedgerOperationalLogger(logger: IdentityHttpServerLogger | undefined): {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
} | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "audit-ledger.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.eventId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          auditLedger: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "audit-ledger.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.eventId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          auditLedger: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "audit-ledger.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.eventId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          auditLedger: event,
        }),
      });
    },
  });
}

function createEncryptionOperationalLogger(logger: IdentityHttpServerLogger | undefined): {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
} | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: "encryption.enforcement",
        requestId: resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId)
          ?? resolveOptionalString(event.event),
        details: Object.freeze({
          encryption: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: "encryption.enforcement",
        requestId: resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId)
          ?? resolveOptionalString(event.event),
        details: Object.freeze({
          encryption: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: "encryption.enforcement",
        requestId: resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId)
          ?? resolveOptionalString(event.event),
        details: Object.freeze({
          encryption: event,
        }),
      });
    },
  });
}

function createImageAssetManagementOperationalLogger(logger: IdentityHttpServerLogger | undefined): {
  info(event: Record<string, unknown>): void;
  warn(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
} | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "image-asset-management.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.assetId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          imageAssetManagement: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "image-asset-management.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.assetId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          imageAssetManagement: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "image-asset-management.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.assetId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          imageAssetManagement: event,
        }),
      });
    },
  });
}

function createSecretAccessAuditHook(
  logger: IdentityHttpServerLogger | undefined,
): ((event: Record<string, unknown>) => void) | undefined {
  if (!logger) {
    return undefined;
  }

  return (event) => {
    const eventKind = resolveOptionalString(event.eventKind) ?? "secret.audit";
    const actor = (typeof event.actor === "object" && event.actor) ? event.actor as Record<string, unknown> : undefined;
    const target = (typeof event.target === "object" && event.target) ? event.target as Record<string, unknown> : undefined;
    const status = resolveOptionalString(event.status);
    const decision = resolveOptionalString(event.decision);
    const level = decision === "denied" || status === "denied" || status === "failed" ? "warn" : "info";
    const requestId = resolveOptionalString(target?.secretId)
      ?? resolveOptionalString(actor?.actorId)
      ?? resolveOptionalString(event.operation)
      ?? eventKind;
    logger[level]({
      event: eventKind,
      requestId,
      details: Object.freeze({
        secret: Object.freeze({
          operation: resolveOptionalString(event.operation),
          action: resolveOptionalString(event.action),
          status,
          decision,
          reasonCode: resolveOptionalString(event.reasonCode),
          reason: resolveOptionalString(event.reason),
          operationKey: resolveOptionalString(event.operationKey),
          serviceIdentity: resolveOptionalString(event.serviceIdentity),
          actorId: resolveOptionalString(actor?.actorId),
          actorType: resolveOptionalString(actor?.actorType),
          actorWorkspaceId: resolveOptionalString(actor?.workspaceId),
          actorUserIdentityId: resolveOptionalString(actor?.userIdentityId),
          secretId: resolveOptionalString(target?.secretId),
          scope: resolveOptionalString(target?.scope),
          targetWorkspaceId: resolveOptionalString(target?.workspaceId),
          targetUserIdentityId: resolveOptionalString(target?.userIdentityId),
          occurredAt: resolveOptionalString(event.occurredAt),
        }),
      }),
    });
  };
}

function resolveOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

async function validateCertificateAuthorityStartup(
  certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(env);
  const startupStateUseCase = new ResolveCertificateAuthorityStartupStateUseCase({
    configurationProvider: new EnvironmentCertificateAuthorityBootstrapConfigurationProvider(env),
    secretService: new EnvironmentCertificateAuthoritySecretService(env, {
      protectedSecretStore,
    }),
    certificateAuthorityRepository,
    trustMaterialRepository: certificateAuthorityRepository,
  });

  const startupState = await startupStateUseCase.execute();
  assertCertificateAuthorityStartupSafe(startupState);
}

function createManagedIdentityServerTlsFactory(
  tlsMaterial: ManagedIdentityServerTlsRuntimeMaterial,
): IdentityHttpServerFactory {
  return (requestListener) => createHttpsServer({
    cert: tlsMaterial.certPem,
    key: tlsMaterial.keyPem,
    ca: tlsMaterial.caPem,
    requestCert: true,
    rejectUnauthorized: false,
  }, requestListener);
}

async function resolveManagedIdentityServerTlsRuntimeMaterial(input: {
  readonly certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter;
  readonly env: Readonly<Record<string, string | undefined>>;
}): Promise<ManagedIdentityServerTlsRuntimeMaterial | undefined> {
  const tlsEnabled = parseOptionalBoolean(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.enabled]) ?? false;
  if (!tlsEnabled) {
    return undefined;
  }

  const targetReferenceId = normalizeOptional(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.targetReferenceId])
    ?? "server:authoritative";
  if (!targetReferenceId.startsWith("server:")) {
    throw new Error("Managed identity-server TLS requires AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID to start with 'server:'.");
  }

  const privateKeyMaterialRef = normalizeOptional(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.privateKeyMaterialRef]);
  if (!privateKeyMaterialRef) {
    throw new Error("Managed identity-server TLS requires AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF.");
  }

  const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(input.env);
  if (!protectedSecretStore) {
    throw new Error("Managed identity-server TLS requires protected secret storage configuration.");
  }

  const certificateMaterialStorage = new ProtectedCertificateAuthorityRootMaterialStorage(protectedSecretStore);
  const runtimeTrustMaterialDistributionService = new RuntimeTrustMaterialDistributionService({
    certificateAuthorityRepository: input.certificateAuthorityRepository,
    issuedCertificateRepository: input.certificateAuthorityRepository,
    trustMaterialReferenceRepository: input.certificateAuthorityRepository,
    certificateMaterialStorage,
    certificateLifecycleEventRepository: input.certificateAuthorityRepository,
  });
  const resolveRuntimeTrustMaterialPackageUseCase = new ResolveRuntimeTrustMaterialPackageUseCase({
    trustMaterialDistributionPort: runtimeTrustMaterialDistributionService,
  });

  const actorUserIdentityId = normalizeOptional(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.actorUserIdentityId])
    ?? "system:identity-server-host";
  const runtimeTrustPackage = await resolveRuntimeTrustMaterialPackageUseCase.execute({
    operationKey: `identity-server-managed-tls-runtime-package:${targetReferenceId}:${Date.now()}`,
    actorUserIdentityId,
    targetKind: "server",
    targetReferenceId,
    workspaceId: normalizeOptional(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.workspaceId]),
    certificateAuthorityId: normalizeOptional(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.certificateAuthorityId]),
    serialNumber: normalizeOptional(input.env[MANAGED_IDENTITY_SERVER_TLS_ENV_KEYS.serialNumber]),
    includeLeafCertificate: true,
    includeCertificateChain: true,
    includeTrustBundle: true,
  });

  if (!runtimeTrustPackage.ok) {
    throw new Error(
      `Managed identity-server TLS startup failed: runtime trust package retrieval failed (${runtimeTrustPackage.error.code}).`,
    );
  }

  if (!runtimeTrustPackage.value.serialNumber) {
    throw new Error("Managed identity-server TLS startup failed: server runtime trust package is missing serialNumber.");
  }

  const revocationStatusUseCase = new ResolveCertificateRevocationStatusUseCase({
    issuedCertificateRepository: input.certificateAuthorityRepository,
    certificateLifecycleEventRepository: input.certificateAuthorityRepository,
  });
  const revocationStatus = await revocationStatusUseCase.resolveCertificateRevocationStatus({
    serialNumber: runtimeTrustPackage.value.serialNumber,
  });
  if (!revocationStatus.usable || revocationStatus.status !== "active") {
    throw new Error(
      `Managed identity-server TLS startup failed: server certificate '${runtimeTrustPackage.value.serialNumber}' is not usable (status='${revocationStatus.status}').`,
    );
  }

  const privateKeyMaterial = await input.certificateAuthorityRepository.findTrustMaterialByRef(privateKeyMaterialRef);
  if (!privateKeyMaterial) {
    throw new Error("Managed identity-server TLS startup failed: private key trust material is unavailable.");
  }

  if (privateKeyMaterial.kind !== TrustMaterialKinds.privateKeyEncryptedPem) {
    throw new Error("Managed identity-server TLS startup failed: private key trust material kind is invalid.");
  }

  const loadedPrivateKey = await certificateMaterialStorage.loadRootMaterials({
    certificateAuthorityId: runtimeTrustPackage.value.certificateAuthorityId,
    reason: "identity-server-managed-tls-startup",
    materials: [{
      materialRef: privateKeyMaterial.materialRef,
      kind: privateKeyMaterial.kind,
      secretRef: privateKeyMaterial.storageLocator,
    }],
  });
  const privateKeyPem = loadedPrivateKey[0]?.plaintextValue?.trim();
  if (!privateKeyPem) {
    throw new Error("Managed identity-server TLS startup failed: private key material is unavailable.");
  }

  const leafCertificatePem = runtimeTrustPackage.value.leafCertificatePem?.trim();
  if (!leafCertificatePem) {
    throw new Error("Managed identity-server TLS startup failed: leaf certificate material is unavailable.");
  }

  const certificateFragments = [
    leafCertificatePem,
    runtimeTrustPackage.value.certificateChainPem?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));

  return Object.freeze({
    certPem: `${certificateFragments.join("\n")}\n`,
    keyPem: `${privateKeyPem}\n`,
    caPem: runtimeTrustPackage.value.trustBundlePem?.trim()
      ? `${runtimeTrustPackage.value.trustBundlePem.trim()}\n`
      : undefined,
  });
}

export async function initializeCertificateAuthorityForFirstSetup(
  options: InitializeCertificateAuthorityForFirstSetupOptions,
  input: InitializeCertificateAuthorityUseCaseInput,
): Promise<InitializeCertificateAuthorityUseCaseResult> {
  const certificateAuthorityRepository = new SqliteCertificateAuthorityPersistenceAdapter(path.resolve(options.databasePath));
  const env = options.env ?? process.env;
  const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(env);
  if (!protectedSecretStore) {
    throw new Error("Internal CA protected secret storage must be configured before CA initialization.");
  }

  try {
    const useCase = new InitializeCertificateAuthorityUseCase({
      certificateAuthorityRepository,
      trustMaterialRepository: certificateAuthorityRepository,
      rootMaterialStorage: new ProtectedCertificateAuthorityRootMaterialStorage(
        protectedSecretStore,
      ),
      issuer: options.issuer,
      auditHook: options.auditHook,
    });
    return await useCase.execute(input);
  } finally {
    certificateAuthorityRepository.dispose();
  }
}

