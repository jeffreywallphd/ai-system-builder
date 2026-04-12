import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SecretKinds, SecretScopes } from "@domain/security/SecretDomain";
import { SecretProviderMaterialKinds } from "@application/security/ports/SecretProviderPorts";
import { composeServerSecretService } from "../SecretServiceComposition";
import { DurableServerSecretStoreBackend } from "../DurableServerSecretStoreBackend";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("DurableServerSecretStoreBackend", () => {
  it("initializes once and persists server material across restart cycles", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-server-secret-store-durable-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");
    const payloadDirectory = path.join(root, "secret-envelopes");
    const env = {
      AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
      AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 28).toString("base64"),
      AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: payloadDirectory,
    };

    const serviceOne = composeServerSecretService({
      databasePath,
      env,
    });

    let initializeCalls = 0;
    const backendOne = new DurableServerSecretStoreBackend({
      runtimeSecretConsumptionAdapters: serviceOne.runtimeSecretConsumptionAdapters,
      getSecretMetadata: (request) => serviceOne.getSecretMetadataUseCase.execute(request),
      createSecret: (request) => serviceOne.createSecretUseCase.execute(request),
      initialize: async () => {
        initializeCalls += 1;
      },
    });

    try {
      const missing = await backendOne.serverMaterialExists({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:exists-missing"),
      });
      expect(missing).toEqual({
        ok: true,
        value: {
          exists: false,
        },
      });

      const created = await backendOne.bootstrapServerMaterial({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:bootstrap-create"),
        name: "provider.openai.api-key",
        kind: SecretKinds.apiKey,
        plaintext: "sk-durable-v1",
      });
      expect(created.ok).toBeTrue();
      if (!created.ok) {
        return;
      }
      expect(created.value.outcome).toBe("created");

      const existing = await backendOne.bootstrapServerMaterial({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:bootstrap-existing"),
        name: "provider.openai.api-key",
        kind: SecretKinds.apiKey,
        plaintext: "sk-durable-v1",
      });
      expect(existing.ok).toBeTrue();
      if (!existing.ok) {
        return;
      }
      expect(existing.value.outcome).toBe("existing");

      const runtime = await backendOne.resolveServerMaterial({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:runtime-read"),
      });
      expect(runtime).toEqual({
        ok: true,
        value: {
          providerId: "openai",
          secretId: "secret:server:provider:openai",
          currentVersionId: "secret:server:provider:openai:v1",
          scope: {
            scope: SecretScopes.server,
          },
          materialKind: SecretProviderMaterialKinds.providerCredential,
          rawValue: "sk-durable-v1",
        },
      });

      expect(initializeCalls).toBe(1);
    } finally {
      serviceOne.dispose();
    }

    const serviceTwo = composeServerSecretService({
      databasePath,
      env,
    });
    const backendTwo = new DurableServerSecretStoreBackend({
      runtimeSecretConsumptionAdapters: serviceTwo.runtimeSecretConsumptionAdapters,
      getSecretMetadata: (request) => serviceTwo.getSecretMetadataUseCase.execute(request),
      createSecret: (request) => serviceTwo.createSecretUseCase.execute(request),
    });

    try {
      const existsAfterRestart = await backendTwo.serverMaterialExists({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:exists-after-restart"),
      });
      expect(existsAfterRestart).toEqual({
        ok: true,
        value: {
          exists: true,
        },
      });

      const metadata = await backendTwo.resolveServerMaterialMetadata({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:metadata-after-restart"),
      });
      expect(metadata.ok).toBeTrue();
      if (metadata.ok) {
        expect(metadata.value.backend.backendKind).toBe("durable-server-secret-store");
        expect((metadata.value as Record<string, unknown>).rawValue).toBeUndefined();
      }

      const runtime = await backendTwo.resolveServerMaterial({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:runtime-after-restart"),
      });
      expect(runtime).toEqual({
        ok: true,
        value: {
          providerId: "openai",
          secretId: "secret:server:provider:openai",
          currentVersionId: "secret:server:provider:openai:v1",
          scope: {
            scope: SecretScopes.server,
          },
          materialKind: SecretProviderMaterialKinds.providerCredential,
          rawValue: "sk-durable-v1",
        },
      });
    } finally {
      serviceTwo.dispose();
    }
  });

  it("fails closed when controlled initialization fails", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-server-secret-store-init-failure-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 29).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    let initializeCalls = 0;
    const backend = new DurableServerSecretStoreBackend({
      runtimeSecretConsumptionAdapters: service.runtimeSecretConsumptionAdapters,
      getSecretMetadata: (request) => service.getSecretMetadataUseCase.execute(request),
      createSecret: (request) => service.createSecretUseCase.execute(request),
      initialize: async () => {
        initializeCalls += 1;
        throw new Error("init failed");
      },
    });

    try {
      const result = await backend.serverMaterialExists({
        selector: createServerSelector("secret:server:provider:openai"),
        access: createAccess("op:test:server-secret:init-failure"),
      });
      expect(result).toEqual({
        ok: false,
        error: {
          code: "secret-internal",
          message: "Durable server secret store backend initialization failed.",
          details: {
            reason: "init failed",
          },
        },
      });
      expect(initializeCalls).toBe(1);
    } finally {
      service.dispose();
    }
  });
});

function createServerSelector(secretId: string) {
  return Object.freeze({
    providerId: "openai",
    secretId,
    scope: Object.freeze({
      scope: SecretScopes.server,
    }),
    materialKind: SecretProviderMaterialKinds.providerCredential,
  });
}

function createAccess(operationKey: string) {
  return Object.freeze({
    operationKey,
    serviceIdentity: "runtime:server:test",
    usage: "provider-runtime",
  });
}
