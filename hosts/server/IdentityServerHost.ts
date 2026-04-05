import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createServer as createHttpsServer } from "node:https";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  createAuthProvider,
} from "../../src/domain/identity/IdentityDomain";
import { IdentityIdNamespaces, type IdentityIdNamespace } from "../../application/contracts/IdentityApplicationContracts";
import { IdentityPolicyService } from "../../application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../../application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentitySessionLifecycleService } from "../../application/identity/services/IdentitySessionLifecycleService";
import { IdentityAuthenticatedSessionService } from "../../application/identity/services/IdentityAuthenticatedSessionService";
import type { IIdentityClock } from "../../application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../../application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "../../application/identity/ports/IIdentityLifecycleEventPublisher";
import { RegisterLocalAccountUseCase } from "../../src/application/identity/use-cases/RegisterLocalAccountUseCase";
import { LoginLocalAccountUseCase } from "../../src/application/identity/use-cases/LoginLocalAccountUseCase";
import { ChangeLocalPasswordCredentialUseCase } from "../../src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import { LogoutIdentitySessionUseCase } from "../../src/application/identity/use-cases/LogoutIdentitySessionUseCase";
import { RevokeIdentitySessionUseCase } from "../../src/application/identity/use-cases/RevokeIdentitySessionUseCase";
import { ListLocalIdentityAccountsUseCase } from "../../src/application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import { GetLocalIdentityAccountStatusUseCase } from "../../src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import { SetLocalIdentityAccountStatusUseCase } from "../../src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import { SqliteIdentityRepository } from "../../infrastructure/filesystem/identity/SqliteIdentityRepository";
import { ScryptLocalPasswordCredentialService } from "../../infrastructure/security/identity/ScryptLocalPasswordCredentialService";
import { OpaqueIdentitySessionTokenService } from "../../infrastructure/security/identity/OpaqueIdentitySessionTokenService";
import { IdentityAuthBackendApi } from "../../infrastructure/api/identity/IdentityAuthBackendApi";
import { IdentitySessionPolicyConfig } from "../../infrastructure/config/IdentitySessionPolicyConfig";
import { IdentitySessionTrustPolicyConfig } from "../../infrastructure/config/IdentitySessionTrustPolicyConfig";
import { IdentityProviderAccountPolicyConfig } from "../../infrastructure/config/IdentityProviderAccountPolicyConfig";
import {
  HostSecureTransportKinds,
  resolveHostSecureTransportConfig,
} from "../../infrastructure/config/HostSecureTransportConfig";
import { SqliteTrustedDeviceRepository } from "../../infrastructure/filesystem/identity/SqliteTrustedDeviceRepository";
import { TrustedDeviceManagementService } from "../../application/identity/services/TrustedDeviceManagementService";
import { TrustedDevicePairingService } from "../../application/identity/services/TrustedDevicePairingService";
import { TrustedDeviceSessionTrustService } from "../../application/identity/services/TrustedDeviceSessionTrustService";
import { ListTrustedDevicesUseCase } from "../../src/application/identity/use-cases/ListTrustedDevicesUseCase";
import { GetTrustedDeviceUseCase } from "../../src/application/identity/use-cases/GetTrustedDeviceUseCase";
import { RevokeTrustedDeviceUseCase } from "../../src/application/identity/use-cases/RevokeTrustedDeviceUseCase";
import { UpdateTrustedDeviceDisplayNameUseCase } from "../../src/application/identity/use-cases/UpdateTrustedDeviceDisplayNameUseCase";
import { InitiateTrustedDevicePairingUseCase } from "../../src/application/identity/use-cases/InitiateTrustedDevicePairingUseCase";
import { ValidateTrustedDevicePairingUseCase } from "../../src/application/identity/use-cases/ValidateTrustedDevicePairingUseCase";
import { CompleteTrustedDevicePairingUseCase } from "../../src/application/identity/use-cases/CompleteTrustedDevicePairingUseCase";
import { SqliteIdentityLifecycleEventPublisher } from "../../infrastructure/filesystem/identity/SqliteIdentityLifecycleEventPublisher";
import { WorkspaceInvitationBackendApi } from "../../infrastructure/api/workspaces/WorkspaceInvitationBackendApi";
import { WorkspaceAdministrationBackendApi } from "../../infrastructure/api/workspaces/WorkspaceAdministrationBackendApi";
import { AuthorizationManagementBackendApi } from "../../infrastructure/api/authorization/AuthorizationManagementBackendApi";
import { NodeTrustBackendApi } from "../../infrastructure/api/nodes/NodeTrustBackendApi";
import { CertificateOperationsBackendApi } from "../../infrastructure/api/security/CertificateOperationsBackendApi";
import { SqliteWorkspacePersistenceAdapter } from "../../src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import { WorkspaceAuthorizationPolicyReadAdapter } from "../../src/infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter";
import { SqliteAuthorizationPersistenceAdapter } from "../../src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "../../src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";
import { SqliteNodeTrustPersistenceAdapter } from "../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import { SqliteNodeTrustAuditRecorder } from "../../src/infrastructure/persistence/nodes/SqliteNodeTrustAuditRecorder";
import { SqliteCertificateAuthorityPersistenceAdapter } from "../../src/infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import {
  assertCertificateAuthorityStartupSafe,
  ResolveCertificateAuthorityStartupStateUseCase,
} from "../../src/application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase";
import {
  InitializeCertificateAuthorityUseCase,
  type InitializeCertificateAuthorityUseCaseInput,
  type InitializeCertificateAuthorityUseCaseResult,
  type CertificateAuthorityInitializationAuditEvent,
} from "../../src/application/security/use-cases/InitializeCertificateAuthorityUseCase";
import {
  EnvironmentCertificateAuthorityBootstrapConfigurationProvider,
  EnvironmentCertificateAuthoritySecretService,
} from "../../src/infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter";
import { ServerManagedTransportTrustStateResolver } from "../../src/infrastructure/security/ServerManagedTransportTrustStateResolver";
import { TransportSecurityObservabilityReporter } from "../../src/infrastructure/security/TransportSecurityObservabilityReporter";
import { createFileSystemProtectedSecretStoreFromEnvironment } from "../../src/infrastructure/security/secrets/FileSystemProtectedSecretStore";
import type { ICertificateAuthorityIssuerPort } from "../../src/application/security/ports/ICertificateAuthorityIssuerPort";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "../../src/infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage";
import { RuntimeTrustMaterialDistributionService } from "../../src/infrastructure/security/certificates/RuntimeTrustMaterialDistributionService";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "../../src/application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import { ResolveCertificateRevocationStatusUseCase } from "../../src/application/security/use-cases/ResolveCertificateRevocationStatusUseCase";
import { ValidateTransportConnectionTrustUseCase } from "../../src/application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import { GetCertificateAuthorityStatusIntrospectionUseCase } from "../../src/application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import { ListIssuedCertificateMetadataUseCase } from "../../src/application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import { GetIssuedCertificateMetadataUseCase } from "../../src/application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import { RevokeIssuedCertificateUseCase } from "../../src/application/security/use-cases/RevokeIssuedCertificateUseCase";
import { RenewIssuedCertificateUseCase } from "../../src/application/security/use-cases/RenewIssuedCertificateUseCase";
import { TrustMaterialKinds } from "../../src/domain/security/CertificateAuthorityDomain";
import { AuthorizationPolicyDecisionEvaluator } from "../../src/application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService } from "../../src/application/authorization/use-cases/AuthorizationPolicyMutationService";
import { GrantAuthorizationSharingAccessUseCase } from "../../src/application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import { RevokeAuthorizationSharingAccessUseCase } from "../../src/application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import { UpdateAuthorizationVisibilityUseCase } from "../../src/application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "../../src/application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import { ListAuthorizationEffectiveAccessUseCase } from "../../src/application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import {
  IssueWorkspaceInvitationUseCase,
  type WorkspaceInvitationIssuanceClock,
  type WorkspaceInvitationIssuanceIdGenerator,
  Sha256WorkspaceInvitationTokenIssuer,
} from "../../src/application/workspaces/use-cases/IssueWorkspaceInvitationUseCase";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  type WorkspaceInvitationLifecycleClock,
  type WorkspaceInvitationLifecycleIdGenerator,
} from "../../src/application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  type AuthenticatedWorkspaceOnboardingClock,
} from "../../src/application/workspaces/use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";
import { WorkspaceAdministrationQueryService } from "../../src/application/workspaces/use-cases/WorkspaceAdministrationQueryService";
import { CreateWorkspaceUseCase } from "../../src/application/workspaces/use-cases/CreateWorkspaceUseCase";
import { UpdateWorkspaceUseCase } from "../../src/application/workspaces/use-cases/UpdateWorkspaceUseCase";
import { TransitionWorkspaceLifecycleUseCase } from "../../src/application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase";
import { AddWorkspaceMemberUseCase } from "../../src/application/workspaces/use-cases/AddWorkspaceMemberUseCase";
import { ChangeWorkspaceMembershipStatusUseCase } from "../../src/application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase";
import { RemoveWorkspaceMemberUseCase } from "../../src/application/workspaces/use-cases/RemoveWorkspaceMemberUseCase";
import { AssignWorkspaceRoleUseCase } from "../../src/application/workspaces/use-cases/AssignWorkspaceRoleUseCase";
import { ReassignWorkspaceRoleUseCase } from "../../src/application/workspaces/use-cases/ReassignWorkspaceRoleUseCase";
import { RevokeWorkspaceRoleUseCase } from "../../src/application/workspaces/use-cases/RevokeWorkspaceRoleUseCase";
import { ApproveNodeEnrollmentUseCase } from "../../src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase";
import { GetNodeInventoryDetailUseCase } from "../../src/application/nodes/use-cases/GetNodeInventoryDetailUseCase";
import { GetNodeEnrollmentDetailUseCase } from "../../src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { ListNodeInventoryUseCase } from "../../src/application/nodes/use-cases/ListNodeInventoryUseCase";
import { ListTrustedNodeInventoryUseCase } from "../../src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase";
import { RecordNodeHeartbeatUseCase } from "../../src/application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "../../src/application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ResolveApprovedNodeCertificateEligibilityUseCase } from "../../src/application/nodes/use-cases/ResolveApprovedNodeCertificateEligibilityUseCase";
import { ResolveApprovedNodeRuntimeTrustMaterialUseCase } from "../../src/application/nodes/use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase";
import { RevokeNodeTrustUseCase } from "../../src/application/nodes/use-cases/RevokeNodeTrustUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../../src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import { InternalCertificateAuthorityIssuer } from "../../src/infrastructure/security/ca/InternalCertificateAuthorityIssuer";
import {
  HttpTransportTrustValidationAdapter,
  WebSocketTransportTrustValidationAdapter,
} from "../../src/infrastructure/transport/TransportTrustValidationAdapters";
import type { WorkspaceIdNamespace } from "../../src/shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "../../src/domain/security/TransportSecurityDomain";
import {
  createIdentityHttpServer,
  type IdentityHttpServerFactory,
  type IdentityHttpServerLogger,
} from "../../infrastructure/transport/http-server/identity/IdentityHttpServer";
import type { IdentitySessionLifecyclePolicies } from "../../application/identity/services/IdentitySessionLifecycleService";
import type { AuthProvider, CredentialPolicy } from "../../src/domain/identity/IdentityDomain";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
} from "../../src/application/security/ports/TransportSecurityPorts";

