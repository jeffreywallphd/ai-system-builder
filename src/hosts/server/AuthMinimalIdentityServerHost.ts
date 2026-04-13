import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import path from "node:path";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  type CredentialPolicy,
  createAuthProvider,
} from "@domain/identity/IdentityDomain";
import { type IdentityIdNamespace } from "@application/contracts/IdentityApplicationContracts";
import { IdentityPolicyService } from "@application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "@application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentitySessionLifecycleService } from "@application/identity/services/IdentitySessionLifecycleService";
import { IdentityAuthenticatedSessionService } from "@application/identity/services/IdentityAuthenticatedSessionService";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "@application/identity/ports/IIdentityIdGenerator";
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
import {
  HostSecureTransportKinds,
  resolveHostSecureTransportConfig,
} from "@infrastructure/config/HostSecureTransportConfig";
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
  createIdentityHttpServer,
  type IdentityHttpServerLogger,
} from "@infrastructure/transport/http-server/identity/IdentityHttpServer";
import {
  WorkspaceAdministrationQueryErrorCodes,
  WorkspaceAdministrationQueryService,
  type WorkspaceListItemDto,
} from "@application/workspaces/use-cases/WorkspaceAdministrationQueryService";
import {
  CreateWorkspaceUseCase,
  WorkspaceCreationErrorCodes,
} from "@application/workspaces/use-cases/CreateWorkspaceUseCase";
import type { WorkspaceAdministrationBackendApi } from "@infrastructure/api/workspaces/WorkspaceAdministrationBackendApi";
import {
  WorkspaceAdministrationApiErrorCodes,
  type CreateWorkspaceAdministrationApiRequest,
  type CreateWorkspaceAdministrationApiResponse,
  type ListWorkspaceAdministrationWorkspacesApiRequest,
  type ListWorkspaceAdministrationWorkspacesApiResponse,
  type WorkspaceAdministrationApiResponse,
} from "@shared/contracts/workspaces/WorkspaceTransportContracts";
import { WorkspaceIdNamespaces } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  composeServerSecretService,
  type ServerComposedSecretService,
} from "@infrastructure/security/secrets/SecretServiceComposition";
import { ServerPlatformSecretConsumers } from "@infrastructure/security/secrets/ServerPlatformSecretConsumers";
import { assertSystemSecretBootstrapSafe } from "@infrastructure/security/secrets/SystemSecretBootstrapService";
import { createStartupTracer, type StartupSpan, type StartupTracer } from "@hosts/bootstrap/startupTracer";
import {
  createAuthMinimalPersistentPlatformServices,
  type AuthMinimalPersistentPlatformServices,
} from "@infrastructure/persistence/AuthMinimalPersistenceComposition";
import type { IdentityServerHost, IdentityServerHostOptions } from "./IdentityServerHost";
import { ServerManagedTransportTrustStateResolver } from "@infrastructure/security/ServerManagedTransportTrustStateResolver";
import { ValidateTransportConnectionTrustUseCase } from "@application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import {
  HttpTransportTrustValidationAdapter,
  WebSocketTransportTrustValidationAdapter,
} from "@infrastructure/transport/TransportTrustValidationAdapters";
import {
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
} from "@application/security/ports/TransportSecurityPorts";

class SystemIdentityClock implements IIdentityClock {
  public now(): Date {
    return new Date();
  }
}

