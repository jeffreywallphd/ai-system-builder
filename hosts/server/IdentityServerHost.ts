import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import path from "node:path";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  createAuthProvider,
  createCredentialPolicy,
} from "../../src/domain/identity/IdentityDomain";
import { IdentityIdNamespaces, type IdentityIdNamespace } from "../../application/contracts/IdentityApplicationContracts";
import { IdentityPolicyService } from "../../application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../../application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentitySessionLifecycleService } from "../../application/identity/services/IdentitySessionLifecycleService";
import { IdentityAuthenticatedSessionService } from "../../application/identity/services/IdentityAuthenticatedSessionService";
import type { IIdentityClock } from "../../application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../../application/identity/ports/IIdentityIdGenerator";
import { RegisterLocalAccountUseCase } from "../../src/application/identity/use-cases/RegisterLocalAccountUseCase";
import { LoginLocalAccountUseCase } from "../../src/application/identity/use-cases/LoginLocalAccountUseCase";
import { SqliteIdentityRepository } from "../../infrastructure/filesystem/identity/SqliteIdentityRepository";
import { ScryptLocalPasswordCredentialService } from "../../infrastructure/security/identity/ScryptLocalPasswordCredentialService";
import { OpaqueIdentitySessionTokenService } from "../../infrastructure/security/identity/OpaqueIdentitySessionTokenService";
import { IdentityAuthBackendApi } from "../../infrastructure/api/identity/IdentityAuthBackendApi";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogger,
} from "../../infrastructure/transport/http-server/identity/IdentityHttpServer";

export interface IdentityServerHostOptions {
  readonly databasePath: string;
  readonly port?: number;
  readonly host?: string;
  readonly logger?: IdentityHttpServerLogger;
}

export interface IdentityServerHost {
  readonly port: number;
  readonly address: string;
  close(): Promise<void>;
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
  await ensureDefaultIdentityConfiguration(repository);

  const authenticator = new LocalPasswordIdentityAuthenticator(new ScryptLocalPasswordCredentialService());
  const identityPolicyService = new IdentityPolicyService(repository);
  const clock = new SystemIdentityClock();
  const idGenerator = new RandomIdentityIdGenerator();
  const sessionLifecycleService = new IdentitySessionLifecycleService({
    sessionRepository: repository,
    clock,
    idGenerator,
  });
  const authenticatedSessionService = new IdentityAuthenticatedSessionService({
    lifecycleService: sessionLifecycleService,
    sessionRepository: repository,
    tokenMaterialRepository: repository,
    tokenService: new OpaqueIdentitySessionTokenService(),
    clock,
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
    }),
    loginLocalAccountUseCase: new LoginLocalAccountUseCase({
      lookupRepository: repository,
      credentialMaterialRepository: repository,
      identityPolicyService,
      credentialAuthenticator: authenticator,
      clock,
    }),
    authenticatedSessionService,
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

async function ensureDefaultIdentityConfiguration(repository: SqliteIdentityRepository): Promise<void> {
  await repository.saveAuthProvider(createAuthProvider({
    id: "provider:local-password",
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: "Local Password",
  }));

  await repository.saveCredentialPolicy(createCredentialPolicy({
    id: "policy:local-password",
  }));
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
