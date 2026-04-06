import { describe, expect, it } from "bun:test";
import { EncryptionKeyScopes } from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type {
  IEncryptionKeyMaterialPort,
  IProtectedValueEncryptionPort,
  ProtectedValueEncryptionPortResult,
  ProtectedValuePayload,
  DecryptedProtectedValue,
} from "../ports/ProtectedValueEncryptionPorts";
import { ProtectedValuePayloadDescriptorVersions } from "../ports/ProtectedValueEncryptionPorts";

class StubEncryptionKeyMaterialPort implements IEncryptionKeyMaterialPort {
  public async resolveKeyMaterialByReference() {
    return {
      keyReferenceId: "key:workspace:alpha:v1",
      algorithm: "aes-256-gcm",
      keyBytes: Buffer.alloc(32, 7),
    };
  }
}

class StubProtectedValueEncryptionPort implements IProtectedValueEncryptionPort {
  public async encrypt(): Promise<ProtectedValueEncryptionPortResult<ProtectedValuePayload>> {
    return {
      ok: true,
      value: {
        descriptor: {
          descriptorVersion: ProtectedValuePayloadDescriptorVersions.v1,
          algorithm: "aes-256-gcm",
          keyReferenceId: "key:workspace:alpha:v1",
          keyId: "key:workspace:alpha",
          keyVersion: "v1",
          keyScope: EncryptionKeyScopes.workspace,
          workspaceId: "workspace:alpha",
          encryptedAt: "2026-04-06T00:00:00.000Z",
        },
        payloadBase64: "eyJ2ZXJzaW9uIjoxfQ==",
      },
    };
  }

  public async decrypt(): Promise<ProtectedValueEncryptionPortResult<DecryptedProtectedValue>> {
    return {
      ok: true,
      value: {
        plaintext: Buffer.from("hello", "utf8"),
        descriptor: {
          descriptorVersion: ProtectedValuePayloadDescriptorVersions.v1,
          algorithm: "aes-256-gcm",
          keyReferenceId: "key:workspace:alpha:v1",
          keyId: "key:workspace:alpha",
          keyVersion: "v1",
          keyScope: EncryptionKeyScopes.workspace,
          workspaceId: "workspace:alpha",
          encryptedAt: "2026-04-06T00:00:00.000Z",
        },
      },
    };
  }
}

describe("ProtectedValueEncryption ports", () => {
  it("supports encryption and decryption through application-facing contracts", async () => {
    const keyMaterialPort: IEncryptionKeyMaterialPort = new StubEncryptionKeyMaterialPort();
    const keyMaterial = await keyMaterialPort.resolveKeyMaterialByReference({
      keyReferenceId: "key:workspace:alpha:v1",
    });
    expect(keyMaterial?.algorithm).toBe("aes-256-gcm");

    const encryptionPort: IProtectedValueEncryptionPort = new StubProtectedValueEncryptionPort();
    const encrypted = await encryptionPort.encrypt({
      plaintext: Buffer.from("hello", "utf8"),
      aad: "workspace:alpha|secret:api-key",
      key: {
        keyReferenceId: "key:workspace:alpha:v1",
        keyId: "key:workspace:alpha",
        keyVersion: "v1",
        algorithm: "aes-256-gcm",
        scopeOwner: {
          scope: EncryptionKeyScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        lifecycleState: "active",
        activatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(encrypted.ok).toBeTrue();

    const decrypted = await encryptionPort.decrypt({
      encryptedPayload: encrypted.ok
        ? encrypted.value
        : {
          descriptor: {
            descriptorVersion: ProtectedValuePayloadDescriptorVersions.v1,
            algorithm: "aes-256-gcm",
            keyReferenceId: "key:workspace:alpha:v1",
            keyId: "key:workspace:alpha",
            keyScope: EncryptionKeyScopes.workspace,
            workspaceId: "workspace:alpha",
            encryptedAt: "2026-04-06T00:00:00.000Z",
          },
          payloadBase64: "",
        },
      aad: "workspace:alpha|secret:api-key",
      expectedKeyReferenceId: "key:workspace:alpha:v1",
      expectedKeyScope: EncryptionKeyScopes.workspace,
    });

    expect(decrypted.ok).toBeTrue();
    if (!decrypted.ok) {
      return;
    }
    expect(Buffer.from(decrypted.value.plaintext).toString("utf8")).toBe("hello");
  });
});