class RandomIdentityIdGenerator implements IIdentityIdGenerator {
  public nextId(namespace: IdentityIdNamespace): string {
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

function resolveIdentityDevLoginRouteEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const explicit = parseOptionalBoolean(env.AI_LOOM_ENABLE_DEV_LOGIN);
  if (typeof explicit === "boolean") {
    return explicit;
  }

  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv !== "production";
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return undefined;
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

function createSessionContextWorkspaceApi(
  workspaceRepository: AuthMinimalPersistentPlatformServices["workspaceRepository"],
): Pick<WorkspaceAdministrationBackendApi, "listWorkspaces">
  & Pick<WorkspaceAdministrationBackendApi, "createWorkspace"> {
  const queryService = new WorkspaceAdministrationQueryService({
    workspaceRepository,
    membershipRepository: workspaceRepository,
    roleAssignmentRepository: workspaceRepository,
    invitationRepository: workspaceRepository,
    authorizationReadRepository: workspaceRepository,
  });
  const createWorkspaceUseCase = new CreateWorkspaceUseCase({
    workspaceRepository,
    membershipRepository: workspaceRepository,
    roleAssignmentRepository: workspaceRepository,
    transactionManager: workspaceRepository,
    idGenerator: Object.freeze({
      nextId(namespace) {
        if (namespace === WorkspaceIdNamespaces.workspace) {
          return `${WorkspaceIdNamespaces.workspace}:${randomUUID()}`;
        }
        if (namespace === WorkspaceIdNamespaces.workspaceMembership) {
          return `${WorkspaceIdNamespaces.workspaceMembership}:${randomUUID()}`;
        }
        return `${WorkspaceIdNamespaces.workspaceRoleAssignment}:${randomUUID()}`;
      },
    }),
    clock: Object.freeze({
      now: () => new Date(),
    }),
  });

  return Object.freeze({
    async listWorkspaces(
      request: ListWorkspaceAdministrationWorkspacesApiRequest,
    ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationWorkspacesApiResponse>> {
      const outcome = await queryService.listWorkspaces({
        actorUserIdentityId: request.actorUserIdentityId,
        ownerUserIdentityId: request.ownerUserIdentityId,
        statuses: request.statuses,
        visibility: request.visibility,
        slugPrefix: request.slugPrefix,
        limit: request.limit,
        offset: request.offset,
      });

      if (!outcome.ok) {
        const errorCode = outcome.error.code === WorkspaceAdministrationQueryErrorCodes.invalidRequest
          ? WorkspaceAdministrationApiErrorCodes.invalidRequest
          : outcome.error.code === WorkspaceAdministrationQueryErrorCodes.notFound
            ? WorkspaceAdministrationApiErrorCodes.notFound
            : WorkspaceAdministrationApiErrorCodes.forbidden;
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: errorCode,
            message: outcome.error.message,
          }),
        });
      }

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          workspaces: Object.freeze(outcome.value.workspaces.map((workspace) => toWorkspaceAdminListItem(workspace))),
          pagination: outcome.value.pagination,
        }),
      });
    },
    async createWorkspace(
      request: CreateWorkspaceAdministrationApiRequest,
    ): Promise<WorkspaceAdministrationApiResponse<CreateWorkspaceAdministrationApiResponse>> {
      const outcome = await createWorkspaceUseCase.execute({
        actorUserIdentityId: request.actorUserIdentityId,
        slug: request.slug,
        displayName: request.displayName,
        description: request.description,
        visibility: request.visibility,
        status: request.status,
      });

      if (!outcome.ok) {
        const errorCode = outcome.error.code === WorkspaceCreationErrorCodes.invalidRequest
          ? WorkspaceAdministrationApiErrorCodes.invalidRequest
          : outcome.error.code === WorkspaceCreationErrorCodes.duplicate
            ? WorkspaceAdministrationApiErrorCodes.conflict
            : outcome.error.code === WorkspaceCreationErrorCodes.forbidden
              ? WorkspaceAdministrationApiErrorCodes.forbidden
              : WorkspaceAdministrationApiErrorCodes.invalidRequest;
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: errorCode,
            message: outcome.error.message,
          }),
        });
      }

      return Object.freeze({
        ok: true,
        data: Object.freeze({
          workspace: Object.freeze({
            workspaceId: outcome.value.workspace.id,
            slug: outcome.value.workspace.slug,
            displayName: outcome.value.workspace.displayName,
            description: outcome.value.workspace.description,
            status: outcome.value.workspace.status,
            ownerUserIdentityId: outcome.value.workspace.ownerUserId,
            visibility: outcome.value.workspace.visibility,
            createdAt: outcome.value.workspace.createdAt,
            lastModifiedAt: outcome.value.workspace.lastModifiedAt,
            actorAccess: Object.freeze({
              membershipStatus: outcome.value.creatorMembership.status,
              effectiveRoles: Object.freeze([outcome.value.creatorRoleAssignment.role]),
              canAdministrate: true,
              isWorkspaceOwner: true,
              capabilities: Object.freeze({
                canManageWorkspaceSettings: true,
                canManageMembers: true,
                canManageInvitations: true,
                canManageRoles: true,
              }),
            }),
          }),
        }),
      });
    },
  });
}

function toWorkspaceAdminListItem(workspace: WorkspaceListItemDto) {
  return Object.freeze({
    workspaceId: workspace.id,
    slug: workspace.slug,
    displayName: workspace.displayName,
    description: workspace.description,
    status: workspace.status,
    ownerUserIdentityId: workspace.ownerUserIdentityId,
    visibility: workspace.visibility,
    createdAt: workspace.createdAt,
    lastModifiedAt: workspace.lastModifiedAt,
    membershipSummary: workspace.membershipSummary,
    roleSummary: workspace.roleSummary,
    invitationSummary: workspace.invitationSummary,
    actorAccess: Object.freeze({
      membershipStatus: workspace.actorAccess.membershipStatus,
      effectiveRoles: workspace.actorAccess.effectiveRoles,
      canAdministrate: workspace.actorAccess.canAdministrate,
      isWorkspaceOwner: workspace.actorAccess.isWorkspaceOwner,
      capabilities: Object.freeze({
        canManageWorkspaceSettings: workspace.actorAccess.canAdministrate,
        canManageMembers: workspace.actorAccess.canAdministrate,
        canManageInvitations: workspace.actorAccess.canAdministrate,
        canManageRoles: workspace.actorAccess.canAdministrate,
      }),
    }),
  });
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

async function applyIdentityStartupConfiguration(
  repository: {
    saveAuthProvider(provider: ReturnType<typeof createAuthProvider>): Promise<unknown>;
    saveCredentialPolicy(policy: CredentialPolicy): Promise<unknown>;
  },
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
    allowsRegistration: policies.allowLocalRegistration,
    supportsCredentialChange: true,
    metadata: {
      source: "identity-policy-config",
      startupSeeded: "true",
    },
  }));

  await repository.saveCredentialPolicy(policies.buildLocalCredentialPolicy());
}

