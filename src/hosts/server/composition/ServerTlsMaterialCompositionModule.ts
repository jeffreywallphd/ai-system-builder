import { createServer as createHttpsServer } from "node:https";
import {
  ResolveCertificateRevocationStatusUseCase,
} from "@application/security/use-cases/ResolveCertificateRevocationStatusUseCase";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "@application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import { ValidateTransportConnectionTrustUseCase } from "@application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
} from "@application/security/ports/TransportSecurityPorts";
import {
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";
import { TrustMaterialKinds } from "@domain/security/CertificateAuthorityDomain";
import type { HostSecureTransportConfig } from "@infrastructure/config/HostSecureTransportConfig";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "@infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage";
import { RuntimeTrustMaterialDistributionService } from "@infrastructure/security/certificates/RuntimeTrustMaterialDistributionService";
import { ServerManagedTransportTrustStateResolver } from "@infrastructure/security/ServerManagedTransportTrustStateResolver";
import { TransportSecurityObservabilityReporter } from "@infrastructure/security/TransportSecurityObservabilityReporter";
import type { SqliteCertificateAuthorityPersistenceAdapter } from "@infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import type { SqliteNodeTrustPersistenceAdapter } from "@infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import type { TrustedDeviceManagementService } from "@application/identity/services/TrustedDeviceManagementService";
import type { FileSystemProtectedSecretStore } from "@infrastructure/security/secrets/FileSystemProtectedSecretStore";
import {
  HttpTransportTrustValidationAdapter,
  WebSocketTransportTrustValidationAdapter,
} from "@infrastructure/transport/TransportTrustValidationAdapters";
import type { IdentityHttpServerFactory } from "@infrastructure/transport/http-server/identity/IdentityHttpServer";

export interface ManagedIdentityServerTlsRuntimeMaterial {
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

  const managedTlsMaterial = await resolveManagedIdentityServerTlsRuntimeMaterial({
    certificateAuthorityRepository: input.certificateAuthorityRepository,
    env: input.env,
    protectedSecretStore: input.protectedSecretStore,
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
  readonly certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly protectedSecretStore: FileSystemProtectedSecretStore | undefined;
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

  if (!input.protectedSecretStore) {
    throw new Error("Managed identity-server TLS requires protected secret storage configuration.");
  }

  const certificateMaterialStorage = new ProtectedCertificateAuthorityRootMaterialStorage(input.protectedSecretStore);
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

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}
