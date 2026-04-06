import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { SecretAccessActions, SecretActorTypes, SecretKinds, SecretScopes } from "../../../../domain/security/SecretDomain";
import { composeServerSecretService } from "../SecretServiceComposition";
import { SecretServiceOperationalDiagnosticsProvider } from "../SecretServiceOperationalDiagnostics";

describe("SecretServiceOperationalDiagnosticsProvider", () => {
  it("returns healthy diagnostics when encryption and bootstrap checks are satisfied", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-secret-diagnostics-healthy-"));
    const secretService = composeServerSecretService({
      databasePath: path.join(root, "secret-diagnostics-healthy.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 25).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const createResult = await secretService.createSecretUseCase.execute({
        actor: {
          actorId: "user:admin",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: [SecretAccessActions.create],
        },
        operationKey: "op:secret-diagnostics:create:openai",
        secretId: "secret:server:provider:openai",
        name: "provider.openai.api-key",
        owner: {
          scope: SecretScopes.server,
        },
        kind: SecretKinds.apiKey,
        plaintext: "sk-live-healthy",
      });
      expect(createResult.ok).toBeTrue();

      const provider = new SecretServiceOperationalDiagnosticsProvider({
        env: {
          AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
          AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 25).toString("base64"),
          AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService,
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      });
      const diagnostics = await provider.collectDiagnostics();
      expect(diagnostics.state).toBe("healthy");
      expect(diagnostics.healthFlags.encryptionMaterialAvailable).toBeTrue();
      expect(diagnostics.healthFlags.repositoryReachable).toBeTrue();
      expect(diagnostics.healthFlags.bootstrapSecretsHealthy).toBeTrue();
      expect(diagnostics.diagnostics).toHaveLength(0);
      expect(diagnostics.bootstrap.diagnostics).toHaveLength(0);
    } finally {
      secretService.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns degraded diagnostics when encryption is unavailable and required bootstrap secret is missing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-secret-diagnostics-degraded-"));
    const secretService = composeServerSecretService({
      databasePath: path.join(root, "secret-diagnostics-degraded.sqlite"),
      env: {
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const provider = new SecretServiceOperationalDiagnosticsProvider({
        env: {
          AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService,
        now: () => new Date("2026-04-06T12:05:00.000Z"),
      });
      const diagnostics = await provider.collectDiagnostics();
      expect(diagnostics.state).toBe("degraded");
      expect(diagnostics.healthFlags.encryptionMaterialAvailable).toBeFalse();
      expect(diagnostics.healthFlags.repositoryReachable).toBeTrue();
      expect(diagnostics.healthFlags.bootstrapSecretsHealthy).toBeFalse();
      expect(diagnostics.bootstrap.requiredSecretIds).toEqual(["secret:server:provider:openai"]);
      expect(diagnostics.diagnostics.some((entry) => entry.code === "secret-encryption-unavailable")).toBeTrue();
      expect(diagnostics.bootstrap.diagnostics.some((entry) => entry.code === "required-secret-missing")).toBeTrue();
      expect(diagnostics.bootstrap.diagnostics.some((entry) => entry.message.includes("sk-live"))).toBeFalse();
    } finally {
      secretService.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
