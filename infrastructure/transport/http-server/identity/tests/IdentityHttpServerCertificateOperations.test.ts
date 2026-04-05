import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { CertificateOperationsBackendApi } from "../../../../api/security/CertificateOperationsBackendApi";
import { SqliteCertificateAuthorityPersistenceAdapter } from "../../../../../src/infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import { GetCertificateAuthorityStatusIntrospectionUseCase } from "../../../../../src/application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import { ListIssuedCertificateMetadataUseCase } from "../../../../../src/application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import { GetIssuedCertificateMetadataUseCase } from "../../../../../src/application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import { RevokeIssuedCertificateUseCase } from "../../../../../src/application/security/use-cases/RevokeIssuedCertificateUseCase";
import type { ResolveCertificateAuthorityStartupStateUseCase } from "../../../../../src/application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase";

const servers: Server[] = [];
const cleanup: Array<() => void> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
  while (cleanup.length > 0) {
    cleanup.pop()?.();
  }
});

async function startServer(): Promise<{
  readonly baseUrl: string;
  readonly harness: Awaited<ReturnType<typeof createIdentityAuthTestHarness>>;
}> {
  const harness = await createIdentityAuthTestHarness();
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-identity-http-cert-ops-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));

  const adapter = new SqliteCertificateAuthorityPersistenceAdapter(path.join(root, "cert-ops.sqlite"));
  cleanup.push(() => adapter.dispose());
  await seedCertificateAuthorityRecords(adapter);

  const startupStateResolver = {
    execute: async () => Object.freeze({
      state: "initialized",
      diagnostics: Object.freeze([]),
      certificateAuthorityId: "ca:internal:root:v1",
      configurationSource: "test",
    }),
  } as ResolveCertificateAuthorityStartupStateUseCase;

  const certificateOperationsBackendApi = new CertificateOperationsBackendApi({
    getCertificateAuthorityStatusIntrospectionUseCase: new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository: adapter,
      issuedCertificateRepository: adapter,
      certificateLifecycleEventRepository: adapter,
    }),
    listIssuedCertificateMetadataUseCase: new ListIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: adapter,
    }),
    getIssuedCertificateMetadataUseCase: new GetIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: adapter,
    }),
    revokeIssuedCertificateUseCase: new RevokeIssuedCertificateUseCase({
      issuedCertificateRepository: adapter,
      certificateLifecycleEventRepository: adapter,
    }),
    renewIssuedCertificateUseCase: {
      execute: async () => Object.freeze({
        previousSerialNumber: "BB22CC33",
        replacementSerialNumber: "CC33DD44",
        certificateAuthorityId: "ca:internal:root:v1",
        profileKind: "internal-service",
        previousCertificateDisposition: "supersede",
        gracePeriodDays: 0,
        replacedAt: "2026-04-05T18:35:00.000Z",
      }),
    } as never,
  });

  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    certificateOperationsBackendApi,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  servers.push(server);
  const address = server.address() as AddressInfo;
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    harness,
  });
}

async function registerAndLogin(
  baseUrl: string,
  username: string,
): Promise<{ readonly userIdentityId: string; readonly sessionToken: string }> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);
  const registerBody = await registerResponse.json();

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();

  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId,
    sessionToken: loginBody.data.sessionToken,
  });
}

async function registerAndLoginTrusted(input: {
  readonly baseUrl: string;
  readonly harness: Awaited<ReturnType<typeof createIdentityAuthTestHarness>>;
  readonly username: string;
  readonly trustedDeviceId: string;
}): Promise<{ readonly userIdentityId: string; readonly sessionToken: string }> {
  const registerResponse = await fetch(`${input.baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: input.username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);
  const registerBody = await registerResponse.json();

  await input.harness.provisionTrustedDevice({
    trustedDeviceId: input.trustedDeviceId,
    userIdentityId: registerBody.data.userIdentityId,
  });

  const loginResponse = await fetch(`${input.baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: input.username,
      sessionTrustRequirement: "require-trusted",
      client: {
        trustedDeviceBindingId: input.trustedDeviceId,
      },
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();

  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId,
    sessionToken: loginBody.data.sessionToken,
  });
}

