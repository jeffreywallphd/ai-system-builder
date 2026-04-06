import { describe, expect, it } from "bun:test";
import { EncryptionKeyScopes, ProtectedDataClasses } from "../../../../domain/security/EncryptionAtRestPolicyDomain";
import { ProtectedValueEncryptionErrorCodes } from "../../../../application/security/ports/ProtectedValueEncryptionPorts";
import { StaticEncryptionKeyMaterialPort } from "../StaticEncryptionKeyMaterialPort";
import { VersionedAesGcmProtectedValueEncryptionPort } from "../VersionedAesGcmProtectedValueEncryptionPort";

describe("VersionedAesGcmProtectedValueEncryptionPort", () => {
  it("encrypts and decrypts protected values with versioned descriptors", async () => {
    const port = createPort();
    const encrypted = await port.encrypt({
      plaintext: Buffer.from("super-secret-token", "utf8"),
      aad: "workspace:alpha|secret:openai",
      key: createKey(),
      dataClass: ProtectedDataClasses.secretMaterial,
      metadata: {
        purpose: "secret-material",
      },
    });

    expect(encrypted.ok).toBeTrue();
    if (!encrypted.ok) {
      return;
    }
    expect(encrypted.value.descriptor.keyReferenceId).toBe("key:workspace:alpha:v1");
    expect(encrypted.value.descriptor.workspaceId).toBe("workspace:alpha");
    expect(encrypted.value.descriptor.dataClass).toBe(ProtectedDataClasses.secretMaterial);
    expect(encrypted.value.descriptor.metadata?.purpose).toBe("secret-material");
    expect(encrypted.value.payloadBase64.length).toBeGreaterThan(0);

    const decrypted = await port.decrypt({
      encryptedPayload: encrypted.value,
      aad: "workspace:alpha|secret:openai",
      expectedKeyReferenceId: "key:workspace:alpha:v1",
      expectedKeyScope: EncryptionKeyScopes.workspace,
    });

    expect(decrypted.ok).toBeTrue();
    if (!decrypted.ok) {
      return;
    }
    expect(Buffer.from(decrypted.value.plaintext).toString("utf8")).toBe("super-secret-token");
  });

  it("fails closed when key material is unavailable", async () => {
    const port = new VersionedAesGcmProtectedValueEncryptionPort({
      encryptionKeyMaterialPort: new StaticEncryptionKeyMaterialPort({
        keyMaterials: [],
      }),
    });

    const result = await port.encrypt({
      plaintext: Buffer.from("a"),
      aad: "workspace:alpha|secret:missing",
      key: createKey(),
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: ProtectedValueEncryptionErrorCodes.keyUnavailable,
        message: "Encryption key material for 'key:workspace:alpha:v1' is unavailable.",
        details: undefined,
      },
    });
  });

  it("returns explicit authentication failures for aad mismatches", async () => {
    const port = createPort();
    const encrypted = await port.encrypt({
      plaintext: Buffer.from("rotatable-secret", "utf8"),
      aad: "workspace:alpha|secret:rotation",
      key: createKey(),
    });
    expect(encrypted.ok).toBeTrue();
    if (!encrypted.ok) {
      return;
    }

    const decrypted = await port.decrypt({
      encryptedPayload: encrypted.value,
      aad: "workspace:alpha|secret:wrong",
    });

    expect(decrypted).toEqual({
      ok: false,
      error: {
        code: ProtectedValueEncryptionErrorCodes.authenticationFailed,
        message: "Protected value authentication failed.",
        details: undefined,
      },
    });
  });

  it("returns explicit malformed-payload failures", async () => {
    const port = createPort();
    const decrypted = await port.decrypt({
      encryptedPayload: {
        descriptor: {
          descriptorVersion: "protected-value-payload/v1",
          algorithm: "aes-256-gcm",
          keyReferenceId: "key:workspace:alpha:v1",
          keyId: "key:workspace:alpha",
          keyScope: EncryptionKeyScopes.workspace,
          workspaceId: "workspace:alpha",
          encryptedAt: "2026-04-06T00:00:00.000Z",
        },
        payloadBase64: "bad-base64",
      },
      aad: "workspace:alpha|secret:openai",
    });

    expect(decrypted).toEqual({
      ok: false,
      error: {
        code: ProtectedValueEncryptionErrorCodes.malformedPayload,
        message: "Encrypted payload format is invalid.",
        details: undefined,
      },
    });
  });
});

function createPort() {
  return new VersionedAesGcmProtectedValueEncryptionPort({
    encryptionKeyMaterialPort: new StaticEncryptionKeyMaterialPort({
      keyMaterials: [{
        keyReferenceId: "key:workspace:alpha:v1",
        algorithm: "aes-256-gcm",
        encodedKey: Buffer.alloc(32, 4).toString("base64"),
      }],
    }),
  });
}

function createKey() {
  return {
    keyReferenceId: "key:workspace:alpha:v1",
    keyId: "key:workspace:alpha",
    keyVersion: "v1",
    algorithm: "aes-256-gcm",
    scopeOwner: {
      scope: EncryptionKeyScopes.workspace,
      workspaceId: "workspace:alpha",
    },
    lifecycleState: "active" as const,
    activatedAt: "2026-01-01T00:00:00.000Z",
  };
}
