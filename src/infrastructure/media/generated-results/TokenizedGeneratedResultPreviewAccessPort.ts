import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type {
  CreateGeneratedResultPreviewAccessDescriptorRequest,
  CreateGeneratedResultPreviewAccessDescriptorResult,
  IGeneratedResultPreviewAccessPort,
  ResolveGeneratedResultPreviewAccessDescriptorRequest,
  ResolveGeneratedResultPreviewAccessDescriptorResult,
} from "@application/generated-results/ports/GeneratedResultPreviewGenerationPorts";
import { GeneratedResultPreviewKinds } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";

const AccessTokenVersionPrefix = "grpreviewv1";

export class TokenizedGeneratedResultPreviewAccessPort implements IGeneratedResultPreviewAccessPort {
  private readonly encryptionKey: Buffer;

  public constructor(secret: string) {
    const normalizedSecret = secret.trim();
    if (!normalizedSecret) {
      throw new Error("TokenizedGeneratedResultPreviewAccessPort requires a non-empty secret.");
    }
    this.encryptionKey = createHash("sha256").update(normalizedSecret, "utf8").digest();
  }

  public createPreviewAccessDescriptor(
    request: CreateGeneratedResultPreviewAccessDescriptorRequest,
  ): CreateGeneratedResultPreviewAccessDescriptorResult {
    const protectedResourceId = this.toProtectedResourceId(request);
    const accessToken = this.encryptAccessPayload(request);
    return Object.freeze({
      protectedResourceId,
      accessHandle: `preview-access://generated-results/${accessToken}`,
    });
  }

  public resolvePreviewAccessDescriptor(
    request: ResolveGeneratedResultPreviewAccessDescriptorRequest,
  ): ResolveGeneratedResultPreviewAccessDescriptorResult | undefined {
    const normalizedHandle = request.accessHandle.trim();
    const prefix = "preview-access://generated-results/";
    if (!normalizedHandle.startsWith(prefix)) {
      return undefined;
    }

    const token = normalizedHandle.slice(prefix.length);
    const parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== AccessTokenVersionPrefix) {
      return undefined;
    }

    const iv = tryDecodeBase64(parts[1]);
    const ciphertext = tryDecodeBase64(parts[2]);
    const authTag = tryDecodeBase64(parts[3]);
    if (!iv || !ciphertext || !authTag || iv.length !== 12 || authTag.length !== 16) {
      return undefined;
    }

    try {
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const payload = JSON.parse(plaintext.toString("utf8")) as {
        readonly version?: number;
        readonly workspaceId?: string;
        readonly resultAssetId?: string;
        readonly derivativeId?: string;
        readonly previewKind?: string;
        readonly storageInstanceId?: string;
        readonly objectKey?: string;
        readonly occurredAt?: string;
      };
      if (
        payload.version !== 1
        || !normalizeRequired(payload.workspaceId)
        || !normalizeRequired(payload.resultAssetId)
        || !normalizeRequired(payload.derivativeId)
        || !normalizeRequired(payload.previewKind)
        || !Object.values(GeneratedResultPreviewKinds).includes(
          payload.previewKind as ResolveGeneratedResultPreviewAccessDescriptorResult["previewKind"],
        )
        || !normalizeRequired(payload.storageInstanceId)
        || !normalizeRequired(payload.objectKey)
        || !normalizeRequired(payload.occurredAt)
      ) {
        return undefined;
      }

      return Object.freeze({
        workspaceId: payload.workspaceId,
        resultAssetId: payload.resultAssetId,
        derivativeId: payload.derivativeId,
        previewKind: payload.previewKind as ResolveGeneratedResultPreviewAccessDescriptorResult["previewKind"],
        storageInstanceId: payload.storageInstanceId,
        objectKey: payload.objectKey,
        occurredAt: payload.occurredAt,
      });
    } catch {
      return undefined;
    }
  }

  private toProtectedResourceId(request: CreateGeneratedResultPreviewAccessDescriptorRequest): string {
    const digest = createHash("sha256")
      .update(`${request.workspaceId}:${request.resultAssetId}:${request.derivativeId}:${request.previewKind}`)
      .digest("hex")
      .slice(0, 24);
    return `protected-resource://gr-preview-${digest}`;
  }

  private encryptAccessPayload(request: CreateGeneratedResultPreviewAccessDescriptorRequest): string {
    const payload = JSON.stringify({
      version: 1,
      workspaceId: request.workspaceId,
      resultAssetId: request.resultAssetId,
      derivativeId: request.derivativeId,
      previewKind: request.previewKind,
      storageInstanceId: request.storageInstanceId,
      objectKey: request.objectKey,
      occurredAt: request.occurredAt,
    });

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(payload, "utf8")), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      AccessTokenVersionPrefix,
      iv.toString("base64url"),
      ciphertext.toString("base64url"),
      authTag.toString("base64url"),
    ].join(".");
  }
}

function tryDecodeBase64(value: string | undefined): Buffer | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return undefined;
  }
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
