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
import { IdentityProviderAccountPolicyConfig } from "../../infrastructure/config/IdentityProviderAccountPolicyConfig";
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

export async function startIdentityServerHost(options: IdentityServerHostOptions): Promise<IdentityServerHost> {
  const repository = new SqliteIdentityRepository(path.resolve(options.databasePath));
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
  const eventPublisher = options.eventPublisher;
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
    identityLookupRepository: repository,
    authenticatedSessionService,
    featurePolicies: {
      allowLocalRegistration: providerAccountPolicies.allowLocalRegistration,
      allowLocalAdministration: providerAccountPolicies.allowLocalAdministration,
    },
  });

  const server = createIdentityHttpServer({
    backendApi,
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
