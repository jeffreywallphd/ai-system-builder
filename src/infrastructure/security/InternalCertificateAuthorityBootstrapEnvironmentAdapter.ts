import type {
  CertificateAuthorityBootstrapConfiguration,
  ICertificateAuthorityBootstrapConfigurationProvider,
} from "@application/security/ports/ICertificateAuthorityBootstrapConfigurationProvider";
import type {
  CertificateAuthoritySecretMetadata,
  ICertificateAuthorityBootstrapSecretService,
} from "@application/security/ports/ICertificateAuthorityBootstrapSecretService";
import { SecretProviderMaterialKinds } from "@application/security/ports/SecretProviderPorts";
import { ScopedSecretProviderMaterialRetrievalUseCase } from "@application/security/use-cases/ScopedSecretProviderMaterialRetrievalUseCase";
import { SecretServiceErrorCodes } from "@application/security/use-cases/SecretManagementServiceContracts";
import { SecretAccessActions, SecretActorTypes } from "@domain/security/SecretDomain";
import {
  INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX,
  type FileSystemProtectedSecretStore,
} from "./secrets/FileSystemProtectedSecretStore";

const INTERNAL_CA_ENV_KEYS = Object.freeze({
  certificateAuthorityId: "AI_LOOM_INTERNAL_CA_ID",
  rootCertificateMaterialRef: "AI_LOOM_INTERNAL_CA_ROOT_CERT_MATERIAL_REF",
  rootPrivateKeyMaterialRef: "AI_LOOM_INTERNAL_CA_ROOT_KEY_MATERIAL_REF",
  rootCertificateSecretRef: "AI_LOOM_INTERNAL_CA_ROOT_CERT_SECRET_REF",
  rootPrivateKeySecretRef: "AI_LOOM_INTERNAL_CA_ROOT_KEY_SECRET_REF",
});

export class EnvironmentCertificateAuthorityBootstrapConfigurationProvider
  implements ICertificateAuthorityBootstrapConfigurationProvider {
  public constructor(private readonly env: Readonly<Record<string, string | undefined>>) {}

  public async loadConfiguration(): Promise<CertificateAuthorityBootstrapConfiguration> {
    return Object.freeze({
      certificateAuthorityId: normalizeOptional(this.env[INTERNAL_CA_ENV_KEYS.certificateAuthorityId]),
      rootCertificateMaterialRef: normalizeOptional(this.env[INTERNAL_CA_ENV_KEYS.rootCertificateMaterialRef]),
      rootPrivateKeyMaterialRef: normalizeOptional(this.env[INTERNAL_CA_ENV_KEYS.rootPrivateKeyMaterialRef]),
      rootCertificateSecretRef: normalizeOptional(this.env[INTERNAL_CA_ENV_KEYS.rootCertificateSecretRef]),
      rootPrivateKeySecretRef: normalizeOptional(this.env[INTERNAL_CA_ENV_KEYS.rootPrivateKeySecretRef]),
      source: "env",
    });
  }
}

export class EnvironmentCertificateAuthoritySecretService implements ICertificateAuthorityBootstrapSecretService {
  public constructor(
    private readonly env: Readonly<Record<string, string | undefined>>,
    private readonly options?: {
      readonly protectedSecretStore?: FileSystemProtectedSecretStore;
      readonly scopedSecretProviderRetrievalUseCase?: ScopedSecretProviderMaterialRetrievalUseCase;
      readonly providerId?: string;
    },
  ) {}

  public async getSecretMetadata(secretRef: string): Promise<CertificateAuthoritySecretMetadata> {
    const normalized = normalizeRequired(secretRef, "Internal CA secret reference");
    if (normalized.startsWith("env:")) {
      const environmentVariableKey = parseEnvironmentSecretRef(normalized);
      const value = this.env[environmentVariableKey];
      return Object.freeze({
        secretRef: normalized,
        exists: typeof value === "string" && value.trim().length > 0,
        source: "env",
      });
    }

    if (normalized.startsWith(INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX)) {
      if (!this.options?.protectedSecretStore) {
        throw new Error("Internal CA protected secret storage is unavailable.");
      }

      const metadata = await this.options.protectedSecretStore.getSecretMetadata(normalized);
      return Object.freeze({
        secretRef: metadata.secretRef,
        exists: metadata.exists,
        source: metadata.source,
      });
    }

    if (normalized.startsWith("secret:")) {
      if (!this.options?.scopedSecretProviderRetrievalUseCase) {
        throw new Error("Internal CA secret provider retrieval is unavailable.");
      }

      const metadata = await this.options.scopedSecretProviderRetrievalUseCase
        .getServerScopedSecretProviderMaterialMetadata({
          caller: Object.freeze({
            actorId: "runtime:server:ca-bootstrap-secret-metadata",
            actorType: SecretActorTypes.serverRuntime,
            grantedActions: Object.freeze([SecretAccessActions.readMetadata]),
          }),
          providerId: this.options.providerId ?? "platform",
          secretId: normalized,
          materialKind: SecretProviderMaterialKinds.trustMaterial,
          access: {
            operationKey: `op:ca:secret-metadata:${normalized}:${Date.now()}`,
            serviceIdentity: "runtime:server:ca-bootstrap-secret-metadata",
            usage: "ca-bootstrap-secret-metadata",
            justification: `resolve CA bootstrap secret metadata for '${normalized}'`,
            occurredAt: new Date().toISOString(),
          },
        });
      if (metadata.ok) {
        return Object.freeze({
          secretRef: normalized,
          exists: true,
          source: "secret-provider",
        });
      }

      if (metadata.error.code === SecretServiceErrorCodes.notFound) {
        return Object.freeze({
          secretRef: normalized,
          exists: false,
          source: "secret-provider",
        });
      }

      throw new Error(
        `Internal CA secret provider lookup failed for '${normalized}' (${metadata.error.code}).`,
      );
    }

    throw new Error(
      `Internal CA secret reference '${normalized}' is unsupported. Use 'env:<VARIABLE_NAME>', '${INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX}<id>', or 'secret:<id>'.`,
    );
  }
}

function parseEnvironmentSecretRef(secretRef: string): string {
  const normalized = secretRef.trim();
  if (!normalized) {
    throw new Error("Internal CA secret reference is required.");
  }
  if (!normalized.startsWith("env:")) {
    throw new Error(`Internal CA secret reference '${normalized}' is unsupported. Use 'env:<VARIABLE_NAME>'.`);
  }

  const envKey = normalized.slice(4).trim();
  if (!envKey) {
    throw new Error(`Internal CA secret reference '${normalized}' is invalid.`);
  }

  return envKey;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

