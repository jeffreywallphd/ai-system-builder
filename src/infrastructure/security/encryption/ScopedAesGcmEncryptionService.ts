import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface ProtectedSecretEncryptionEnvelope {
  readonly version: number;
  readonly algorithm: "aes-256-gcm";
  readonly keyScope: string;
  readonly ivBase64: string;
  readonly ciphertextBase64: string;
  readonly authTagBase64: string;
}

export class ScopedAesGcmEncryptionService {
  private readonly keys = new Map<string, Buffer>();

  public constructor(keysByScope: Readonly<Record<string, string>>) {
    for (const [keyScope, encodedKey] of Object.entries(keysByScope)) {
      const normalizedScope = normalizeRequired(keyScope, "Protected secret keyScope");
      this.keys.set(normalizedScope, decodeAes256Key(encodedKey));
    }

    if (this.keys.size === 0) {
      throw new Error("Protected secret encryption requires at least one key scope.");
    }
  }

  public encrypt(
    plaintext: string,
    input: {
      readonly keyScope: string;
      readonly aad: string;
    },
  ): ProtectedSecretEncryptionEnvelope {
    const normalizedPlaintext = normalizeRequired(plaintext, "Protected secret plaintext");
    const keyScope = normalizeRequired(input.keyScope, "Protected secret keyScope");
    const aad = normalizeRequired(input.aad, "Protected secret aad");
    const key = this.resolveKey(keyScope);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(aad, "utf8"));

    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(normalizedPlaintext, "utf8")),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Object.freeze({
      version: 1,
      algorithm: "aes-256-gcm",
      keyScope,
      ivBase64: iv.toString("base64"),
      ciphertextBase64: ciphertext.toString("base64"),
      authTagBase64: authTag.toString("base64"),
    });
  }

  public decrypt(
    envelope: ProtectedSecretEncryptionEnvelope,
    input: {
      readonly aad: string;
      readonly expectedKeyScope?: string;
    },
  ): string {
    const aad = normalizeRequired(input.aad, "Protected secret aad");
    if (envelope.algorithm !== "aes-256-gcm") {
      throw new Error(`Protected secret envelope algorithm '${envelope.algorithm}' is unsupported.`);
    }
    if (envelope.version !== 1) {
      throw new Error(`Protected secret envelope version '${envelope.version}' is unsupported.`);
    }

    const keyScope = normalizeRequired(envelope.keyScope, "Protected secret envelope keyScope");
    const expectedKeyScope = input.expectedKeyScope?.trim();
    if (expectedKeyScope && expectedKeyScope !== keyScope) {
      throw new Error(
        `Protected secret key scope '${keyScope}' did not match expected key scope '${expectedKeyScope}'.`,
      );
    }

    const key = this.resolveKey(keyScope);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.ivBase64, "base64"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.authTagBase64, "base64"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertextBase64, "base64")),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  }

  private resolveKey(keyScope: string): Buffer {
    const key = this.keys.get(keyScope);
    if (!key) {
      throw new Error(`Protected secret key scope '${keyScope}' is not configured.`);
    }
    return key;
  }
}

function decodeAes256Key(encodedKey: string): Buffer {
  const normalized = normalizeRequired(encodedKey, "Protected secret encoded key");
  const asBase64 = Buffer.from(normalized, "base64");
  if (asBase64.length === 32) {
    return asBase64;
  }

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    const asHex = Buffer.from(normalized, "hex");
    if (asHex.length === 32) {
      return asHex;
    }
  }

  throw new Error("Protected secret encryption key must be 32 bytes (base64 or hex).",
  );
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}
