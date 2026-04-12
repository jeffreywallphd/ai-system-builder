import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  EnvironmentCertificateAuthorityBootstrapConfigurationProvider,
  EnvironmentCertificateAuthoritySecretService,
} from "../InternalCertificateAuthorityBootstrapEnvironmentAdapter";
import { SecretServiceErrorCodes } from "@application/security/use-cases/SecretManagementServiceContracts";
import { SecretProviderMaterialKinds } from "@application/security/ports/SecretProviderPorts";
import { SecretScopes } from "@domain/security/SecretDomain";
import type { ScopedSecretProviderMaterialRetrievalUseCase } from "@application/security/use-cases/ScopedSecretProviderMaterialRetrievalUseCase";
import { ScopedAesGcmEncryptionService } from "../encryption/ScopedAesGcmEncryptionService";
import { FileSystemProtectedSecretStore } from "../secrets/FileSystemProtectedSecretStore";

describe("InternalCertificateAuthorityBootstrapEnvironmentAdapter", () => {
  it("loads CA bootstrap configuration from approved environment keys", async () => {
    const provider = new EnvironmentCertificateAuthorityBootstrapConfigurationProvider({
      AI_LOOM_INTERNAL_CA_ID: "ca:internal:root:v1",
      AI_LOOM_INTERNAL_CA_ROOT_CERT_MATERIAL_REF: "trust:ca:cert:v1",
      AI_LOOM_INTERNAL_CA_ROOT_KEY_MATERIAL_REF: "trust:ca:key:v1",
      AI_LOOM_INTERNAL_CA_ROOT_CERT_SECRET_REF: "env:AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM",
      AI_LOOM_INTERNAL_CA_ROOT_KEY_SECRET_REF: "env:AI_LOOM_INTERNAL_CA_ROOT_KEY_PEM",
    });

    const configuration = await provider.loadConfiguration();
    expect(configuration.source).toBe("env");
    expect(configuration.certificateAuthorityId).toBe("ca:internal:root:v1");
    expect(configuration.rootCertificateSecretRef).toBe("env:AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM");
  });

  it("resolves secret metadata through env:<VARIABLE_NAME> references", async () => {
    const service = new EnvironmentCertificateAuthoritySecretService({
      AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM: "-----BEGIN CERTIFICATE----- ...",
    });

    const found = await service.getSecretMetadata("env:AI_LOOM_INTERNAL_CA_ROOT_CERT_PEM");
    const missing = await service.getSecretMetadata("env:AI_LOOM_INTERNAL_CA_ROOT_KEY_PEM");

    expect(found.exists).toBeTrue();
    expect(missing.exists).toBeFalse();
  });

  it("rejects unsupported secret reference formats", async () => {
    const service = new EnvironmentCertificateAuthoritySecretService({});
    await expect(service.getSecretMetadata("vault://ca/root-key")).rejects.toThrow("unsupported");
  });

  it("resolves secret metadata through protected secret-store references", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-ca-secret-service-"));
    const protectedSecretStore = new FileSystemProtectedSecretStore(
      tempDirectory,
      new ScopedAesGcmEncryptionService({
        default: Buffer.alloc(32, 2).toString("base64"),
      }),
    );
    await protectedSecretStore.saveSecret({
      secretRef: "secret-store:internal-ca:root-key",
      plaintextValue: "-----BEGIN ENCRYPTED PRIVATE KEY----- ...",
      keyScope: "default",
    });

    const service = new EnvironmentCertificateAuthoritySecretService({}, {
      protectedSecretStore,
    });
    const metadata = await service.getSecretMetadata("secret-store:internal-ca:root-key");
    expect(metadata.exists).toBeTrue();
    expect(metadata.source).toBe("file-protected-secret-store");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when protected secret references are configured without an available protected store", async () => {
    const service = new EnvironmentCertificateAuthoritySecretService({});
    await expect(service.getSecretMetadata("secret-store:internal-ca:root-key")).rejects.toThrow(
      "unavailable",
    );
  });

  it("resolves secret metadata through provider-backed secret:<id> references", async () => {
    const scopedUseCase = {
      async getServerScopedSecretProviderMaterialMetadata() {
        return {
          ok: true,
          value: Object.freeze({
            providerId: "platform",
            secretId: "secret:server:ca-root-cert",
            scope: Object.freeze({
              scope: SecretScopes.server,
            }),
            materialKind: SecretProviderMaterialKinds.trustMaterial,
          }),
        };
      },
    } as unknown as ScopedSecretProviderMaterialRetrievalUseCase;
    const service = new EnvironmentCertificateAuthoritySecretService({}, {
      scopedSecretProviderRetrievalUseCase: scopedUseCase,
    });

    const metadata = await service.getSecretMetadata("secret:server:ca-root-cert");
    expect(metadata.exists).toBeTrue();
    expect(metadata.source).toBe("secret-provider");
  });

  it("maps missing provider-backed secret:<id> references to exists=false", async () => {
    const scopedUseCase = {
      async getServerScopedSecretProviderMaterialMetadata() {
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.notFound,
            message: "missing",
          }),
        };
      },
    } as unknown as ScopedSecretProviderMaterialRetrievalUseCase;
    const service = new EnvironmentCertificateAuthoritySecretService({}, {
      scopedSecretProviderRetrievalUseCase: scopedUseCase,
    });

    const metadata = await service.getSecretMetadata("secret:server:ca-root-key");
    expect(metadata.exists).toBeFalse();
    expect(metadata.source).toBe("secret-provider");
  });
});