export async function startAuthMinimalIdentityServerHost(
  options: IdentityServerHostOptions,
): Promise<IdentityServerHost> {
  const databasePath = path.resolve(options.databasePath);
  const authMinimalPersistence = options.persistentPlatformServices
    ? Object.freeze({
      databasePath,
      identityRepository: options.persistentPlatformServices.identityRepository,
      trustedDeviceRepository: options.persistentPlatformServices.trustedDeviceRepository,
      workspaceRepository: options.persistentPlatformServices.workspaceRepository,
      dispose: () => {},
    })
    : createAuthMinimalPersistentPlatformServices({ databasePath });
  const ownsAuthMinimalPersistence = !options.persistentPlatformServices;
  const env = options.env ?? process.env;
  const hostAddress = options.host ?? "127.0.0.1";
  const secureTransportConfig = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.server,
    hostAddress,
    env,
  });
  const startupTracer = options.startupTracer ?? createStartupTracer({
    startupReason: "auth-minimal-server-runtime-startup",
  });
  const startupRootSpan = startupTracer.startSpan("auth-minimal-server-runtime-startup", {
    metadata: Object.freeze({
      hostAddress,
      startupReason: "auth-minimal-server-runtime-startup",
    }),
  });
  let secretService: ServerComposedSecretService | undefined;
  let eventPublisher: SqliteIdentityLifecycleEventPublisher | undefined;
  try {
    secretService = composeServerSecretService({
      databasePath: options.databasePath,
      env,
    });
    await assertSystemSecretBootstrapSafe({
      env,
      secretService,
    });

    const repository = authMinimalPersistence.identityRepository;
    const trustedDeviceRepository = authMinimalPersistence.trustedDeviceRepository;
    const workspaceRepository = authMinimalPersistence.workspaceRepository;
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

    const authenticator = new LocalPasswordIdentityAuthenticator(new ScryptLocalPasswordCredentialService());
    const identityPolicyService = new IdentityPolicyService(repository);
    const clock = new SystemIdentityClock();
    const idGenerator = new RandomIdentityIdGenerator();
    const sessionPolicies = options.sessionPolicies
      ?? IdentitySessionPolicyConfig.fromEnv(env).policies;
    const sessionTrustPolicies = IdentitySessionTrustPolicyConfig.fromEnv(env).policies;
    eventPublisher = new SqliteIdentityLifecycleEventPublisher(databasePath);
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

    const enableDevLoginRoute = resolveIdentityDevLoginRouteEnabled(env);
    const sessionContextWorkspaceApi = createSessionContextWorkspaceApi(workspaceRepository);
    const transportTrustStateResolver = new ServerManagedTransportTrustStateResolver({
      trustedDeviceManagementService,
    });
    const transportTrustValidator = new ValidateTransportConnectionTrustUseCase({
      transportSecurityPolicyResolverPort: new BaselineTransportSecurityPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainTransportConnectionPolicyEvaluator(),
      trustedDeviceStateResolverPort: transportTrustStateResolver,
    });
    const httpTransportTrustValidator = new HttpTransportTrustValidationAdapter(transportTrustValidator);
    const websocketTransportTrustValidator = new WebSocketTransportTrustValidationAdapter(transportTrustValidator);
    const server = createIdentityHttpServer({
      backendApi,
      sessionContextWorkspaceApi,
      routeRegistrationPlan: options.routeRegistrationPlan,
      cors: options.cors,
      logger: options.logger as IdentityHttpServerLogger | undefined,
      secureTransport: Object.freeze({
        requireHttps: secureTransportConfig.requireSecureHttp,
        requireWss: secureTransportConfig.requireSecureWebSocket,
        allowInsecureLoopback: secureTransportConfig.allowInsecureLoopback,
      }),
      transportTrust: secureTransportConfig.enforceTransportTrustValidation
        ? Object.freeze({
            httpValidator: httpTransportTrustValidator,
            websocketValidator: websocketTransportTrustValidator,
            allowInsecureLoopback: secureTransportConfig.allowInsecureLoopback,
          })
        : undefined,
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
          if (ownsAuthMinimalPersistence) {
            authMinimalPersistence.dispose();
          }
          secretService?.dispose();
          eventPublisher?.dispose();
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
    if (ownsAuthMinimalPersistence) {
      authMinimalPersistence.dispose();
    }
    secretService?.dispose();
    eventPublisher?.dispose();
    throw error;
  } finally {
    startupRootSpan.complete();
  }
}
