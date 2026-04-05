import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import path from "node:path";
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
import { SqliteWorkspacePersistenceAdapter } from "../../src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import { WorkspaceAuthorizationPolicyReadAdapter } from "../../src/infrastructure/persistence/workspaces/WorkspaceAuthorizationPolicyReadAdapter";
import { SqliteAuthorizationPersistenceAdapter } from "../../src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter";
import { SqliteAuthorizationPolicyReadAdapter } from "../../src/infrastructure/persistence/authorization/SqliteAuthorizationPolicyReadAdapter";
import { SqliteNodeTrustPersistenceAdapter } from "../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import { SqliteNodeTrustAuditRecorder } from "../../src/infrastructure/persistence/nodes/SqliteNodeTrustAuditRecorder";
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
import { GetNodeEnrollmentDetailUseCase } from "../../src/application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { ListTrustedNodeInventoryUseCase } from "../../src/application/nodes/use-cases/ListTrustedNodeInventoryUseCase";
import { RecordNodeHeartbeatUseCase } from "../../src/application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "../../src/application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "../../src/application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "../../src/application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import type { WorkspaceIdNamespace } from "../../src/shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogger,
} from "../../infrastructure/transport/http-server/identity/IdentityHttpServer";
import type { IdentitySessionLifecyclePolicies } from "../../application/identity/services/IdentitySessionLifecycleService";
import type { AuthProvider, CredentialPolicy } from "../../src/domain/identity/IdentityDomain";

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

export async function startIdentityServerHost(options: IdentityServerHostOptions): Promise<IdentityServerHost> {
  const repository = new SqliteIdentityRepository(path.resolve(options.databasePath));
  const trustedDeviceRepository = new SqliteTrustedDeviceRepository(path.resolve(options.databasePath));
  const workspaceRepository = new SqliteWorkspacePersistenceAdapter(path.resolve(options.databasePath));
  const authorizationRepository = new SqliteAuthorizationPersistenceAdapter(path.resolve(options.databasePath));
  const nodeTrustRepository = new SqliteNodeTrustPersistenceAdapter(path.resolve(options.databasePath));
  const nodeTrustAuditRecorder = new SqliteNodeTrustAuditRecorder(path.resolve(options.databasePath));
  const env = options.env ?? process.env;
  const providerAccountPolicies = options.providerAccountPolicies
    ?? IdentityProviderAccountPolicyConfig.fromEnv(env);
  await applyIdentityStartupConfiguration(repository, providerAccountPolicies);

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
    recordNodeHeartbeatUseCase: new RecordNodeHeartbeatUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
    listTrustedNodeInventoryUseCase: new ListTrustedNodeInventoryUseCase({
      nodeRepository: nodeTrustRepository,
      auditSink: nodeTrustAuditRecorder,
    }),
  });

  const server = createIdentityHttpServer({
    backendApi,
    nodeTrustBackendApi,
    authorizationManagementBackendApi,
    workspaceBackendApi,
    workspaceAdministrationBackendApi,
    logger: options.logger,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
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
