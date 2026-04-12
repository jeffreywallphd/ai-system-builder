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
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "@application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "@application/identity/ports/IIdentityLifecycleEventPublisher";
import { ScryptLocalPasswordCredentialService } from "@infrastructure/security/identity/ScryptLocalPasswordCredentialService";
import { IdentitySessionPolicyConfig } from "@infrastructure/config/IdentitySessionPolicyConfig";
import { IdentitySessionTrustPolicyConfig } from "@infrastructure/config/IdentitySessionTrustPolicyConfig";
import { IdentityProviderAccountPolicyConfig } from "@infrastructure/config/IdentityProviderAccountPolicyConfig";
import { resolveAuditRetentionLifecycleConfig } from "@infrastructure/config/AuditRetentionLifecycleConfig";
import {
  HostSecureTransportKinds,
  resolveHostSecureTransportConfig,
} from "@infrastructure/config/HostSecureTransportConfig";
import { TrustedDeviceManagementService } from "@application/identity/services/TrustedDeviceManagementService";
import {
  FanoutStorageManagementAuditSink,
  FanoutAssetAuditSink,
  FanoutNodeTrustAuditSink,
  FanoutRunSubmissionAuditSink,
  FanoutDeploymentPolicyGovernanceEventSink,
} from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeNodeTrustAuditSink } from "@infrastructure/audit/AuthoritativeNodeTrustAuditSink";
import { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import { AuthoritativeAuthorizationPolicyEventRecorder } from "@infrastructure/audit/AuthoritativeAuthorizationPolicyEventRecorder";
import { AuthoritativeStorageManagementAuditSink } from "@infrastructure/audit/AuthoritativeStorageManagementAuditSink";
import { AuthoritativeProtectedAssetAuditSink } from "@infrastructure/audit/AuthoritativeProtectedAssetAuditSink";
import { AuthoritativeImageAssetAuditSink } from "@infrastructure/audit/AuthoritativeImageAssetAuditSink";
import { AuthoritativeGeneratedResultAuditSink } from "@infrastructure/audit/AuthoritativeGeneratedResultAuditSink";
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
import { ExecutionNodeManagementBackendApi } from "@infrastructure/api/nodes/ExecutionNodeManagementBackendApi";
import { CertificateOperationsBackendApi } from "@infrastructure/api/security/CertificateOperationsBackendApi";
import { SecretMetadataBackendApi } from "@infrastructure/api/security/SecretMetadataBackendApi";
import { StorageManagementBackendApi } from "@infrastructure/api/storage/StorageManagementBackendApi";
import { WorkspaceAwareStoragePolicyEvaluationAdapter } from "@infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter";
import { AssetManagementBackendApi } from "@infrastructure/api/assets/AssetManagementBackendApi";
import { ImageAssetManagementBackendApi } from "@infrastructure/api/image-assets/ImageAssetManagementBackendApi";
import { ImageAssetManagementObservability } from "@infrastructure/api/image-assets/ImageAssetManagementObservability";
import { GeneratedResultManagementBackendApi } from "@infrastructure/api/generated-results/GeneratedResultManagementBackendApi";
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
import { SqliteRunCollectedResultPersistenceAdapter } from "@infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter";
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
import { GenerateGeneratedResultPreviewUseCase } from "@application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCase";
import { GetGeneratedResultOriginalContentUseCase } from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase";
import { GetGeneratedResultMetadataUseCase } from "@application/generated-results/use-cases/GetGeneratedResultMetadataUseCase";
import { GetGeneratedResultLineageDetailUseCase } from "@application/generated-results/use-cases/GetGeneratedResultLineageDetailUseCase";
import { GetGeneratedResultLineageSummaryUseCase } from "@application/generated-results/use-cases/GetGeneratedResultLineageSummaryUseCase";
import { ListGeneratedResultMetadataUseCase } from "@application/generated-results/use-cases/ListGeneratedResultMetadataUseCase";
import { OpenGeneratedResultPreviewContentUseCase } from "@application/generated-results/use-cases/OpenGeneratedResultPreviewContentUseCase";
import { RequestGeneratedResultPreviewContentUseCase } from "@application/generated-results/use-cases/RequestGeneratedResultPreviewContentUseCase";
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
import { SharpGeneratedResultPreviewImageProcessor } from "@infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor";
import { TokenizedGeneratedResultPreviewAccessPort } from "@infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort";
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
import { ImageRunSubmissionReadinessValidationService } from "@application/image-workflows/ImageRunSubmissionReadinessValidationService";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import { ImageRunExecutionNodeSelectionService } from "@application/nodes/use-cases/ImageRunExecutionNodeSelectionService";
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
import { ListExecutionNodesUseCase } from "@application/nodes/use-cases/ListExecutionNodesUseCase";
import { GetExecutionNodeDetailUseCase } from "@application/nodes/use-cases/GetExecutionNodeDetailUseCase";
import { RecordNodeHeartbeatUseCase } from "@application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RecordNodeOperationalUpdateUseCase } from "@application/nodes/use-cases/RecordNodeOperationalUpdateUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "@application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "@application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { SetExecutionNodeAvailabilityOverrideUseCase } from "@application/nodes/use-cases/SetExecutionNodeAvailabilityOverrideUseCase";
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
import {
  composeServerIdentitySessionTrustedDeviceCompositionModule,
  type ServerIdentitySessionTrustedDeviceCompositionModuleOutput,
} from "./composition/ServerIdentitySessionTrustedDeviceCompositionModule";
import { composeServerWorkspaceAuthorizationCompositionModule } from "./composition/ServerWorkspaceAuthorizationCompositionModule";
import { composeServerDeploymentPolicyCompositionModule } from "./composition/ServerDeploymentPolicyCompositionModule";
import { composeServerSecretCompositionModule } from "./composition/ServerSecretCompositionModule";
import { composeServerCertificateCompositionModule } from "./composition/ServerCertificateCompositionModule";
import { composeServerNodeTrustCompositionModule } from "./composition/ServerNodeTrustCompositionModule";
import { composeServerTlsMaterialCompositionModule } from "./composition/ServerTlsMaterialCompositionModule";
import { composeServerStorageAssetCompositionModule } from "./composition/ServerStorageAssetCompositionModule";
import { composeServerImageMediaCompositionModule } from "./composition/ServerImageMediaCompositionModule";
import { composeServerGeneratedResultCompositionModule } from "./composition/ServerGeneratedResultCompositionModule";
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
import { createStartupTracer, type StartupSpan, type StartupTracer } from "@hosts/bootstrap/startupTracer";

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
  readonly startupTracer?: StartupTracer;
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
  const executionNodeRepository = persistentPlatformServices.executionNodeRepository;
  const nodeTrustAuditRecorder = persistentPlatformServices.nodeTrustAuditRecorder;
  const certificateAuthorityRepository = persistentPlatformServices.certificateAuthorityRepository;
  const env = options.env ?? process.env;
  const hostAddress = options.host ?? "127.0.0.1";
  const secureTransportConfig = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.server,
    hostAddress,
    env,
  });
  const startupTracer = options.startupTracer ?? createStartupTracer({
    startupReason: "authoritative-server-runtime-startup",
  });
  const startupRootSpan = startupTracer.startSpan("authoritative-server-runtime-startup", {
    metadata: Object.freeze({
      hostAddress,
      startupReason: "authoritative-server-runtime-startup",
    }),
  });
  let secretService: ServerComposedSecretService | undefined;
  let identitySessionTrustedDeviceComposition:
    | ServerIdentitySessionTrustedDeviceCompositionModuleOutput
    | undefined;
  let imageMediaComposition:
    | ReturnType<typeof composeServerImageMediaCompositionModule>
    | undefined;
  try {
    const auditRetentionLifecycleConfig = await runStartupStepSpan({
      tracer: startupTracer,
      parentSpan: startupRootSpan,
      name: "config-load",
      metadata: Object.freeze({
        component: "identity-server-host",
      }),
      run: async () => resolveAuditRetentionLifecycleConfig({
        env,
        deploymentProfile: options.deploymentProfile
          ? {
            profileId: options.deploymentProfile.profileId,
          }
          : undefined,
      }),
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
    const secretComposition = await composeServerSecretCompositionModule({
      databasePath: options.databasePath,
      env,
      workspaceRepository,
      authoritativeAuditRecorder,
      observabilityLogger: createSecretOperationalLogger(options.logger),
      legacySecretAccessAuditHook,
    });
    secretService = secretComposition.secretService;
    const protectedSecretStore = secretComposition.protectedSecretStore;
    const providerAccountPolicies = await runStartupStepSpan({
      tracer: startupTracer,
      parentSpan: startupRootSpan,
      name: "identity-provider-policy-load",
      run: async () => options.providerAccountPolicies
        ?? IdentityProviderAccountPolicyConfig.fromEnv(env),
    });
    await runStartupStepSpan({
      tracer: startupTracer,
      parentSpan: startupRootSpan,
      name: "identity-startup-configuration",
      run: async () => {
        await applyIdentityStartupConfiguration(repository, providerAccountPolicies);
      },
    });
    const certificateComposition = await runStartupStepSpan({
      tracer: startupTracer,
      parentSpan: startupRootSpan,
      name: "ca-init",
      run: async () => composeServerCertificateCompositionModule({
        env,
        certificateAuthorityRepository,
        nodeTrustRepository,
        protectedSecretStore,
      }),
    });
    const certificateOperationsBackendApi = certificateComposition.certificateOperationsBackendApi;

    const authenticator = new LocalPasswordIdentityAuthenticator(new ScryptLocalPasswordCredentialService());
    const identityPolicyService = new IdentityPolicyService(repository);
    const clock = new SystemIdentityClock();
    const idGenerator = new RandomIdentityIdGenerator();
    const sessionPolicies = options.sessionPolicies
      ?? IdentitySessionPolicyConfig.fromEnv(env).policies;
    const sessionTrustPolicies = IdentitySessionTrustPolicyConfig.fromEnv(env).policies;
    identitySessionTrustedDeviceComposition = composeServerIdentitySessionTrustedDeviceCompositionModule({
      databasePath,
      env,
      identityRepository: repository,
      trustedDeviceRepository,
      identityPolicyService,
      credentialAuthenticator: authenticator,
      idGenerator,
      clock,
      sessionPolicies,
      sessionTrustPolicies,
      providerAccountPolicies,
      authoritativeAuditRecorder,
      eventPublisherOverride: options.eventPublisher,
    });
    const backendApi = identitySessionTrustedDeviceComposition.backendApi;
    const trustedDeviceManagementService = identitySessionTrustedDeviceComposition.trustedDeviceManagementService;
    const workspaceAuthorizationComposition = composeServerWorkspaceAuthorizationCompositionModule({
      workspaceRepository,
      authorizationRepository,
      authoritativeAuditRecorder,
      deploymentPolicyBootstrap: options.deploymentPolicyBootstrap,
    });
    const workspaceClock = workspaceAuthorizationComposition.workspaceClock;
    const authorizationDecisionEvaluator = workspaceAuthorizationComposition.authorizationDecisionEvaluator;
    const workspaceBackendApi = workspaceAuthorizationComposition.workspaceBackendApi;
    const workspaceAdministrationBackendApi = workspaceAuthorizationComposition.workspaceAdministrationBackendApi;
    const authorizationManagementBackendApi = workspaceAuthorizationComposition.authorizationManagementBackendApi;
    const secretMetadataBackendApi = secretComposition.secretMetadataBackendApi;
    const nodeTrustComposition = composeServerNodeTrustCompositionModule({
      nodeTrustRepository,
      executionNodeRepository,
      nodeTrustAuditRecorder,
      authoritativeAuditRecorder,
      runtimeTrustMaterialResolver: certificateComposition.runtimeTrustMaterialResolver,
      workspaceClock,
    });
    const nodeTrustBackendApi = nodeTrustComposition.nodeTrustBackendApi;
    const executionNodeManagementBackendApi = nodeTrustComposition.executionNodeManagementBackendApi;
  const storageAssetComposition = composeServerStorageAssetCompositionModule({
    databasePath: options.databasePath,
    env,
    persistentPlatformServices,
    authoritativeAuditRecorder,
    encryptionObservabilityLogger: createEncryptionOperationalLogger(options.logger),
  });
  const storageManagementBackendApi = storageAssetComposition.storageManagementBackendApi;
  const assetManagementBackendApi = storageAssetComposition.assetManagementBackendApi;
  const storageLogicalAccessResolutionService = storageAssetComposition.storageLogicalAccessResolutionService;
  const workspaceAwareStoragePolicyEvaluationAdapter = storageAssetComposition.workspaceAwareStoragePolicyEvaluationAdapter;
  const assetEncryptionPolicyEvaluationService = storageAssetComposition.assetEncryptionPolicyEvaluationService;
  imageMediaComposition = composeServerImageMediaCompositionModule({
    databasePath,
    env,
    persistentPlatformServices,
    authorizationDecisionEvaluator,
    authoritativeAuditRecorder,
    imageAssetObservabilityLogger: createImageAssetManagementOperationalLogger(options.logger),
    storageLogicalAccessResolutionService,
    workspaceAwareStoragePolicyEvaluationAdapter,
  });
  const imageAssetManagementBackendApi = imageMediaComposition.imageAssetManagementBackendApi;
  const runSubmissionAuditSink = new PlatformRunSubmissionAuditSink(
    persistentPlatformServices.platformPersistenceRepository,
  );
  const authoritativeRunSubmissionAuditSink = new FanoutRunSubmissionAuditSink([
    runSubmissionAuditSink,
    new AuthoritativeRunSubmissionAuditSink(authoritativeAuditRecorder),
  ]);
  const executionNodeManagementAuditSink = new AuthoritativeExecutionNodeManagementAuditSink(
    authoritativeAuditRecorder,
  );
  const validateRunSubmissionUseCase = new ValidateRunSubmissionUseCase({
    workspaceRepository,
    authorizationDecisionEvaluator,
    targetResolver: new AssetBackedRunSubmissionTargetResolver(persistentPlatformServices.assetRepository),
    storageInstanceRepository: persistentPlatformServices.storageInstanceRepository,
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
  const imageRunNodeEligibilityEvaluationService = new ImageRunNodeEligibilityEvaluationService({
    nodeRepository: executionNodeRepository,
  });
  const imageRunExecutionNodeSelectionService = new ImageRunExecutionNodeSelectionService({
    eligibilityService: imageRunNodeEligibilityEvaluationService,
    auditSink: executionNodeManagementAuditSink,
  });
  const getImageManipulationExecutionReadinessUseCase = new GetImageManipulationExecutionReadinessUseCase({
    capabilityPort: options.runExecutionAdapters?.capabilityProbePort,
    nodeSelectionService: imageRunExecutionNodeSelectionService,
    now: () => workspaceClock.now(),
  });
  const imageRunSubmissionReadinessValidationService = new ImageRunSubmissionReadinessValidationService({
    workflowRepository: persistentPlatformServices.imageWorkflowSystemRepository,
    systemRepository: persistentPlatformServices.imageWorkflowSystemRepository,
    assetRepository: persistentPlatformServices.assetRepository,
    authorizationDecisionEvaluator,
    executionReadinessUseCase: getImageManipulationExecutionReadinessUseCase,
    now: () => workspaceClock.now(),
  });
  const submitImageRunUseCase = new SubmitImageRunUseCase({
    validateRunSubmissionUseCase,
    createAuthoritativeRunUseCase,
    imageRunReadinessResolver: imageRunSubmissionReadinessValidationService,
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
    getImageManipulationExecutionReadinessUseCase,
    runRepository: persistentPlatformServices.platformPersistenceRepository,
    auditEventRepository: persistentPlatformServices.platformPersistenceRepository,
    authorizationDecisionEvaluator,
    observability: runOrchestrationObservability,
    now: () => workspaceClock.now(),
  });
  const deploymentPolicyComposition = composeServerDeploymentPolicyCompositionModule({
    persistentPlatformServices,
    authoritativeAuditRecorder,
    observabilityLogger: createDeploymentPolicyAdministrationOperationalLogger(options.logger),
    hostLogger: options.logger,
  });
  const deploymentPolicyReadBackendApi = deploymentPolicyComposition.deploymentPolicyReadBackendApi;
  const deploymentPolicyWriteBackendApi = deploymentPolicyComposition.deploymentPolicyWriteBackendApi;
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
  const generatedResultComposition = composeServerGeneratedResultCompositionModule({
    env,
    persistentPlatformServices,
    workspaceClock,
    authoritativeAuditRecorder,
    storageLogicalAccessResolutionService,
  });
  const generatedResultManagementBackendApi = generatedResultComposition.generatedResultManagementBackendApi;
  const runCollectedResultPersistencePort = generatedResultComposition.runCollectedResultPersistencePort;
  const authoritativeRunMutationBackendApi = new AuthoritativeRunMutationBackendApi({
    requestAuthoritativeRunCancellationUseCase: new RequestAuthoritativeRunCancellationUseCase({
      runRepository: persistentPlatformServices.platformPersistenceRepository,
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      cancellationSignalPort: options.runExecutionAdapters?.cancellationSignalPort,
      resultCollectionPersistencePort: runCollectedResultPersistencePort,
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
      resultCollectionPersistencePort: runCollectedResultPersistencePort,
      authoritativeAuditRecorder: authoritativeAuditRecorder,
      transactionManager: persistentPlatformServices.platformPersistenceRepository,
      now: () => workspaceClock.now(),
    }),
    observability: runOrchestrationObservability,
  });
  const runStartupRecovery = await runStartupStepSpan({
    tracer: startupTracer,
    parentSpan: startupRootSpan,
    name: "orchestration-recovery",
    run: async () => new RecoverRunOrchestrationStartupStateUseCase({
      runRepository: persistentPlatformServices.platformPersistenceRepository,
      queueRepository: persistentPlatformServices.platformPersistenceRepository,
      placementHoldRepository: persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: persistentPlatformServices.platformPersistenceRepository,
      resultCollectionPersistencePort: runCollectedResultPersistencePort,
      transactionManager: persistentPlatformServices.platformPersistenceRepository,
      now: () => workspaceClock.now(),
    }).execute(),
  });
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
  const tlsComposition = await composeServerTlsMaterialCompositionModule({
    env,
    logger: options.logger,
    secureTransportConfig,
    certificateAuthorityRepository,
    nodeTrustRepository,
    trustedDeviceManagementService,
    protectedSecretStore,
  });
  const enableDevLoginRoute = resolveIdentityDevLoginRouteEnabled(env);

  const server = createIdentityHttpServer({
    backendApi,
    certificateOperationsBackendApi,
    secretMetadataBackendApi,
    storageManagementBackendApi,
    assetManagementBackendApi,
    imageAssetManagementBackendApi,
    generatedResultManagementBackendApi,
    auditLedgerBackendApi,
    deploymentPolicyReadBackendApi,
    deploymentPolicyWriteBackendApi,
    authoritativeRunSubmissionBackendApi,
    authoritativeRunQueryBackendApi,
    authoritativeRunMutationBackendApi,
    authoritativeRunExecutionUpdateBackendApi,
    nodeTrustBackendApi,
    executionNodeManagementBackendApi,
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
    serverFactory: tlsComposition.serverFactory,
    transportTrust: tlsComposition.transportTrust,
    webSocket: Object.freeze({
      channelPathPrefix: "/ws",
    }),
    development: Object.freeze({
      enableDevLoginRoute,
    }),
  });

  await runStartupStepSpan({
    tracer: startupTracer,
    parentSpan: startupRootSpan,
    name: "server-start",
    metadata: Object.freeze({
      hostAddress,
      requestedPort: options.port ?? 0,
    }),
    run: async () => new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port ?? 0, hostAddress, () => {
        server.off("error", reject);
        resolve();
      });
    }),
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
          imageMediaComposition?.dispose();
          if (ownsPersistentPlatformServices) {
            persistentPlatformServices.dispose();
          }
          secretService?.dispose();
          identitySessionTrustedDeviceComposition?.dispose();
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
    });
  } catch (error) {
    startupRootSpan.fail(error);
    imageMediaComposition?.dispose();
    if (ownsPersistentPlatformServices) {
      persistentPlatformServices.dispose();
    }
    secretService?.dispose();
    identitySessionTrustedDeviceComposition?.dispose();
    throw error;
  } finally {
    startupRootSpan.complete();
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

function resolveIdentityDevLoginRouteEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const explicit = parseOptionalBoolean(env.AI_LOOM_ENABLE_DEV_LOGIN);
  if (typeof explicit === "boolean") {
    return explicit;
  }

  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv !== "production";
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

async function runStartupStepSpan<TResult>(input: {
  readonly tracer: StartupTracer;
  readonly parentSpan: StartupSpan;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly run: (span: StartupSpan) => Promise<TResult> | TResult;
}): Promise<TResult> {
  const span = input.parentSpan.startChild(input.name, {
    metadata: input.metadata,
  });
  try {
    const result = await input.run(span);
    span.complete();
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
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
