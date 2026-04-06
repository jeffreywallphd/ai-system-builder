import { describe, expect, it } from "bun:test";
import { AesGcmAssetContentCipherPort } from "../AesGcmAssetContentCipherPort";
import { DeterministicScopeEncryptionKeyPort } from "../DeterministicScopeEncryptionKeyPort";

describe("AesGcmAssetContentCipherPort", () => {
  it("encrypts and decrypts asset content streams", async () => {
    const keyPort = new DeterministicScopeEncryptionKeyPort({
      encodedKey: Buffer.alloc(32, 11).toString("base64"),
      keyPrefix: "kek:asset-content:test",
    });
    const cipherPort = new AesGcmAssetContentCipherPort({
      keyMaterialPort: keyPort,
    });
    const key = await keyPort.resolveActiveKeyForScope({
      scopeOwner: {
        scope: "workspace",
        workspaceId: "workspace-alpha",
      },
    });
    if (!key) {
      throw new Error("expected key");
    }

    const encryption = await cipherPort.beginEncryption({
      plaintext: (async function* () {
        yield Buffer.from("hello ", "utf8");
        yield Buffer.from("world", "utf8");
      })(),
      aad: "asset-content-encryption/v1;workspace=workspace-alpha",
      key,
      encryptedAt: "2026-04-06T12:00:00.000Z",
    });

    const encryptedChunks: Buffer[] = [];
    for await (const chunk of encryption.ciphertext) {
      encryptedChunks.push(Buffer.from(chunk));
    }
    const encrypted = await encryption.complete();

    const decryptedStream = await cipherPort.beginDecryption({
      ciphertext: (async function* () {
        yield Buffer.concat(encryptedChunks);
      })(),
      descriptor: encrypted.descriptor,
      aad: "asset-content-encryption/v1;workspace=workspace-alpha",
    });
    const decryptedChunks: Buffer[] = [];
    for await (const chunk of decryptedStream) {
      decryptedChunks.push(Buffer.from(chunk));
    }

    expect(Buffer.concat(decryptedChunks).toString("utf8")).toBe("hello world");
    expect(encrypted.plaintextSizeBytes).toBe(11);
    expect(encrypted.plaintextChecksum.digest.length).toBe(64);
    expect(encrypted.descriptor.format).toBe("asset-content/aes-256-gcm/v1");
  });
});
