import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SecretAccessActions, SecretActorTypes } from "@domain/security/SecretDomain";
import {
  SystemSecretBootstrapDiagnosticCodes,
  SystemSecretBootstrapStates,
  bootstrapSystemSecretsFromEnvironment,
} from "../SystemSecretBootstrapService";
import { composeServerSecretService } from "../SecretServiceComposition";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SystemSecretBootstrapService", () => {
  it("migrates required system secrets from legacy environment configuration", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-migrate-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 11).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const result = await bootstrapSystemSecretsFromEnvironment({
        env: {
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
          OPENAI_API_KEY: "sk-live-bootstrap",
        },
        secretService: service,
      });

      expect(result.state).toBe(SystemSecretBootstrapStates.ready);
      expect(result.migratedSecretIds).toEqual(["secret:server:provider:openai"]);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.materialMetadata).toHaveLength(1);
      expect((result.materialMetadata[0] as Record<string, unknown>).rawValue).toBeUndefined();

      const metadata = await service.getSecretMetadataUseCase.execute({
        actor: {
          actorId: "user:server-admin",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: [SecretAccessActions.readMetadata],
        },
        secretId: "secret:server:provider:openai",
      });
      expect(metadata.ok).toBeTrue();
    } finally {
      service.dispose();
    }
  });

  it("returns invalid when a required system secret is missing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-missing-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 12).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const result = await bootstrapSystemSecretsFromEnvironment({
        env: {
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:huggingface",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService: service,
      });

      expect(result.state).toBe(SystemSecretBootstrapStates.invalid);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: SystemSecretBootstrapDiagnosticCodes.requiredSecretMissing,
          secretId: "secret:server:provider:huggingface",
        }),
      ]);
      expect(result.materialMetadata).toHaveLength(0);
    } finally {
      service.dispose();
    }
  });

  it("returns invalid when migration is needed but secret encryption is unavailable", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-unconfigured-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {},
    });

    try {
      const result = await bootstrapSystemSecretsFromEnvironment({
        env: {
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
          OPENAI_API_KEY: "sk-live-bootstrap",
        },
        secretService: service,
      });

      expect(result.state).toBe(SystemSecretBootstrapStates.invalid);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: SystemSecretBootstrapDiagnosticCodes.legacyMigrationUnavailable,
          secretId: "secret:server:provider:openai",
        }),
      ]);
      expect(result.materialMetadata).toHaveLength(0);
    } finally {
      service.dispose();
    }
  });

  it("migrates and validates identity-session signing material through platform secret consumers", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-signing-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 13).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const result = await bootstrapSystemSecretsFromEnvironment({
        env: {
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:signing:identity-session",
          AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----v1-----END PRIVATE KEY-----",
        },
        secretService: service,
      });

      expect(result.state).toBe(SystemSecretBootstrapStates.ready);
      expect(result.migratedSecretIds).toEqual(["secret:server:signing:identity-session"]);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.materialMetadata).toHaveLength(1);
      expect((result.materialMetadata[0] as Record<string, unknown>).rawValue).toBeUndefined();
    } finally {
      service.dispose();
    }
  });

  it("creates missing identity-session signing material through bootstrap policy and reuses it across restart", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-signing-create-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");
    const env = {
      AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
      AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 16).toString("base64"),
      AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
    };

    const serviceOne = composeServerSecretService({
      databasePath,
      env,
    });

    let firstSigningKey = "";
    try {
      const firstResult = await bootstrapSystemSecretsFromEnvironment({
        env: {
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:signing:identity-session",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService: serviceOne,
      });

      expect(firstResult.state).toBe(SystemSecretBootstrapStates.ready);
      expect(firstResult.migratedSecretIds).toEqual([]);
      expect(firstResult.diagnostics).toEqual([]);

      const metadata = await serviceOne.getSecretMetadataUseCase.execute({
        actor: {
          actorId: "user:server-admin",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: [SecretAccessActions.readMetadata],
        },
        secretId: "secret:server:signing:identity-session",
      });
      expect(metadata.ok).toBeTrue();
      if (!metadata.ok) {
        return;
      }
      expect(metadata.value.metadata.tags).toContain("bootstrap-generated");

      const runtimeValue = await serviceOne.runtimeSecretConsumptionAdapters.resolveServerSigningCredential({
        secretId: "secret:server:signing:identity-session",
        operationKey: "op:test:system-secret-bootstrap:signing:first",
        serviceIdentity: "runtime:test",
        signingPurpose: "identity-session-token-signing",
      });
      expect(runtimeValue.ok).toBeTrue();
      if (!runtimeValue.ok) {
        return;
      }
      firstSigningKey = runtimeValue.value.credential;
      expect(firstSigningKey).toContain("BEGIN PRIVATE KEY");
    } finally {
      serviceOne.dispose();
    }

    const serviceTwo = composeServerSecretService({
      databasePath,
      env,
    });

    try {
      const secondResult = await bootstrapSystemSecretsFromEnvironment({
        env: {
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:signing:identity-session",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService: serviceTwo,
      });

      expect(secondResult.state).toBe(SystemSecretBootstrapStates.ready);
      expect(secondResult.migratedSecretIds).toEqual([]);
      expect(secondResult.diagnostics).toEqual([]);

      const runtimeValue = await serviceTwo.runtimeSecretConsumptionAdapters.resolveServerSigningCredential({
        secretId: "secret:server:signing:identity-session",
        operationKey: "op:test:system-secret-bootstrap:signing:second",
        serviceIdentity: "runtime:test",
        signingPurpose: "identity-session-token-signing",
      });
      expect(runtimeValue.ok).toBeTrue();
      if (!runtimeValue.ok) {
        return;
      }

      expect(runtimeValue.value.credential).toBe(firstSigningKey);
    } finally {
      serviceTwo.dispose();
    }
  });

  it("treats identity-session signing material as optional development-ephemeral when missing in development", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-dev-optional-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 14).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const result = await bootstrapSystemSecretsFromEnvironment({
        env: {
          NODE_ENV: "development",
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:signing:identity-session",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService: service,
      });

      expect(result.state).toBe(SystemSecretBootstrapStates.ready);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: SystemSecretBootstrapDiagnosticCodes.optionalSecretMissing,
          secretId: "secret:server:signing:identity-session",
          severity: "warning",
          startupRequirement: "optional",
          durabilityClass: "ephemeral",
          fallbackPolicy: "generate-ephemeral-for-development",
        }),
      ]);
      expect(result.materialMetadata).toHaveLength(0);
    } finally {
      service.dispose();
    }
  });

  it("keeps identity-session signing material fail-fast required in production", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-system-secret-bootstrap-prod-required-"));
    createdRoots.push(root);
    const service = composeServerSecretService({
      databasePath: path.join(root, "identity.sqlite"),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 15).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: path.join(root, "secret-envelopes"),
      },
    });

    try {
      const result = await bootstrapSystemSecretsFromEnvironment({
        env: {
          NODE_ENV: "production",
          AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:signing:identity-session",
          AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
        },
        secretService: service,
      });

      expect(result.state).toBe(SystemSecretBootstrapStates.invalid);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: SystemSecretBootstrapDiagnosticCodes.requiredSecretMissing,
          secretId: "secret:server:signing:identity-session",
          severity: "error",
          startupRequirement: "fail-fast-required",
          durabilityClass: "durable",
          fallbackPolicy: "migrate-legacy-input",
        }),
      ]);
      expect(result.materialMetadata).toHaveLength(0);
    } finally {
      service.dispose();
    }
  });
});

