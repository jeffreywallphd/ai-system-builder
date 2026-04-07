import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { IEncryptionAtRestPolicyContextResolverPort } from "@application/security/ports/EncryptionAtRestPolicyEvaluationPorts";
import { EncryptionPolicyEvaluationService } from "@application/security/use-cases/EncryptionPolicyEvaluationService";
import { EncryptionKeyResolutionService } from "@application/security/use-cases/EncryptionKeyResolutionService";
import { EncryptionKeyLifecycleStates } from "@application/security/ports/EncryptionKeyResolutionPorts";
import {
  createEncryptionAtRestPolicyDefinition,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  SecretScopes,
  createSecretVersion,
} from "@domain/security/SecretDomain";
import { StaticEncryptionKeyCatalogPort } from "../../encryption/StaticEncryptionKeyCatalogPort";
import { StaticEncryptionKeyMaterialPort } from "../../encryption/StaticEncryptionKeyMaterialPort";
import { VersionedAesGcmProtectedValueEncryptionPort } from "../../encryption/VersionedAesGcmProtectedValueEncryptionPort";
import { ProtectedValueSecretEncryptionPort } from "../ProtectedValueSecretEncryptionPort";
import { FileSystemSecretEncryptedPayloadStore } from "../FileSystemSecretEncryptedPayloadStore";

describe("ProtectedValueSecretEncryptionPort", () => {
  it("stores protected value payload records and decrypts by persisted secret version material", async () => {
    const root = mkdtempSync(join(tmpdir(), "ai-loom-secret-protected-value-port-"));
    const payloadDirectory = join(root, "payloads");
    const keyReferenceId = "keyref:server:default";

    const policyResolver: IEncryptionAtRestPolicyContextResolverPort = {
      resolvePolicyContext: async () => Object.freeze({
        platformPolicy: createEncryptionAtRestPolicyDefinition({
          policyId: "policy:platform:secret-protected-value-test",
          scope: EncryptionPolicyScopes.platform,
          rules: Object.freeze([
            Object.freeze({
              dataClass: ProtectedDataClasses.secretMaterial,
              encryptionMode: EncryptionModes.scopedContent,
              keyScope: EncryptionKeyScopes.server,
            }),
            Object.freeze({
              dataClass: ProtectedDataClasses.secretMetadata,
              encryptionMode: EncryptionModes.metadataOnly,
              keyScope: EncryptionKeyScopes.server,
            }),
            Object.freeze({
              dataClass: ProtectedDataClasses.sensitiveMetadata,
              encryptionMode: EncryptionModes.metadataOnly,
              keyScope: EncryptionKeyScopes.server,
            }),
          ]),
        }),
      }),
    };

    const keyResolutionService = new EncryptionKeyResolutionService({
      encryptionPolicyEvaluationService: new EncryptionPolicyEvaluationService({
        encryptionAtRestPolicyContextResolverPort: policyResolver,
      }),
      encryptionKeyCatalogPort: new StaticEncryptionKeyCatalogPort({
        keys: [Object.freeze({
          keyReferenceId,
          keyId: "kek:server:default",
          keyVersion: "v1",
          algorithm: "aes-256-gcm",
          scopeOwner: Object.freeze({
            scope: EncryptionKeyScopes.server,
          }),
          lifecycleState: EncryptionKeyLifecycleStates.active,
          activatedAt: "2026-01-01T00:00:00.000Z",
        })],
      }),
    });
    const protectedValueEncryptionPort = new VersionedAesGcmProtectedValueEncryptionPort({
      encryptionKeyMaterialPort: new StaticEncryptionKeyMaterialPort({
        keyMaterials: [Object.freeze({
          keyReferenceId,
          algorithm: "aes-256-gcm",
          encodedKey: Buffer.alloc(32, 17).toString("base64"),
        })],
      }),
    });
    const port = new ProtectedValueSecretEncryptionPort(
      keyResolutionService,
      protectedValueEncryptionPort,
      new FileSystemSecretEncryptedPayloadStore(payloadDirectory),
    );

    const encrypted = await port.encryptSecretPlaintext({
      secretId: "secret:server:openai",
      owner: { scope: SecretScopes.server },
      plaintext: "sk-live-roundtrip",
    });

    const files = readdirSync(payloadDirectory);
    expect(files.length).toBe(1);
    const payloadContents = readFileSync(join(payloadDirectory, files[0] as string), "utf8");
    expect(payloadContents).not.toContain("sk-live-roundtrip");
    expect(payloadContents).toContain("ai-loom-protected-secret-payload/v1");

    const version = createSecretVersion({
      versionId: "secret:server:openai:v1",
      secretId: "secret:server:openai",
      version: 1,
      owner: { scope: SecretScopes.server },
      createdBy: "user:admin",
      encryptedPayloadRef: encrypted.encryptedPayloadRef,
      payloadDigestSha256: encrypted.payloadDigestSha256,
      payloadByteLength: encrypted.payloadByteLength,
      keyEncryptionContext: encrypted.keyEncryptionContext,
    });

    const decrypted = await port.decryptSecretPlaintext({
      secretId: "secret:server:openai",
      version,
    });

    expect(decrypted.plaintext).toBe("sk-live-roundtrip");
    rmSync(root, { recursive: true, force: true });
  });
});