describe("IdentityHttpServer certificate operation routes", () => {
  it("enforces authenticated trusted-session access", async () => {
    const { baseUrl } = await startServer();

    const unauthenticated = await fetch(`${baseUrl}/api/v1/security/certificates/authority/status`);
    expect(unauthenticated.status).toBe(401);

    const untrusted = await registerAndLogin(baseUrl, "certificate.ops.member");
    const forbidden = await fetch(`${baseUrl}/api/v1/security/certificates/authority/status`, {
      headers: {
        authorization: `Bearer ${untrusted.sessionToken}`,
      },
    });
    expect(forbidden.status).toBe(403);
    const forbiddenBody = await forbidden.json();
    expect(forbiddenBody.ok).toBe(false);
    expect(forbiddenBody.error.code).toBe("forbidden");
  });

  it("returns CA status and certificate metadata list/detail without secret refs", async () => {
    const { baseUrl, harness } = await startServer();
    const trusted = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "certificate.ops.admin",
      trustedDeviceId: "trusted-device:certificate-ops-admin",
    });

    const statusResponse = await fetch(`${baseUrl}/api/v1/security/certificates/authority/status`, {
      headers: {
        authorization: `Bearer ${trusted.sessionToken}`,
      },
    });
    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody.ok).toBe(true);
    expect(statusBody.data.status.certificateAuthorityId).toBe("ca:internal:root:v1");

    const listResponse = await fetch(`${baseUrl}/api/v1/security/certificates?status=issued&trustStatus=active`, {
      headers: {
        authorization: `Bearer ${trusted.sessionToken}`,
      },
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.certificates.items.length).toBe(1);
    const listed = listBody.data.certificates.items[0];
    expect((listed as Record<string, unknown>).certificateMaterialRef).toBeUndefined();
    expect((listed as Record<string, unknown>).certificateChainMaterialRef).toBeUndefined();
    expect((listed as Record<string, unknown>).trustMaterialRef).toBeUndefined();

    const detailResponse = await fetch(`${baseUrl}/api/v1/security/certificates/${encodeURIComponent("BB22CC33")}`, {
      headers: {
        authorization: `Bearer ${trusted.sessionToken}`,
      },
    });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.certificate.serialNumber).toBe("BB22CC33");
    expect((detailBody.data.certificate as Record<string, unknown>).certificateMaterialRef).toBeUndefined();
    expect((detailBody.data.certificate as Record<string, unknown>).certificateChainMaterialRef).toBeUndefined();
    expect((detailBody.data.certificate as Record<string, unknown>).trustMaterialRef).toBeUndefined();
  });

  it("supports certificate revoke and renew action endpoints", async () => {
    const { baseUrl, harness } = await startServer();
    const trusted = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "certificate.ops.actor",
      trustedDeviceId: "trusted-device:certificate-ops-actor",
    });

    const revokeResponse = await fetch(
      `${baseUrl}/api/v1/security/certificates/${encodeURIComponent("BB22CC33")}/revoke`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${trusted.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          revocationReason: "superseded",
          note: "rotation completed",
        }),
      },
    );
    expect(revokeResponse.status).toBe(200);
    const revokeBody = await revokeResponse.json();
    expect(revokeBody.ok).toBe(true);
    expect(revokeBody.data.serialNumber).toBe("BB22CC33");
    expect(revokeBody.data.currentStatus).toBe("revoked");

    const renewResponse = await fetch(
      `${baseUrl}/api/v1/security/certificates/${encodeURIComponent("BB22CC33")}/renew`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${trusted.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          publicKeyPem: "-----BEGIN PUBLIC KEY-----renew-----END PUBLIC KEY-----",
          publicKeyAlgorithm: "ed25519",
          certificateMaterialRef: "trust:cert:service:new:v1",
        }),
      },
    );
    expect(renewResponse.status).toBe(200);
    const renewBody = await renewResponse.json();
    expect(renewBody.ok).toBe(true);
    expect(renewBody.data.previousSerialNumber).toBe("BB22CC33");
    expect(renewBody.data.replacementSerialNumber).toBe("CC33DD44");
    expect((renewBody.data as Record<string, unknown>).certificateMaterialSecretRef).toBeUndefined();
  });
});

async function seedCertificateAuthorityRecords(adapter: SqliteCertificateAuthorityPersistenceAdapter): Promise<void> {
  const createdAt = "2026-04-05T17:00:00.000Z";
  const issuedAt = "2026-04-05T18:00:00.000Z";

  await adapter.saveCertificateAuthorityRoot({
    mutation: {
      operationKey: "seed-ca-root",
      context: {
        actorUserIdentityId: "seed",
        occurredAt: createdAt,
      },
    },
    record: {
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      status: "active",
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: ["ca.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      serialNumber: "AA11",
      validity: {
        notBefore: "2026-04-05T16:00:00.000Z",
        notAfter: "2030-04-05T16:00:00.000Z",
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      rootCertificateMaterialRef: "trust:ca:root-cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca:root-key:v1",
      rotationPolicy: {
        profileId: "rotation:default",
        autoRotateEnabled: false,
        rotateBeforeExpiryDays: 45,
        overlapDays: 14,
        maxLifetimeDays: 3650,
      },
      createdAt,
      createdBy: "seed",
      lastModifiedAt: createdAt,
      lastModifiedBy: "seed",
      revision: 1,
    },
  });

  await adapter.saveIssuedCertificate({
    mutation: {
      operationKey: "seed-issued-certificate",
      context: {
        actorUserIdentityId: "seed",
        occurredAt: issuedAt,
      },
    },
    record: {
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "BB22CC33",
      status: "issued",
      subject: {
        commonName: "service.api.ai-loom.internal",
        dnsNames: ["service.api.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      subjectReference: {
        kind: "service",
        referenceId: "service:api",
      },
      usages: ["server-auth", "client-auth"],
      validity: {
        notBefore: "2026-04-05T17:30:00.000Z",
        notAfter: "2027-04-05T17:30:00.000Z",
      },
      issuedAt,
      certificateMaterialRef: "trust:cert:service:api:v1",
      certificateChainMaterialRef: "trust:chain:service:api:v1",
      trustMaterialRef: "trust:bundle:service:api:v1",
      publicKeyAlgorithm: "rsa-4096",
      publicKeyFingerprintSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: issuedAt,
      createdBy: "seed",
      lastModifiedAt: issuedAt,
      lastModifiedBy: "seed",
      revision: 1,
    },
  });
}
