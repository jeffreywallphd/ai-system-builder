import { createServer as createHttpsServer } from "node:https";
import type {
  IManagedServerTlsRuntimeMaterialResolverPort,
  ManagedServerTlsRuntimeMaterial,
} from "@application/security/ports/SecurityMaterialResolutionPorts";
import { ResolveCertificateRevocationStatusUseCase } from "@application/security/use-cases/ResolveCertificateRevocationStatusUseCase";
import { ValidateTransportConnectionTrustUseCase } from "@application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
} from "@application/security/ports/TransportSecurityPorts";
import type { TrustedDeviceManagementService } from "@application/identity/services/TrustedDeviceManagementService";
import {
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";
import type { HostSecureTransportConfig } from "@infrastructure/config/HostSecureTransportConfig";
import type { SqliteNodeTrustPersistenceAdapter } from "@infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import type { SqliteCertificateAuthorityPersistenceAdapter } from "@infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import { ManagedServerTlsRuntimeMaterialResolver } from "@infrastructure/security/certificates/ManagedServerTlsRuntimeMaterialResolver";
import { ServerManagedTransportTrustStateResolver } from "@infrastructure/security/ServerManagedTransportTrustStateResolver";
import { TransportSecurityObservabilityReporter } from "@infrastructure/security/TransportSecurityObservabilityReporter";
import type { FileSystemProtectedSecretStore } from "@infrastructure/security/secrets/FileSystemProtectedSecretStore";
import {
  HttpTransportTrustValidationAdapter,
  WebSocketTransportTrustValidationAdapter,
} from "@infrastructure/transport/TransportTrustValidationAdapters";
import type { IdentityHttpServerFactory } from "@infrastructure/transport/http-server/identity/IdentityHttpServer";

export type ManagedIdentityServerTlsRuntimeMaterial = ManagedServerTlsRuntimeMaterial;

export interface ServerTlsMaterialCompositionModuleInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly logger?: {
    info(event: Readonly<Record<string, unknown>>): void;
    warn(event: Readonly<Record<string, unknown>>): void;
    error(event: Readonly<Record<string, unknown>>): void;
  };
  readonly secureTransportConfig: HostSecureTransportConfig;
  readonly certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter;
  readonly nodeTrustRepository: SqliteNodeTrustPersistenceAdapter;
  readonly trustedDeviceManagementService: TrustedDeviceManagementService;
  readonly protectedSecretStore: FileSystemProtectedSecretStore | undefined;
  readonly managedServerTlsRuntimeMaterialResolver?: IManagedServerTlsRuntimeMaterialResolverPort;
}

export interface ServerTlsMaterialCompositionModuleOutput {
  readonly managedTlsMaterial: ManagedIdentityServerTlsRuntimeMaterial | undefined;
  readonly serverFactory: IdentityHttpServerFactory | undefined;
  readonly transportTrust:
    | {
      readonly httpValidator: HttpTransportTrustValidationAdapter;
      readonly websocketValidator: WebSocketTransportTrustValidationAdapter;
      readonly allowInsecureLoopback: boolean;
    }
    | undefined;
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

export async function composeServerTlsMaterialCompositionModule(
  input: ServerTlsMaterialCompositionModuleInput,
): Promise<ServerTlsMaterialCompositionModuleOutput> {
  const transportTrustStateResolver = new ServerManagedTransportTrustStateResolver({
    trustedDeviceManagementService: input.trustedDeviceManagementService,
    nodeTrustIdentityRepository: input.nodeTrustRepository,
    certificateRevocationStatusRegistry: new ResolveCertificateRevocationStatusUseCase({
      issuedCertificateRepository: input.certificateAuthorityRepository,
      certificateLifecycleEventRepository: input.certificateAuthorityRepository,
    }),
  });
  const transportSecurityObservability = new TransportSecurityObservabilityReporter({
    logger: {
      info: (event) => input.logger?.info({
        event: event.event,
        requestId: event.details.connectionId,
        details: Object.freeze({
          level: event.level,
          transport: event.details,
        }),
      }),
      warn: (event) => input.logger?.warn({
        event: event.event,
        requestId: event.details.connectionId,
        details: Object.freeze({
          level: event.level,
          transport: event.details,
        }),
      }),
      error: (event) => input.logger?.error({
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
  const managedTlsMaterialResolver = input.managedServerTlsRuntimeMaterialResolver
    ?? new ManagedServerTlsRuntimeMaterialResolver({
      certificateAuthorityRepository: input.certificateAuthorityRepository,
      protectedSecretStore: input.protectedSecretStore,
    });

  const managedTlsMaterial = await resolveManagedIdentityServerTlsRuntimeMaterial({
    secureTransportConfig: input.secureTransportConfig,
    resolver: managedTlsMaterialResolver,
  });

  if (input.secureTransportConfig.requireSecureHttp && !managedTlsMaterial) {
    throw new Error(
      "Identity server secure transport configuration requires HTTPS startup, but managed TLS material is unavailable.",
    );
  }

  return Object.freeze({
    managedTlsMaterial,
    serverFactory: managedTlsMaterial
      ? createManagedIdentityServerTlsFactory(managedTlsMaterial)
      : undefined,
    transportTrust: input.secureTransportConfig.enforceTransportTrustValidation
      ? Object.freeze({
        httpValidator: new HttpTransportTrustValidationAdapter(
          transportTrustValidator,
          transportSecurityObservability,
        ),
        websocketValidator: new WebSocketTransportTrustValidationAdapter(
          transportTrustValidator,
          transportSecurityObservability,
        ),
        allowInsecureLoopback: input.secureTransportConfig.allowInsecureLoopback,
      })
      : undefined,
  });
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
  readonly secureTransportConfig: HostSecureTransportConfig;
  readonly resolver: IManagedServerTlsRuntimeMaterialResolverPort;
}): Promise<ManagedIdentityServerTlsRuntimeMaterial | undefined> {
  if (!input.secureTransportConfig.trustMaterial.managedServerTlsEnabled) {
    return undefined;
  }

  const targetReferenceId = input.secureTransportConfig.trustMaterial.serverReferenceId ?? "server:authoritative";
  if (!targetReferenceId.startsWith("server:")) {
    throw new Error("Managed identity-server TLS requires AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID to start with 'server:'.");
  }

  const privateKeyMaterialRef = input.secureTransportConfig.trustMaterial.privateKeyMaterialRef;
  if (!privateKeyMaterialRef) {
    throw new Error("Managed identity-server TLS requires AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF.");
  }

  return input.resolver.resolveManagedServerTlsRuntimeMaterial({
    targetReferenceId,
    actorUserIdentityId: input.secureTransportConfig.trustMaterial.actorUserIdentityId ?? "system:identity-server-host",
    privateKeyMaterialRef,
    workspaceId: input.secureTransportConfig.trustMaterial.workspaceId,
    certificateAuthorityId: input.secureTransportConfig.trustMaterial.certificateAuthorityId,
    serialNumber: input.secureTransportConfig.trustMaterial.serialNumber,
  });
}
