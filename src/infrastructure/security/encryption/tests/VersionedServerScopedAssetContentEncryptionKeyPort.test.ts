import { describe, expect, it } from "bun:test";
import type {
  ResolveServerSigningMaterialInput,
  ResolvedSecurityMaterialCredential,
} from "@application/security/ports/SecurityMaterialResolutionPorts";
import type { SecretServiceResult } from "@application/security/use-cases/SecretManagementServiceContracts";
import { AesGcmAssetContentCipherPort } from "../AesGcmAssetContentCipherPort";
import { VersionedServerScopedAssetContentEncryptionKeyPort } from "../VersionedServerScopedAssetContentEncryptionKeyPort";

class StubRuntimeSecurityMaterialResolver {
  public readonly requests: ResolveServerSigningMaterialInput[] = [];
  private activeVersionId: string;
  private readonly credentialsByVersionId = new Map<string, string>();

  public constructor(input: {
    readonly activeVersionId: string;
    readonly credentialsByVersionId: Readonly<Record<string, string>>;
  }) {
    this.activeVersionId = input.activeVersionId;
    for (const [versionId, credential] of Object.entries(input.credentialsByVersionId)) {
      this.credentialsByVersionId.set(versionId, credential);
    }
  }

  public setActiveVersion(versionId: string): void {
    this.activeVersionId = versionId;
  }

  public async resolveServerSigningMaterial(
    input: ResolveServerSigningMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
    this.requests.push(input);

    const requestedVersionId = input.versionId?.trim();
    if (requestedVersionId) {
      const requestedCredential = this.credentialsByVersionId.get(requestedVersionId);
      if (!requestedCredential) {
        return {
          ok: false,
          error: {
            code: "secret-not-found",
            message: "requested secret version not found",
          },
        };
      }
      if (!input.allowSupersededVersion && requestedVersionId !== this.activeVersionId) {
        return {
          ok: false,
          error: {
            code: "secret-not-found",
            message: "superseded secret version is not allowed",
          },
        };
      }
      return {
        ok: true,
        value: Object.freeze({
          secretId: input.secretId,
          currentVersionId: this.activeVersionId,
          credential: requestedCredential,
        }),
      };
    }

    const activeCredential = this.credentialsByVersionId.get(this.activeVersionId);
    if (!activeCredential) {
      return {
        ok: false,
        error: {
          code: "secret-not-found",
          message: "active secret version not found",
        },
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        secretId: input.secretId,
        currentVersionId: this.activeVersionId,
        credential: activeCredential,
      }),
    };
  }
}