export interface IdentityServerHostOptions {
  readonly databasePath: string;
  readonly port?: number;
  readonly host?: string;
  readonly logger?: IdentityHttpServerLogger;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly sessionPolicies?: IdentitySessionLifecyclePolicies;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
  readonly providerAccountPolicies?: IdentityProviderAccountPolicyConfig;
}

export interface IdentityServerHost {
  readonly port: number;
  readonly address: string;
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
  const repository = new SqliteIdentityRepository(path.resolve(options.databasePath));
  const trustedDeviceRepository = new SqliteTrustedDeviceRepository(path.resolve(options.databasePath));
  const workspaceRepository = new SqliteWorkspacePersistenceAdapter(path.resolve(options.databasePath));
  const authorizationRepository = new SqliteAuthorizationPersistenceAdapter(path.resolve(options.databasePath));
  const nodeTrustRepository = new SqliteNodeTrustPersistenceAdapter(path.resolve(options.databasePath));
  const nodeTrustAuditRecorder = new SqliteNodeTrustAuditRecorder(path.resolve(options.databasePath));
  const certificateAuthorityRepository = new SqliteCertificateAuthorityPersistenceAdapter(path.resolve(options.databasePath));
  const env = options.env ?? process.env;
  const hostAddress = options.host ?? "127.0.0.1";
  const secureTransportConfig = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.server,
    hostAddress,
    env,
  });
  try {
    const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(env);
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
    const eventPublisher = options.eventPublisher ?? new SqliteIdentityLifecycleEventPublisher(path.resolve(options.databasePath));
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
    clock: workspaceClock,
  });
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
  const nodeTrustBackendApi = new NodeTrustBackendApi({
    registerNodeEnrollmentRequestUseCase: new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
    reviewPendingNodeEnrollmentUseCase: new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
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
      auditSink: nodeTrustAuditRecorder,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: nodeTrustRepository,
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
    revokeNodeTrustUseCase: new RevokeNodeTrustUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
    recordNodeHeartbeatUseCase: new RecordNodeHeartbeatUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
    resolveApprovedNodeRuntimeTrustMaterialUseCase: new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository: nodeTrustRepository,
      runtimeTrustMaterialResolver: resolveRuntimeTrustMaterialPackageUseCase,
    }),
    listTrustedNodeInventoryUseCase: new ListTrustedNodeInventoryUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
    listNodeInventoryUseCase: new ListNodeInventoryUseCase({
      nodeRepository: nodeTrustRepository,
      enrollmentRequestRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
  });
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
  if (secureTransportConfig.requireSecureHttp && !managedTlsMaterial) {
    throw new Error(
      "Identity server secure transport configuration requires HTTPS startup, but managed TLS material is unavailable.",
    );
  }

  const server = createIdentityHttpServer({
    backendApi,
    certificateOperationsBackendApi,
    nodeTrustBackendApi,
    authorizationManagementBackendApi,
    workspaceBackendApi,
    workspaceAdministrationBackendApi,
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
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, hostAddress, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const addressInfo = server.address() as AddressInfo;

  return Object.freeze({
    port: addressInfo.port,
    address: `${addressInfo.address}:${addressInfo.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        repository.dispose();
        trustedDeviceRepository.dispose();
        workspaceRepository.dispose();
        authorizationRepository.dispose();
        nodeTrustRepository.dispose();
        nodeTrustAuditRecorder.dispose();
        certificateAuthorityRepository.dispose();
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
    repository.dispose();
    trustedDeviceRepository.dispose();
    workspaceRepository.dispose();
    authorizationRepository.dispose();
    nodeTrustRepository.dispose();
    nodeTrustAuditRecorder.dispose();
    certificateAuthorityRepository.dispose();
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

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
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
