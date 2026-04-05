import { describe, expect, it } from "bun:test";
import {
  EnvironmentCertificateAuthorityBootstrapConfigurationProvider,
  EnvironmentCertificateAuthoritySecretService,
} from "../InternalCertificateAuthorityBootstrapEnvironmentAdapter";

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
});
