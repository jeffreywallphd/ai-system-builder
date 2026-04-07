import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SecretScopes,
  createSecretVersion,
} from "@domain/security/SecretDomain";
import {
  SecretEnvelopeEncryptionService,
  StaticSecretMasterKeyProvider,
} from "../../encryption/SecretEnvelopeEncryption";
import { EnvelopeSecretEncryptionPort } from "../EnvelopeSecretEncryptionPort";
import { FileSystemSecretEncryptedPayloadStore } from "../FileSystemSecretEncryptedPayloadStore";

function createPort(payloadDirectory: string, keyByte: number): EnvelopeSecretEncryptionPort {
  const keyProvider = new StaticSecretMasterKeyProvider({
    activeKeyId: "kek:server:default",
    activeKeyVersion: "v1",
    keys: [{
      keyId: "kek:server:default",
      keyVersion: "v1",
      algorithm: "aes-256-gcm",
      keyBytes: Buffer.alloc(32, keyByte),
    }],
  });
  return new EnvelopeSecretEncryptionPort(
    new SecretEnvelopeEncryptionService(keyProvider),
    new FileSystemSecretEncryptedPayloadStore(payloadDirectory),
  );
}

describe("EnvelopeSecretEncryptionPort", () => {
  it("stores encrypted envelope payloads and decrypts by secret version material", async () => {
    const root = mkdtempSync(join(tmpdir(), "ai-loom-secret-envelope-port-"));
    const payloadDirectory = join(root, "payloads");
    const port = createPort(payloadDirectory, 17);

    const encrypted = await port.encryptSecretPlaintext({
      secretId: "secret:server:openai",
      owner: { scope: SecretScopes.server },
      plaintext: "sk-live-roundtrip",
    });

    const files = readdirSync(payloadDirectory);
    expect(files.length).toBe(1);
    const payloadContents = readFileSync(join(payloadDirectory, files[0] as string), "utf8");
    expect(payloadContents).not.toContain("sk-live-roundtrip");

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

