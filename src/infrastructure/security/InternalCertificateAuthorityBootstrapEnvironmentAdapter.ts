import type {
  CertificateAuthorityBootstrapConfiguration,
  ICertificateAuthorityBootstrapConfigurationProvider,
} from "../../application/security/ports/ICertificateAuthorityBootstrapConfigurationProvider";
import type {
  CertificateAuthoritySecretMetadata,
  ICertificateAuthorityBootstrapSecretService,
} from "../../application/security/ports/ICertificateAuthorityBootstrapSecretService";

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
  public constructor(private readonly env: Readonly<Record<string, string | undefined>>) {}

  public async getSecretMetadata(secretRef: string): Promise<CertificateAuthoritySecretMetadata> {
    const normalized = secretRef.trim();
    const environmentVariableKey = parseEnvironmentSecretRef(normalized);
    const value = this.env[environmentVariableKey];
    return Object.freeze({
      secretRef: normalized,
      exists: typeof value === "string" && value.trim().length > 0,
      source: "env",
    });
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
