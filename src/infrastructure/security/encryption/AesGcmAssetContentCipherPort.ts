import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type {
  AssetContentEncryptionDescriptor,
  BeginAssetContentDecryptionRequest,
  BeginAssetContentEncryptionRequest,
  BeginAssetContentEncryptionResult,
  IAssetContentCipherPort,
} from "../../../application/assets/ports/AssetContentCipherPort";
import { AssetContentCipherFormats } from "../../../application/assets/ports/AssetContentCipherPort";
import type { IEncryptionKeyMaterialPort } from "../../../application/security/ports/ProtectedValueEncryptionPorts";

const SUPPORTED_ALGORITHM = "aes-256-gcm";

export interface AesGcmAssetContentCipherPortDependencies {
  readonly keyMaterialPort: IEncryptionKeyMaterialPort;
}

export class AesGcmAssetContentCipherPort implements IAssetContentCipherPort {
  public constructor(private readonly dependencies: AesGcmAssetContentCipherPortDependencies) {}

  public async beginEncryption(
    request: BeginAssetContentEncryptionRequest,
  ): Promise<BeginAssetContentEncryptionResult> {
    const keyMaterial = await this.dependencies.keyMaterialPort.resolveKeyMaterialByReference({
      keyReferenceId: request.key.keyReferenceId,
    });
    if (!keyMaterial) {
      throw new Error(`Asset content encryption key material '${request.key.keyReferenceId}' is unavailable.`);
    }
    if (keyMaterial.algorithm !== SUPPORTED_ALGORITHM || request.key.algorithm !== SUPPORTED_ALGORITHM) {
      throw new Error(`Asset content encryption algorithm '${request.key.algorithm}' is unsupported.`);
    }

    const encryptedAt = normalizeTimestamp(request.encryptedAt ?? new Date().toISOString(), "encryptedAt");
    const iv = randomBytes(12);
    const cipher = createCipheriv(SUPPORTED_ALGORITHM, Buffer.from(keyMaterial.keyBytes), iv);
    const aad = normalizeRequired(request.aad, "Asset content encryption aad");
    cipher.setAAD(Buffer.from(aad, "utf8"));

    const hasher = createHash("sha256");
    let plaintextSizeBytes = 0;
    let settled = false;
    let completeResolve: ((value: Awaited<ReturnType<BeginAssetContentEncryptionResult["complete"]>>) => void) | undefined;
    let completeReject: ((reason?: unknown) => void) | undefined;
    const completion = new Promise<Awaited<ReturnType<BeginAssetContentEncryptionResult["complete"]>>>((resolve, reject) => {
      completeResolve = resolve;
      completeReject = reject;
    });

    const ciphertext = (async function* stream(): AsyncIterable<Uint8Array> {
      try {
        for await (const chunk of request.plaintext) {
          plaintextSizeBytes += chunk.byteLength;
          hasher.update(chunk);
          const encryptedChunk = cipher.update(chunk);
          if (encryptedChunk.byteLength > 0) {
            yield encryptedChunk;
          }
        }

        const finalChunk = cipher.final();
        if (finalChunk.byteLength > 0) {
          yield finalChunk;
        }

        settled = true;
        completeResolve?.(Object.freeze({
          plaintextSizeBytes,
          plaintextChecksum: Object.freeze({
            algorithm: "sha256" as const,
            digest: hasher.digest("hex"),
          }),
          descriptor: Object.freeze({
            format: AssetContentCipherFormats.aes256GcmV1,
            algorithm: SUPPORTED_ALGORITHM,
            keyReferenceId: request.key.keyReferenceId,
            keyId: request.key.keyId,
            keyVersion: request.key.keyVersion,
            keyScope: request.key.scopeOwner.scope,
            workspaceId: request.key.scopeOwner.workspaceId,
            storageInstanceId: request.key.scopeOwner.storageInstanceId,
            ivBase64: iv.toString("base64"),
            authTagBase64: cipher.getAuthTag().toString("base64"),
            aad,
            encryptedAt,
          } satisfies AssetContentEncryptionDescriptor),
        }));
      } catch (error) {
        settled = true;
        completeReject?.(error);
        throw error;
      }
    })();

    return Object.freeze({
      ciphertext,
      complete: async () => {
        if (!settled) {
          return completion;
        }
        return completion;
      },
    });
  }

  public async beginDecryption(request: BeginAssetContentDecryptionRequest): Promise<AsyncIterable<Uint8Array>> {
    const keyMaterial = await this.dependencies.keyMaterialPort.resolveKeyMaterialByReference({
      keyReferenceId: request.descriptor.keyReferenceId,
    });
    if (!keyMaterial) {
      throw new Error(`Asset content decryption key material '${request.descriptor.keyReferenceId}' is unavailable.`);
    }
    if (keyMaterial.algorithm !== SUPPORTED_ALGORITHM || request.descriptor.algorithm !== SUPPORTED_ALGORITHM) {
      throw new Error(`Asset content decryption algorithm '${request.descriptor.algorithm}' is unsupported.`);
    }

    const aad = normalizeRequired(request.aad, "Asset content decryption aad");
    const decipher = createDecipheriv(
      SUPPORTED_ALGORITHM,
      Buffer.from(keyMaterial.keyBytes),
      Buffer.from(request.descriptor.ivBase64, "base64"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(request.descriptor.authTagBase64, "base64"));

    return (async function* stream(): AsyncIterable<Uint8Array> {
      for await (const chunk of request.ciphertext) {
        const decryptedChunk = decipher.update(chunk);
        if (decryptedChunk.byteLength > 0) {
          yield decryptedChunk;
        }
      }
      const finalChunk = decipher.final();
      if (finalChunk.byteLength > 0) {
        yield finalChunk;
      }
    })();
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeTimestamp(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}
