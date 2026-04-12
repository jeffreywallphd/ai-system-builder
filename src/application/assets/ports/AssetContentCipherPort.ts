import type { EncryptionKeyDescriptor } from "../../security/ports/EncryptionKeyResolutionPorts";

export const AssetContentCipherFormats = Object.freeze({
  aes256GcmV1: "asset-content/aes-256-gcm/v1",
});

export type AssetContentCipherFormat =
  typeof AssetContentCipherFormats[keyof typeof AssetContentCipherFormats];

export interface AssetContentEncryptionDescriptor {
  readonly format: AssetContentCipherFormat;
  readonly algorithm: "aes-256-gcm";
  readonly keyReferenceId: string;
  readonly keyId: string;
  readonly keyVersion?: string;
  readonly keyScope: EncryptionKeyDescriptor["scopeOwner"]["scope"];
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly ivBase64: string;
  readonly authTagBase64: string;
  readonly aad: string;
  readonly encryptedAt: string;
}

export interface BeginAssetContentEncryptionRequest {
  readonly plaintext: AsyncIterable<Uint8Array>;
  readonly aad: string;
  readonly key: EncryptionKeyDescriptor;
  readonly encryptedAt?: string;
}

export interface BeginAssetContentEncryptionResult {
  readonly ciphertext: AsyncIterable<Uint8Array>;
  complete(): Promise<{
    readonly plaintextSizeBytes: number;
    readonly plaintextChecksum: {
      readonly algorithm: "sha256";
      readonly digest: string;
    };
    readonly descriptor: AssetContentEncryptionDescriptor;
  }>;
}

export interface BeginAssetContentDecryptionRequest {
  readonly ciphertext: AsyncIterable<Uint8Array>;
  readonly descriptor: AssetContentEncryptionDescriptor;
  readonly aad: string;
}

export interface IAssetContentCipherPort {
  beginEncryption(
    request: BeginAssetContentEncryptionRequest,
  ): Promise<BeginAssetContentEncryptionResult>;
  beginDecryption(
    request: BeginAssetContentDecryptionRequest,
  ): Promise<AsyncIterable<Uint8Array>>;
}
