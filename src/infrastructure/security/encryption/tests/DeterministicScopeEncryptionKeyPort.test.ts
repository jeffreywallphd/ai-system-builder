import { describe, expect, it } from "bun:test";
import { DeterministicScopeEncryptionKeyPort } from "../DeterministicScopeEncryptionKeyPort";

describe("DeterministicScopeEncryptionKeyPort", () => {
  it("resolves deterministic active keys per scope owner", async () => {
    const port = new DeterministicScopeEncryptionKeyPort({
      encodedKey: Buffer.alloc(32, 3).toString("base64"),
      keyPrefix: "kek:asset-content:test",
    });

    const workspaceKey = await port.resolveActiveKeyForScope({
      scopeOwner: {
        scope: "workspace",
        workspaceId: "workspace-alpha",
      },
    });
    const storageKey = await port.resolveActiveKeyForScope({
      scopeOwner: {
        scope: "storage-instance",
        workspaceId: "workspace-alpha",
        storageInstanceId: "storage-alpha",
      },
    });

    expect(workspaceKey?.keyReferenceId).toBe("kek:asset-content:test:workspace:workspace-alpha:v1");
    expect(storageKey?.keyReferenceId).toBe("kek:asset-content:test:storage-instance:workspace-alpha:storage-alpha:v1");
  });

  it("resolves key material by deterministic key references", async () => {
    const port = new DeterministicScopeEncryptionKeyPort({
      encodedKey: Buffer.alloc(32, 5).toString("base64"),
      keyPrefix: "kek:asset-content:test",
    });

    const material = await port.resolveKeyMaterialByReference({
      keyReferenceId: "kek:asset-content:test:server:v1",
    });
    const missing = await port.resolveKeyMaterialByReference({
      keyReferenceId: "kek:other:server:v1",
    });

    expect(material?.algorithm).toBe("aes-256-gcm");
    expect(material?.keyBytes.byteLength).toBe(32);
    expect(missing).toBeUndefined();
  });
});
