import { describe, expect, it } from "bun:test";
import { StaticEncryptionKeyMaterialPort } from "../StaticEncryptionKeyMaterialPort";

describe("StaticEncryptionKeyMaterialPort", () => {
  it("resolves key material by reference from base64 and hex entries", async () => {
    const base64Key = Buffer.alloc(32, 2).toString("base64");
    const hexKey = Buffer.alloc(32, 5).toString("hex");

    const port = new StaticEncryptionKeyMaterialPort({
      keyMaterials: [
        {
          keyReferenceId: "key:server:v1",
          algorithm: "aes-256-gcm",
          encodedKey: base64Key,
        },
        {
          keyReferenceId: "key:server:v2",
          algorithm: "aes-256-gcm",
          encodedKey: hexKey,
        },
      ],
    });

    const first = await port.resolveKeyMaterialByReference({
      keyReferenceId: "key:server:v1",
    });
    const second = await port.resolveKeyMaterialByReference({
      keyReferenceId: "key:server:v2",
    });

    expect(first?.keyBytes.byteLength).toBe(32);
    expect(second?.keyBytes.byteLength).toBe(32);
  });

  it("returns undefined when key material reference is unknown", async () => {
    const port = new StaticEncryptionKeyMaterialPort({
      keyMaterials: [{
        keyReferenceId: "key:workspace:alpha:v1",
        algorithm: "aes-256-gcm",
        encodedKey: Buffer.alloc(32, 7).toString("base64"),
      }],
    });

    const missing = await port.resolveKeyMaterialByReference({
      keyReferenceId: "key:missing",
    });
    expect(missing).toBeUndefined();
  });

  it("fails closed for invalid material definitions", () => {
    expect(() => new StaticEncryptionKeyMaterialPort({
      keyMaterials: [{
        keyReferenceId: "key:server:v1",
        algorithm: "aes-256-gcm",
        encodedKey: "invalid",
      }],
    })).toThrow("32 bytes");

    expect(() => new StaticEncryptionKeyMaterialPort({
      keyMaterials: [
        {
          keyReferenceId: "key:server:v1",
          algorithm: "aes-256-gcm",
          encodedKey: Buffer.alloc(32, 9).toString("base64"),
        },
        {
          keyReferenceId: "key:server:v1",
          algorithm: "aes-256-gcm",
          encodedKey: Buffer.alloc(32, 10).toString("base64"),
        },
      ],
    })).toThrow("Duplicate");
  });
});
