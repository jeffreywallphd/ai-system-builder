import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { SecretMetadataBackendApi } from "../../../../api/security/SecretMetadataBackendApi";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import { composeServerSecretService } from "@infrastructure/security/secrets/SecretServiceComposition";

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
  const root = mkdtempSync(path.join(tmpdir(), "ai-loom-identity-http-secret-metadata-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));

  const secretService = composeServerSecretService({
    databasePath: path.join(root, "secret-metadata-api.sqlite"),
    env: {
      AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
      AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 19).toString("base64"),
      AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
    },
  });
  cleanup.push(() => secretService.dispose());

  const secretMetadataBackendApi = new SecretMetadataBackendApi({
    createSecretUseCase: secretService.createSecretUseCase,
    getSecretMetadataUseCase: secretService.getSecretMetadataUseCase,
    listSecretsUseCase: secretService.listSecretsUseCase,
    disableSecretUseCase: secretService.disableSecretUseCase,
    rotateSecretUseCase: secretService.rotateSecretUseCase,
    reEncryptSecretsUseCase: secretService.reEncryptSecretsUseCase,
  });

  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    secretMetadataBackendApi,
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

describe("IdentityHttpServer secret metadata routes", () => {
  it("exposes general health and trusted-only diagnostics endpoints", async () => {
    const { baseUrl, harness } = await startServer();
    const owner = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "secret.metadata.health.owner",
      trustedDeviceId: "trusted-device:secret-metadata-health-owner",
    });
    const untrusted = await registerAndLogin(baseUrl, "secret.metadata.health.untrusted");

    const healthResponse = await fetch(`${baseUrl}/api/v1/security/secrets/health`, {
      headers: {
        authorization: `Bearer ${untrusted.sessionToken}`,
      },
    });
    expect(healthResponse.status).toBe(200);
    const healthBody = await healthResponse.json();
    expect(healthBody.ok).toBe(true);
    expect(healthBody.data.health).toBeDefined();
    expect((healthBody.data.health as Record<string, unknown>).bootstrap).toBeUndefined();

    const deniedDiagnostics = await fetch(`${baseUrl}/api/v1/security/secrets/diagnostics`, {
      headers: {
        authorization: `Bearer ${untrusted.sessionToken}`,
      },
    });
    expect(deniedDiagnostics.status).toBe(403);

    const diagnosticsResponse = await fetch(`${baseUrl}/api/v1/security/secrets/diagnostics`, {
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
      },
    });
    expect(diagnosticsResponse.status).toBe(200);
    const diagnosticsBody = await diagnosticsResponse.json();
    expect(diagnosticsBody.ok).toBe(true);
    expect(diagnosticsBody.data.diagnostics.healthFlags.repositoryReachable).toBeTrue();
    expect((diagnosticsBody.data.diagnostics as Record<string, unknown>).plaintext).toBeUndefined();
  });

  it("supports create/list/get/rotate/disable metadata-only secret APIs", async () => {
    const { baseUrl, harness } = await startServer();
    const owner = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "secret.metadata.owner.http",
      trustedDeviceId: "trusted-device:secret-metadata-owner-http",
    });

    const createResponse = await fetch(`${baseUrl}/api/v1/security/secrets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secretId: "secret:user:metadata-http-openai",
        name: "personal.openai.api-key",
        owner: {
          scope: "user",
          userIdentityId: owner.userIdentityId,
        },
        kind: "api-key",
        plaintext: "sk-live-never-returned",
        metadata: {
          tags: ["openai"],
          labels: {
            provider: "openai",
            usage: "model-inference",
          },
        },
      }),
    });
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.ok).toBe(true);
    expect((createBody.data.secret as Record<string, unknown>).plaintext).toBeUndefined();

    const listResponse = await fetch(
      `${baseUrl}/api/v1/security/secrets?scope=user&userIdentityId=${encodeURIComponent(owner.userIdentityId)}`,
      {
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.items).toHaveLength(1);
    expect((listBody.data.items[0] as Record<string, unknown>).plaintext).toBeUndefined();

    const getResponse = await fetch(
      `${baseUrl}/api/v1/security/secrets/${encodeURIComponent("secret:user:metadata-http-openai")}`,
      {
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.ok).toBe(true);
    expect((getBody.data.secret as Record<string, unknown>).plaintext).toBeUndefined();

    const rotateResponse = await fetch(
      `${baseUrl}/api/v1/security/secrets/${encodeURIComponent("secret:user:metadata-http-openai")}/rotate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationKey: "op:secret:rotate:metadata-http-openai",
          plaintext: "sk-live-rotated-never-returned",
          expectedCurrentVersionId: createBody.data.secret.currentVersionId,
        }),
      },
    );
    expect(rotateResponse.status).toBe(200);
    const rotateBody = await rotateResponse.json();
    expect(rotateBody.ok).toBe(true);
    expect(rotateBody.data.secret.currentVersionId).not.toBe(createBody.data.secret.currentVersionId);
    expect((rotateBody.data.secret as Record<string, unknown>).plaintext).toBeUndefined();

    const disableResponse = await fetch(
      `${baseUrl}/api/v1/security/secrets/${encodeURIComponent("secret:user:metadata-http-openai")}/disable`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationKey: "op:secret:disable:metadata-http-openai",
        }),
      },
    );
    expect(disableResponse.status).toBe(200);
    const disableBody = await disableResponse.json();
    expect(disableBody.ok).toBe(true);
    expect(disableBody.data.secret.state).toBe("disabled");
    expect((disableBody.data.secret as Record<string, unknown>).plaintext).toBeUndefined();

    const listAfterDisableDefault = await fetch(
      `${baseUrl}/api/v1/security/secrets?scope=user&userIdentityId=${encodeURIComponent(owner.userIdentityId)}`,
      {
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(listAfterDisableDefault.status).toBe(200);
    const listAfterDisableDefaultBody = await listAfterDisableDefault.json();
    expect(listAfterDisableDefaultBody.ok).toBe(true);
    expect(listAfterDisableDefaultBody.data.items).toHaveLength(0);

    const listAfterDisableIncluded = await fetch(
      `${baseUrl}/api/v1/security/secrets?scope=user&userIdentityId=${encodeURIComponent(owner.userIdentityId)}&includeDisabled=true`,
      {
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(listAfterDisableIncluded.status).toBe(200);
    const listAfterDisableIncludedBody = await listAfterDisableIncluded.json();
    expect(listAfterDisableIncludedBody.ok).toBe(true);
    expect(listAfterDisableIncludedBody.data.items).toHaveLength(1);
    expect(listAfterDisableIncludedBody.data.items[0].state).toBe("disabled");
  });

  it("supports trusted administrative re-encryption workflow endpoints", async () => {
    const { baseUrl, harness } = await startServer();
    const owner = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "secret.metadata.owner.reencrypt",
      trustedDeviceId: "trusted-device:secret-metadata-owner-reencrypt",
    });

    const createResponse = await fetch(`${baseUrl}/api/v1/security/secrets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secretId: "secret:user:metadata-http-reencrypt",
        name: "personal.openai.reencrypt",
        owner: {
          scope: "user",
          userIdentityId: owner.userIdentityId,
        },
        kind: "api-key",
        plaintext: "sk-live-before-reencrypt",
      }),
    });
    expect(createResponse.status).toBe(200);

    const startResponse = await fetch(`${baseUrl}/api/v1/security/secrets/maintenance/re-encryption`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operationKey: "op:secret:http:reencrypt:1",
        maxTargetsPerInvocation: 50,
      }),
    });
    expect(startResponse.status).toBe(200);
    const startBody = await startResponse.json();
    expect(startBody.ok).toBe(true);
    expect(["running", "succeeded"]).toContain(startBody.data.operation.status);

    const statusResponse = await fetch(
      `${baseUrl}/api/v1/security/secrets/maintenance/re-encryption/${encodeURIComponent(startBody.data.operation.operationId)}`,
      {
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody.ok).toBe(true);
    expect(statusBody.data.operation.operationId).toBe(startBody.data.operation.operationId);
  });

  it("returns denial responses for unauthorized secret detail access", async () => {
    const { baseUrl, harness } = await startServer();
    const owner = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "secret.metadata.owner.denial",
      trustedDeviceId: "trusted-device:secret-metadata-owner-denial",
    });
    const viewer = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "secret.metadata.viewer.denial",
      trustedDeviceId: "trusted-device:secret-metadata-viewer-denial",
    });

    const createResponse = await fetch(`${baseUrl}/api/v1/security/secrets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secretId: "secret:user:metadata-http-denied",
        name: "personal.openai.api-key",
        owner: {
          scope: "user",
          userIdentityId: owner.userIdentityId,
        },
        kind: "api-key",
        plaintext: "sk-live-hidden",
      }),
    });
    expect(createResponse.status).toBe(200);

    const deniedGet = await fetch(
      `${baseUrl}/api/v1/security/secrets/${encodeURIComponent("secret:user:metadata-http-denied")}`,
      {
        headers: {
          authorization: `Bearer ${viewer.sessionToken}`,
        },
      },
    );
    expect(deniedGet.status).toBe(403);

    const deniedDisable = await fetch(
      `${baseUrl}/api/v1/security/secrets/${encodeURIComponent("secret:user:metadata-http-denied")}/disable`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${viewer.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationKey: "op:secret:disable:metadata-http-denied",
        }),
      },
    );
    expect(deniedDisable.status).toBe(404);

    const deniedRotate = await fetch(
      `${baseUrl}/api/v1/security/secrets/${encodeURIComponent("secret:user:metadata-http-denied")}/rotate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${viewer.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationKey: "op:secret:rotate:metadata-http-denied",
          plaintext: "sk-live-hidden-rotated",
        }),
      },
    );
    expect(deniedRotate.status).toBe(404);
  });

  it("enforces request validation for secret metadata APIs", async () => {
    const { baseUrl, harness } = await startServer();
    const owner = await registerAndLoginTrusted({
      baseUrl,
      harness,
      username: "secret.metadata.owner.validation",
      trustedDeviceId: "trusted-device:secret-metadata-owner-validation",
    });

    const invalidCreate = await fetch(`${baseUrl}/api/v1/security/secrets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secretId: "",
        name: "",
        owner: {
          scope: "invalid-scope",
        },
        kind: "api-key",
        plaintext: "x",
      }),
    });
    expect(invalidCreate.status).toBe(400);
    const invalidCreateBody = await invalidCreate.json();
    expect(invalidCreateBody.ok).toBe(false);
    expect(invalidCreateBody.error.code).toBe("invalid-request");

    const invalidList = await fetch(
      `${baseUrl}/api/v1/security/secrets?scope=user&includeDisabled=not-a-boolean`,
      {
        headers: {
          authorization: `Bearer ${owner.sessionToken}`,
        },
      },
    );
    expect(invalidList.status).toBe(400);
    const invalidListBody = await invalidList.json();
    expect(invalidListBody.ok).toBe(false);
    expect(invalidListBody.error.code).toBe("invalid-request");
  });
});

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

