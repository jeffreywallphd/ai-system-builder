import { createCipheriv, createHash, randomBytes } from "node:crypto";
import type {
  CreateGeneratedResultPreviewAccessDescriptorRequest,
  CreateGeneratedResultPreviewAccessDescriptorResult,
  IGeneratedResultPreviewAccessPort,
} from "@application/generated-results/ports/GeneratedResultPreviewGenerationPorts";

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
