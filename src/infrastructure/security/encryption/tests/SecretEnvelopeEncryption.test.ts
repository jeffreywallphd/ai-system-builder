import { describe, expect, it } from "bun:test";
import { SecretScopes } from "../../../../domain/security/SecretDomain";
import {
  SecretEnvelopeEncryptionError,
  SecretEnvelopeEncryptionService,
  StaticSecretMasterKeyProvider,
  createSecretMasterKeyProviderFromEnvironment,
  parseSecretCiphertextEnvelope,
  serializeSecretCiphertextEnvelope,
} from "../SecretEnvelopeEncryption";

function createProvider(keyByte: number): StaticSecretMasterKeyProvider {
  return new StaticSecretMasterKeyProvider({
    activeKeyId: "kek:server:default",
    keys: [{
      keyId: "kek:server:default",
      algorithm: "aes-256-gcm",
      keyBytes: Buffer.alloc(32, keyByte),
    }],
  });
}

describe("SecretEnvelopeEncryptionService", () => {
  it("round-trips plaintext and produces stable envelope serialization", () => {
    const encryption = new SecretEnvelopeEncryptionService(createProvider(7));
    const encrypted = encryption.encrypt({
      plaintext: "sk-prod-value",
      secretId: "secret:server:openai",
      owner: { scope: SecretScopes.server },
    });

    const parsed = parseSecretCiphertextEnvelope(encrypted.serializedEnvelope);
    const serializedAgain = serializeSecretCiphertextEnvelope(parsed);
    expect(serializedAgain).toBe(encrypted.serializedEnvelope);

    const plaintext = encryption.decrypt({
      serializedEnvelope: encrypted.serializedEnvelope,
      secretId: "secret:server:openai",
      owner: { scope: SecretScopes.server },
      expectedDigestSha256: encrypted.payloadDigestSha256,
    });
    expect(plaintext).toBe("sk-prod-value");
  });

  it("fails decrypt when envelope content is tampered", () => {
    const encryption = new SecretEnvelopeEncryptionService(createProvider(3));
    const encrypted = encryption.encrypt({
      plaintext: "secret-token",
      secretId: "secret:server:test",
      owner: { scope: SecretScopes.server },
    });

    const parsed = parseSecretCiphertextEnvelope(encrypted.serializedEnvelope);
    const ciphertextBytes = Buffer.from(parsed.payload.ciphertextBase64, "base64");
    ciphertextBytes[0] = ciphertextBytes[0] ^ 0x01;
    const tampered = serializeSecretCiphertextEnvelope({
      ...parsed,
      payload: {
        ...parsed.payload,
        ciphertextBase64: ciphertextBytes.toString("base64"),
      },
    });

    expect(() => encryption.decrypt({
      serializedEnvelope: tampered,
      secretId: "secret:server:test",
      owner: { scope: SecretScopes.server },
    })).toThrow(SecretEnvelopeEncryptionError);
  });

  it("fails decrypt when key material is unavailable", () => {
    const encryptor = new SecretEnvelopeEncryptionService(createProvider(11));
    const encrypted = encryptor.encrypt({
      plaintext: "rotatable",
      secretId: "secret:server:rotate",
      owner: { scope: SecretScopes.server },
    });

    const differentProvider = createProvider(22);
    const decryptor = new SecretEnvelopeEncryptionService(differentProvider);
    expect(() => decryptor.decrypt({
      serializedEnvelope: encrypted.serializedEnvelope,
      secretId: "secret:server:rotate",
      owner: { scope: SecretScopes.server },
    })).toThrow("unwrap failed");
  });

  it("fails closed for invalid master key material configuration", () => {
    expect(() => createSecretMasterKeyProviderFromEnvironment({
      AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
      AI_LOOM_SECRET_MASTER_KEY: "not-a-valid-32-byte-key",
    })).toThrow("32 bytes");

    expect(() => new StaticSecretMasterKeyProvider({
      activeKeyId: "kek:server:default",
      keys: [{
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        keyBytes: Buffer.alloc(16, 9),
      }],
    })).toThrow(SecretEnvelopeEncryptionError);
  });
});