describe("VersionedServerScopedAssetContentEncryptionKeyPort", () => {
  it("uses active secret version for new writes and keeps prior encrypted content decryptable after rollover", async () => {
    const resolver = new StubRuntimeSecurityMaterialResolver({
      activeVersionId: "secret:server:asset-content-encryption-key:v1",
      credentialsByVersionId: {
        "secret:server:asset-content-encryption-key:v1": Buffer.alloc(32, 3).toString("base64"),
        "secret:server:asset-content-encryption-key:v2": Buffer.alloc(32, 7).toString("base64"),
      },
    });
    const keyPort = new VersionedServerScopedAssetContentEncryptionKeyPort({
      runtimeSecurityMaterialResolver: resolver,
      secretId: "secret:server:asset-content-encryption-key",
      keyPrefix: "kek:asset-content:test",
      now: () => new Date("2026-04-12T12:00:00.000Z"),
    });
    const cipherPort = new AesGcmAssetContentCipherPort({
      keyMaterialPort: keyPort,
    });

    const firstKey = await keyPort.resolveActiveKeyForScope({
      scopeOwner: Object.freeze({
        scope: "storage-instance",
        workspaceId: "workspace-alpha",
        storageInstanceId: "storage-alpha",
      }),
    });
    if (!firstKey) {
      throw new Error("expected first key");
    }
    const firstEncryption = await cipherPort.beginEncryption({
      plaintext: (async function* content() {
        yield Buffer.from("encrypted-with-v1", "utf8");
      })(),
      aad: "asset-content-encryption/v1;workspace=workspace-alpha;storage=storage-alpha",
      key: firstKey,
      encryptedAt: "2026-04-12T12:00:00.000Z",
    });
    const firstCiphertextChunks: Buffer[] = [];
    for await (const chunk of firstEncryption.ciphertext) {
      firstCiphertextChunks.push(Buffer.from(chunk));
    }
    const firstEncrypted = await firstEncryption.complete();

    resolver.setActiveVersion("secret:server:asset-content-encryption-key:v2");

    const secondKey = await keyPort.resolveActiveKeyForScope({
      scopeOwner: Object.freeze({
        scope: "storage-instance",
        workspaceId: "workspace-alpha",
        storageInstanceId: "storage-alpha",
      }),
    });
    if (!secondKey) {
      throw new Error("expected second key");
    }
    const secondEncryption = await cipherPort.beginEncryption({
      plaintext: (async function* content() {
        yield Buffer.from("encrypted-with-v2", "utf8");
      })(),
      aad: "asset-content-encryption/v1;workspace=workspace-alpha;storage=storage-alpha",
      key: secondKey,
      encryptedAt: "2026-04-12T12:01:00.000Z",
    });
    const secondCiphertextChunks: Buffer[] = [];
    for await (const chunk of secondEncryption.ciphertext) {
      secondCiphertextChunks.push(Buffer.from(chunk));
    }
    const secondEncrypted = await secondEncryption.complete();

    const decryptedFirstStream = await cipherPort.beginDecryption({
      ciphertext: (async function* content() {
        yield Buffer.concat(firstCiphertextChunks);
      })(),
      descriptor: firstEncrypted.descriptor,
      aad: "asset-content-encryption/v1;workspace=workspace-alpha;storage=storage-alpha",
    });
    const decryptedFirstChunks: Buffer[] = [];
    for await (const chunk of decryptedFirstStream) {
      decryptedFirstChunks.push(Buffer.from(chunk));
    }

    const decryptedSecondStream = await cipherPort.beginDecryption({
      ciphertext: (async function* content() {
        yield Buffer.concat(secondCiphertextChunks);
      })(),
      descriptor: secondEncrypted.descriptor,
      aad: "asset-content-encryption/v1;workspace=workspace-alpha;storage=storage-alpha",
    });
    const decryptedSecondChunks: Buffer[] = [];
    for await (const chunk of decryptedSecondStream) {
      decryptedSecondChunks.push(Buffer.from(chunk));
    }

    expect(firstKey.keyVersion).toBe("secret:server:asset-content-encryption-key:v1");
    expect(secondKey.keyVersion).toBe("secret:server:asset-content-encryption-key:v2");
    expect(firstEncrypted.descriptor.keyReferenceId).not.toBe(secondEncrypted.descriptor.keyReferenceId);
    expect(Buffer.concat(decryptedFirstChunks).toString("utf8")).toBe("encrypted-with-v1");
    expect(Buffer.concat(decryptedSecondChunks).toString("utf8")).toBe("encrypted-with-v2");

    const supersededResolutionRequest = resolver.requests.find((request) =>
      request.versionId === "secret:server:asset-content-encryption-key:v1"
      && request.allowSupersededVersion === true,
    );
    expect(supersededResolutionRequest).toBeDefined();
  });

  it("maps legacy deterministic references to a versioned secret for backward compatibility", async () => {
    const resolver = new StubRuntimeSecurityMaterialResolver({
      activeVersionId: "secret:server:asset-content-encryption-key:v2",
      credentialsByVersionId: {
        "secret:server:asset-content-encryption-key:v1": Buffer.alloc(32, 9).toString("base64"),
        "secret:server:asset-content-encryption-key:v2": Buffer.alloc(32, 5).toString("base64"),
      },
    });
    const keyPort = new VersionedServerScopedAssetContentEncryptionKeyPort({
      runtimeSecurityMaterialResolver: resolver,
      secretId: "secret:server:asset-content-encryption-key",
      keyPrefix: "kek:asset-content:test",
      legacyDeterministicVersionId: "secret:server:asset-content-encryption-key:v1",
    });

    const descriptor = await keyPort.resolveKeyByReference({
      keyReferenceId: "kek:asset-content:test:workspace:workspace-alpha:v1",
    });
    const material = await keyPort.resolveKeyMaterialByReference({
      keyReferenceId: "kek:asset-content:test:workspace:workspace-alpha:v1",
    });

    expect(descriptor?.keyVersion).toBe("secret:server:asset-content-encryption-key:v1");
    expect(descriptor?.lifecycleState).toBe("retiring");
    expect(material?.keyBytes.byteLength).toBe(32);
  });

  it("returns undefined for unknown key references", async () => {
    const resolver = new StubRuntimeSecurityMaterialResolver({
      activeVersionId: "secret:server:asset-content-encryption-key:v1",
      credentialsByVersionId: {
        "secret:server:asset-content-encryption-key:v1": Buffer.alloc(32, 1).toString("base64"),
      },
    });
    const keyPort = new VersionedServerScopedAssetContentEncryptionKeyPort({
      runtimeSecurityMaterialResolver: resolver,
      secretId: "secret:server:asset-content-encryption-key",
      keyPrefix: "kek:asset-content:test",
      fallbackEncodedKey: Buffer.alloc(32, 2).toString("base64"),
    });

    const missingDescriptor = await keyPort.resolveKeyByReference({
      keyReferenceId: "kek:other-prefix:server:v1",
    });
    const missingMaterial = await keyPort.resolveKeyMaterialByReference({
      keyReferenceId: "kek:other-prefix:server:v1",
    });

    expect(missingDescriptor).toBeUndefined();
    expect(missingMaterial).toBeUndefined();
  });

  it("supports deterministic fallback material when provider-backed secret is unavailable", async () => {
    const resolver = new StubRuntimeSecurityMaterialResolver({
      activeVersionId: "secret:server:asset-content-encryption-key:v1",
      credentialsByVersionId: {},
    });
    const keyPort = new VersionedServerScopedAssetContentEncryptionKeyPort({
      runtimeSecurityMaterialResolver: resolver,
      secretId: "secret:server:asset-content-encryption-key",
      keyPrefix: "kek:asset-content:test",
      fallbackEncodedKey: Buffer.alloc(32, 8).toString("base64"),
      fallbackVersionId: "secret:server:asset-content-encryption-key:fallback",
    });

    const descriptor = await keyPort.resolveActiveKeyForScope({
      scopeOwner: Object.freeze({
        scope: "server",
      }),
    });
    if (!descriptor) {
      throw new Error("expected fallback descriptor");
    }

    const material = await keyPort.resolveKeyMaterialByReference({
      keyReferenceId: descriptor.keyReferenceId,
    });

    expect(descriptor.keyVersion).toBe("secret:server:asset-content-encryption-key:fallback");
    expect(material?.keyBytes.byteLength).toBe(32);
  });
});
