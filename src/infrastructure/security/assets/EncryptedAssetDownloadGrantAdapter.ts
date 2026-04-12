import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type {
  AssetDownloadGrantClaims,
  IAssetDownloadGrantPort,
  IssueAssetDownloadGrantRequest,
  IssueAssetDownloadGrantResult,
  ResolveAssetDownloadGrantRequest,
} from "@application/assets/ports/AssetDownloadGrantPort";
import { AssetDownloadPurposes } from "@application/assets/use-cases/AssetServiceContracts";

interface SerializedGrantClaims {
  readonly version: 1;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetDownloadGrantClaims["area"];
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDispositionFileName?: string;
  readonly purpose: AssetDownloadGrantClaims["purpose"];
  readonly expiresAt: string;
}

export interface EncryptedAssetDownloadGrantAdapterDependencies {
  readonly secret: string;
  readonly clock?: {
    now(): Date;
  };
}

export class EncryptedAssetDownloadGrantAdapter implements IAssetDownloadGrantPort {
  private readonly clock: { now(): Date };

  private readonly encryptionKey: Buffer;

  public constructor(private readonly dependencies: EncryptedAssetDownloadGrantAdapterDependencies) {
    const normalizedSecret = dependencies.secret.trim();
    if (!normalizedSecret) {
      throw new Error("EncryptedAssetDownloadGrantAdapter requires a non-empty secret.");
    }

    this.clock = dependencies.clock ?? { now: () => new Date() };
    this.encryptionKey = createHash("sha256").update(normalizedSecret, "utf8").digest();
  }

  public async issueDownloadGrant(request: IssueAssetDownloadGrantRequest): Promise<IssueAssetDownloadGrantResult> {
    const issuedAt = request.occurredAt ? new Date(request.occurredAt) : this.clock.now();
    const expiresAt = new Date(issuedAt.getTime() + (request.expiresInSeconds * 1000)).toISOString();

    const claims: SerializedGrantClaims = {
      version: 1,
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      assetId: request.assetId,
      versionId: request.versionId,
      storageInstanceId: request.storageInstanceId,
      objectKey: request.objectKey,
      objectVersionId: request.objectVersionId,
      area: request.area,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      contentDispositionFileName: request.contentDispositionFileName,
      purpose: request.purpose,
      expiresAt,
    };

    return Object.freeze({
      contentToken: this.encryptClaims(claims),
      expiresAt,
    });
  }

  public async resolveDownloadGrant(
    request: ResolveAssetDownloadGrantRequest,
  ): Promise<AssetDownloadGrantClaims | undefined> {
    const claims = this.decryptClaims(request.contentToken);
    if (!claims) {
      return undefined;
    }

    if (
      claims.workspaceId !== request.workspaceId
      || claims.actorUserId !== request.actorUserId
      || claims.assetId !== request.assetId
    ) {
      return undefined;
    }

    const now = request.occurredAt ? new Date(request.occurredAt) : this.clock.now();
    if (Number.isNaN(now.getTime())) {
      return undefined;
    }
    const expiresAt = new Date(claims.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
      return undefined;
    }

    if (!Object.values(AssetDownloadPurposes).includes(claims.purpose)) {
      return undefined;
    }
    if (!Number.isInteger(claims.sizeBytes) || claims.sizeBytes < 0) {
      return undefined;
    }

    return Object.freeze({
      workspaceId: claims.workspaceId,
      actorUserId: claims.actorUserId,
      assetId: claims.assetId,
      versionId: claims.versionId,
      storageInstanceId: claims.storageInstanceId,
      objectKey: claims.objectKey,
      objectVersionId: claims.objectVersionId,
      area: claims.area,
      mimeType: claims.mimeType,
      sizeBytes: claims.sizeBytes,
      contentDispositionFileName: claims.contentDispositionFileName,
      purpose: claims.purpose,
      expiresAt: claims.expiresAt,
    });
  }

  private encryptClaims(claims: SerializedGrantClaims): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const plaintext = Buffer.from(JSON.stringify(claims), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      "assetdlv1",
      toBase64Url(iv),
      toBase64Url(ciphertext),
      toBase64Url(authTag),
    ].join(".");
  }

  private decryptClaims(token: string): SerializedGrantClaims | undefined {
    const segments = token.trim().split(".");
    if (segments.length !== 4 || segments[0] !== "assetdlv1") {
      return undefined;
    }

    const iv = fromBase64Url(segments[1]);
    const ciphertext = fromBase64Url(segments[2]);
    const authTag = fromBase64Url(segments[3]);
    if (!iv || !ciphertext || !authTag || iv.length !== 12 || authTag.length !== 16) {
      return undefined;
    }

    try {
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<SerializedGrantClaims>;
      if (parsed.version !== 1) {
        return undefined;
      }
      if (
        typeof parsed.workspaceId !== "string"
        || typeof parsed.actorUserId !== "string"
        || typeof parsed.assetId !== "string"
        || typeof parsed.versionId !== "string"
        || typeof parsed.storageInstanceId !== "string"
        || typeof parsed.objectKey !== "string"
        || typeof parsed.area !== "string"
        || typeof parsed.mimeType !== "string"
        || typeof parsed.sizeBytes !== "number"
        || typeof parsed.purpose !== "string"
        || typeof parsed.expiresAt !== "string"
      ) {
        return undefined;
      }

      return {
        version: 1,
        workspaceId: parsed.workspaceId,
        actorUserId: parsed.actorUserId,
        assetId: parsed.assetId,
        versionId: parsed.versionId,
        storageInstanceId: parsed.storageInstanceId,
        objectKey: parsed.objectKey,
        objectVersionId: typeof parsed.objectVersionId === "string" ? parsed.objectVersionId : undefined,
        area: parsed.area,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
        contentDispositionFileName: typeof parsed.contentDispositionFileName === "string"
          ? parsed.contentDispositionFileName
          : undefined,
        purpose: parsed.purpose as SerializedGrantClaims["purpose"],
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return undefined;
    }
  }
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64Url(value: string | undefined): Buffer | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return undefined;
  }
}


