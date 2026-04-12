import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type {
  CreateImageAssetStorageAccessHandleRequest,
  CreateImageAssetStorageAccessHandleResult,
  DeleteImageAssetStorageObjectRequest,
  DeleteImageAssetStorageObjectResult,
  ImageAssetStorageAccessHandleClaims,
  ImageAssetStorageAccessPurpose,
  ImageAssetStorageObjectArea,
  OpenImageAssetStorageObjectReadRequest,
  OpenImageAssetStorageObjectReadResult,
  ReserveImageAssetStorageLocationRequest,
  ReserveImageAssetStorageLocationResult,
  ResolveImageAssetStorageAccessHandleRequest,
  WriteImageAssetStorageObjectRequest,
  WriteImageAssetStorageObjectResult,
  IImageAssetStoragePort,
} from "@application/image-assets/ports/ImageAssetStoragePort";
import {
  ImageAssetStorageAccessPurposes,
  ImageAssetStorageError,
  ImageAssetStorageErrorCodes,
  ImageAssetStorageObjectAreas,
  ImageAssetStorageLifecycleDeleteReasons,
} from "@application/image-assets/ports/ImageAssetStoragePort";
import {
  StorageObjectAccessError,
  StorageObjectErrorCodes,
} from "@application/storage/ports/StorageObjectPort";
import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
  type IStorageLogicalAccessResolutionService,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";

interface SerializedReservationClaims {
  readonly version: 1;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly area: ImageAssetStorageObjectArea;
  readonly expiresAt: string;
}

interface SerializedAccessHandleClaims {
  readonly version: 1;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly purpose: ImageAssetStorageAccessPurpose;
  readonly reference: {
    readonly storageInstanceId: string;
    readonly objectKey: string;
    readonly objectVersionId?: string;
    readonly area: ImageAssetStorageObjectArea;
  };
  readonly expiresAt: string;
}

export interface ManagedImageAssetStorageAdapterDependencies {
  readonly storageLogicalAccessResolutionService: IStorageLogicalAccessResolutionService;
  readonly tokenSecret: string;
  readonly reservationTtlSeconds?: number;
  readonly clock?: {
    now(): Date;
  };
}

const TokenVersionPrefix = "imgastokv1";
const DefaultReservationTtlSeconds = 15 * 60;
const MaxAccessHandleTtlSeconds = 24 * 60 * 60;
const SupportedMediaTypePattern = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

export class ManagedImageAssetStorageAdapter implements IImageAssetStoragePort {
  private readonly clock: { now(): Date };

  private readonly encryptionKey: Buffer;

  private readonly reservationTtlSeconds: number;

  public constructor(private readonly dependencies: ManagedImageAssetStorageAdapterDependencies) {
    const tokenSecret = dependencies.tokenSecret.trim();
    if (!tokenSecret) {
      throw new Error("ManagedImageAssetStorageAdapter requires a non-empty tokenSecret.");
    }

    const reservationTtlSeconds = dependencies.reservationTtlSeconds ?? DefaultReservationTtlSeconds;
    if (!Number.isInteger(reservationTtlSeconds) || reservationTtlSeconds < 1) {
      throw new Error("ManagedImageAssetStorageAdapter reservationTtlSeconds must be an integer >= 1.");
    }

    this.clock = dependencies.clock ?? { now: () => new Date() };
    this.encryptionKey = createHash("sha256").update(tokenSecret, "utf8").digest();
    this.reservationTtlSeconds = reservationTtlSeconds;
  }

  public async reserveStorageLocation(
    request: ReserveImageAssetStorageLocationRequest,
  ): Promise<ReserveImageAssetStorageLocationResult> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    const assetId = normalizeRequired(request.assetId, "assetId");
    const actorUserId = normalizeRequired(request.actorUserId, "actorUserId");
    const storageInstanceId = normalizeRequired(request.storageInstanceId, "storageInstanceId");
    const area = normalizeArea(request.area);
    const mediaType = normalizeOptionalMediaType(request.mediaType);
    const contentDigest = normalizeOptionalDigest(request.contentDigest);
    const occurredAt = normalizeOptionalTimestamp(request.occurredAt) ?? this.clock.now().toISOString();

    const accessPlan = await this.resolvePlan({
      workspaceId,
      actorUserId,
      storageInstanceId,
      occurredAt,
      intent: StorageLogicalAccessOperationIntents.createObjectKey,
    });

    const keyResult = accessPlan.objectPort.createObjectKey({
      storageInstance: accessPlan.storageInstance,
      namespace: "workspaces",
      logicalPathSegments: Object.freeze([
        workspaceId,
        "image-assets",
        assetId,
        area,
      ]),
      originalFileName: normalizeOptionalFileName(request.normalizedFileName)
        ?? fallbackFileNameForMediaType(mediaType),
      contentDigest,
      occurredAt,
    });

    const expiresAt = new Date(new Date(occurredAt).getTime() + (this.reservationTtlSeconds * 1000)).toISOString();
    const reservationId = this.encryptToken({
      version: 1,
      workspaceId,
      assetId,
      actorUserId,
      storageInstanceId,
      objectKey: keyResult.objectKey,
      area,
      expiresAt,
    } satisfies SerializedReservationClaims);

    return Object.freeze({
      reservationId,
      reference: Object.freeze({
        storageInstanceId,
        objectKey: keyResult.objectKey,
        area,
      }),
      expiresAt,
    });
  }

  public async writeObject(request: WriteImageAssetStorageObjectRequest): Promise<WriteImageAssetStorageObjectResult> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    const assetId = normalizeRequired(request.assetId, "assetId");
    const actorUserId = normalizeRequired(request.actorUserId, "actorUserId");
    const reference = normalizeReference(request.reference);
    const expectedSizeBytes = normalizeOptionalSize(request.expectedSizeBytes);
    const expectedChecksumDigest = normalizeOptionalChecksumDigest(request.expectedChecksum?.digest);
    const expectedChecksumAlgorithm = request.expectedChecksum?.algorithm;

    if (expectedChecksumAlgorithm && expectedChecksumAlgorithm !== "sha256") {
      throw this.failure(
        ImageAssetStorageErrorCodes.invalidRequest,
        "expectedChecksum.algorithm must be 'sha256'.",
      );
    }

    if (request.reservationId) {
      const reservation = this.resolveReservationClaims(request.reservationId);
      if (!reservation) {
        throw this.failure(
          ImageAssetStorageErrorCodes.reservationDenied,
          "reservationId is invalid or expired.",
        );
      }
      if (
        reservation.workspaceId !== workspaceId
        || reservation.assetId !== assetId
        || reservation.actorUserId !== actorUserId
        || reservation.storageInstanceId !== reference.storageInstanceId
        || reservation.objectKey !== reference.objectKey
        || reservation.area !== reference.area
      ) {
        throw this.failure(
          ImageAssetStorageErrorCodes.reservationDenied,
          "reservationId does not match the requested write target.",
        );
      }
    }

    const accessPlan = await this.resolvePlan({
      workspaceId,
      actorUserId,
      storageInstanceId: reference.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.writeObject,
    });

    const storageReference = {
      storageInstance: accessPlan.storageInstance,
      objectKey: reference.objectKey,
    } as const;

    try {
      const written = await accessPlan.objectPort.writeObject({
        reference: storageReference,
        content: request.content,
        overwriteExisting: request.overwriteExisting ?? false,
      });

      if (expectedSizeBytes !== undefined && written.sizeBytes !== expectedSizeBytes) {
        await this.deleteBestEffort(accessPlan, reference.objectKey);
        throw this.failure(
          ImageAssetStorageErrorCodes.conflict,
          `Written object size ${String(written.sizeBytes)} does not match expected size ${String(expectedSizeBytes)}.`,
          {
            expectedSizeBytes: String(expectedSizeBytes),
            actualSizeBytes: String(written.sizeBytes),
            storageInstanceId: reference.storageInstanceId,
            objectKey: reference.objectKey,
          },
        );
      }

      if (expectedChecksumDigest && written.checksum.digest !== expectedChecksumDigest) {
        await this.deleteBestEffort(accessPlan, reference.objectKey);
        throw this.failure(
          ImageAssetStorageErrorCodes.conflict,
          "Written object checksum does not match expected checksum.",
          {
            expectedChecksum: expectedChecksumDigest,
            actualChecksum: written.checksum.digest,
            storageInstanceId: reference.storageInstanceId,
            objectKey: reference.objectKey,
          },
        );
      }

      return Object.freeze({
        reference,
        sizeBytes: written.sizeBytes,
        checksum: written.checksum,
        writtenAt: written.writtenAt,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async openReadStream(
    request: OpenImageAssetStorageObjectReadRequest,
  ): Promise<OpenImageAssetStorageObjectReadResult> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    const assetId = normalizeRequired(request.assetId, "assetId");
    const actorUserId = normalizeRequired(request.actorUserId, "actorUserId");
    const reference = normalizeReference(request.reference);
    normalizeAccessPurpose(request.purpose);

    const accessPlan = await this.resolvePlan({
      workspaceId,
      actorUserId,
      storageInstanceId: reference.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.openObjectReadStream,
    });

    const storageReference = {
      storageInstance: accessPlan.storageInstance,
      objectKey: reference.objectKey,
    } as const;

    try {
      const metadata = await accessPlan.objectPort.readObjectMetadata(storageReference);
      const stream = await accessPlan.objectPort.openObjectReadStream(storageReference);
      return Object.freeze({
        reference,
        sizeBytes: metadata.sizeBytes,
        mediaType: inferMediaTypeFromObjectKey(reference.objectKey),
        stream,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  public async createAccessHandle(
    request: CreateImageAssetStorageAccessHandleRequest,
  ): Promise<CreateImageAssetStorageAccessHandleResult> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    const assetId = normalizeRequired(request.assetId, "assetId");
    const actorUserId = normalizeRequired(request.actorUserId, "actorUserId");
    const reference = normalizeReference(request.reference);
    const purpose = normalizeAccessPurpose(request.purpose);
    const expiresInSeconds = normalizeAccessHandleTtl(request.expiresInSeconds);
    const occurredAt = normalizeOptionalTimestamp(request.occurredAt) ?? this.clock.now().toISOString();
    const expiresAt = new Date(new Date(occurredAt).getTime() + (expiresInSeconds * 1000)).toISOString();

    const handleToken = this.encryptToken({
      version: 1,
      workspaceId,
      assetId,
      actorUserId,
      purpose,
      reference: Object.freeze({
        storageInstanceId: reference.storageInstanceId,
        objectKey: reference.objectKey,
        objectVersionId: reference.objectVersionId,
        area: reference.area,
      }),
      expiresAt,
    } satisfies SerializedAccessHandleClaims);

    return Object.freeze({
      handleToken,
      expiresAt,
    });
  }

  public async resolveAccessHandle(
    request: ResolveImageAssetStorageAccessHandleRequest,
  ): Promise<ImageAssetStorageAccessHandleClaims | undefined> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    const assetId = normalizeRequired(request.assetId, "assetId");
    const actorUserId = normalizeRequired(request.actorUserId, "actorUserId");
    const occurredAt = normalizeOptionalTimestamp(request.occurredAt) ?? this.clock.now().toISOString();
    const claims = this.decryptToken<SerializedAccessHandleClaims>(request.handleToken);
    if (!claims || claims.version !== 1) {
      return undefined;
    }
    if (!this.isAccessHandleClaims(claims)) {
      return undefined;
    }
    if (
      claims.workspaceId !== workspaceId
      || claims.assetId !== assetId
      || claims.actorUserId !== actorUserId
    ) {
      return undefined;
    }
    if (new Date(claims.expiresAt).getTime() < new Date(occurredAt).getTime()) {
      return undefined;
    }

    return Object.freeze({
      workspaceId: claims.workspaceId,
      assetId: claims.assetId,
      actorUserId: claims.actorUserId,
      purpose: claims.purpose,
      reference: Object.freeze({
        storageInstanceId: claims.reference.storageInstanceId,
        objectKey: claims.reference.objectKey,
        objectVersionId: claims.reference.objectVersionId,
        area: claims.reference.area,
      }),
      expiresAt: claims.expiresAt,
    });
  }

  public async deleteObject(
    request: DeleteImageAssetStorageObjectRequest,
  ): Promise<DeleteImageAssetStorageObjectResult> {
    const workspaceId = normalizeRequired(request.workspaceId, "workspaceId");
    normalizeRequired(request.assetId, "assetId");
    const actorUserId = normalizeRequired(request.actorUserId, "actorUserId");
    const reference = normalizeReference(request.reference);
    normalizeDeleteReason(request.reason);

    const accessPlan = await this.resolvePlan({
      workspaceId,
      actorUserId,
      storageInstanceId: reference.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.deleteObject,
    });

    try {
      const deleted = await accessPlan.objectPort.deleteObject({
        reference: {
          storageInstance: accessPlan.storageInstance,
          objectKey: reference.objectKey,
        },
      });
      return Object.freeze({
        reference,
        deleted: deleted.deleted,
        deletedAt: deleted.deletedAt,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async resolvePlan(input: {
    readonly workspaceId: string;
    readonly actorUserId: string;
    readonly storageInstanceId: string;
    readonly intent: typeof StorageLogicalAccessOperationIntents[keyof typeof StorageLogicalAccessOperationIntents];
    readonly occurredAt?: string;
  }) {
    const resolved = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
      workspaceId: input.workspaceId,
      actorUserIdentityId: input.actorUserId,
      storageInstanceId: input.storageInstanceId,
      intent: input.intent,
      occurredAt: input.occurredAt,
    });

    if (!resolved.ok) {
      throw this.mapLogicalResolutionError(resolved.error);
    }

    return resolved.value;
  }

  private resolveReservationClaims(reservationId: string): SerializedReservationClaims | undefined {
    const claims = this.decryptToken<SerializedReservationClaims>(reservationId);
    if (!claims || claims.version !== 1) {
      return undefined;
    }

    if (
      !normalizeOptional(claims.workspaceId)
      || !normalizeOptional(claims.assetId)
      || !normalizeOptional(claims.actorUserId)
      || !normalizeOptional(claims.storageInstanceId)
      || !normalizeOptional(claims.objectKey)
    ) {
      return undefined;
    }

    if (!isImageAssetStorageObjectArea(claims.area)) {
      return undefined;
    }

    const expiresAt = new Date(claims.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < this.clock.now().getTime()) {
      return undefined;
    }

    return claims;
  }

  private isAccessHandleClaims(value: SerializedAccessHandleClaims): boolean {
    if (
      !normalizeOptional(value.workspaceId)
      || !normalizeOptional(value.assetId)
      || !normalizeOptional(value.actorUserId)
      || !isImageAssetStorageAccessPurpose(value.purpose)
      || !isImageAssetStorageObjectArea(value.reference.area)
      || !normalizeOptional(value.reference.storageInstanceId)
      || !normalizeOptional(value.reference.objectKey)
    ) {
      return false;
    }

    const expiresAt = new Date(value.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return false;
    }

    return true;
  }

  private encryptToken(payload: SerializedReservationClaims | SerializedAccessHandleClaims): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      TokenVersionPrefix,
      iv.toString("base64url"),
      ciphertext.toString("base64url"),
      authTag.toString("base64url"),
    ].join(".");
  }

  private decryptToken<TValue>(token: string): TValue | undefined {
    const segments = token.trim().split(".");
    if (segments.length !== 4 || segments[0] !== TokenVersionPrefix) {
      return undefined;
    }

    try {
      const iv = Buffer.from(segments[1], "base64url");
      const ciphertext = Buffer.from(segments[2], "base64url");
      const authTag = Buffer.from(segments[3], "base64url");
      if (iv.length !== 12 || authTag.length !== 16) {
        return undefined;
      }

      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(plaintext.toString("utf8")) as TValue;
    } catch {
      return undefined;
    }
  }

  private async deleteBestEffort(
    plan: Awaited<ReturnType<ManagedImageAssetStorageAdapter["resolvePlan"]>>,
    objectKey: string,
  ): Promise<void> {
    try {
      await plan.objectPort.deleteObject({
        reference: {
          storageInstance: plan.storageInstance,
          objectKey,
        },
      });
    } catch {
      // best effort cleanup
    }
  }

  private mapLogicalResolutionError(error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): ImageAssetStorageError {
    switch (error.code) {
      case StorageLogicalAccessResolutionErrorCodes.invalidRequest:
        return this.failure(ImageAssetStorageErrorCodes.invalidRequest, error.message, error.details);
      case StorageLogicalAccessResolutionErrorCodes.notFound:
        return this.failure(ImageAssetStorageErrorCodes.notFound, error.message, error.details);
      case StorageLogicalAccessResolutionErrorCodes.policyViolation:
        return this.failure(ImageAssetStorageErrorCodes.accessDenied, error.message, error.details);
      case StorageLogicalAccessResolutionErrorCodes.capabilityUnsupported:
        return this.failure(ImageAssetStorageErrorCodes.backendUnsupported, error.message, error.details);
      case StorageLogicalAccessResolutionErrorCodes.internal:
      default:
        return this.failure(ImageAssetStorageErrorCodes.ioFailure, error.message, error.details, true);
    }
  }

  private mapError(error: unknown): ImageAssetStorageError {
    if (error instanceof ImageAssetStorageError) {
      return error;
    }

    if (error instanceof StorageObjectAccessError) {
      switch (error.code) {
        case StorageObjectErrorCodes.invalidRequest:
          return this.failure(ImageAssetStorageErrorCodes.invalidRequest, error.message, error.context);
        case StorageObjectErrorCodes.backendUnsupported:
          return this.failure(ImageAssetStorageErrorCodes.backendUnsupported, error.message, error.context);
        case StorageObjectErrorCodes.notFound:
          return this.failure(ImageAssetStorageErrorCodes.notFound, error.message, error.context);
        case StorageObjectErrorCodes.conflict:
          return this.failure(ImageAssetStorageErrorCodes.conflict, error.message, error.context);
        case StorageObjectErrorCodes.sizeLimitExceeded:
          return this.failure(ImageAssetStorageErrorCodes.sizeLimitExceeded, error.message, error.context);
        case StorageObjectErrorCodes.ioFailure:
        default:
          return this.failure(ImageAssetStorageErrorCodes.ioFailure, error.message, error.context, true);
      }
    }

    if (error instanceof Error) {
      return this.failure(ImageAssetStorageErrorCodes.ioFailure, error.message, undefined, true);
    }

    return this.failure(ImageAssetStorageErrorCodes.ioFailure, "Image asset storage operation failed.", undefined, true);
  }

  private failure(
    code: typeof ImageAssetStorageErrorCodes[keyof typeof ImageAssetStorageErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
    retryable = false,
  ): ImageAssetStorageError {
    const context = details ? Object.fromEntries(
      Object.entries(details)
        .filter((entry): entry is [string, unknown] => entry[1] !== undefined && entry[1] !== null)
        .map(([key, value]) => [key, String(value)]),
    ) : undefined;

    return new ImageAssetStorageError(code, message, {
      retryable,
      context: context && Object.keys(context).length > 0 ? Object.freeze(context) : undefined,
    });
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      `${field} is required.`,
    );
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalTimestamp(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "Timestamp must be a valid ISO timestamp.",
    );
  }
  return parsed.toISOString();
}

function normalizeOptionalSize(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "expectedSizeBytes must be an integer >= 0.",
    );
  }
  return value;
}

function normalizeOptionalChecksumDigest(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "expectedChecksum.digest must be a lowercase hexadecimal sha256 digest.",
    );
  }
  return normalized;
}

function normalizeOptionalMediaType(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!SupportedMediaTypePattern.test(normalized)) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "mediaType must be a valid media type.",
    );
  }
  return normalized;
}

function normalizeOptionalDigest(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[a-f0-9]{32,128}$/.test(normalized)) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "contentDigest must be a lowercase hexadecimal digest when provided.",
    );
  }
  return normalized;
}

function normalizeArea(value: ImageAssetStorageObjectArea): ImageAssetStorageObjectArea {
  if (!isImageAssetStorageObjectArea(value)) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      `area '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function normalizeAccessPurpose(value: ImageAssetStorageAccessPurpose): ImageAssetStorageAccessPurpose {
  if (!isImageAssetStorageAccessPurpose(value)) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      `purpose '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function normalizeDeleteReason(reason: DeleteImageAssetStorageObjectRequest["reason"]): void {
  if (!Object.values(ImageAssetStorageLifecycleDeleteReasons).includes(reason)) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      `reason '${String(reason)}' is invalid.`,
    );
  }
}

function normalizeAccessHandleTtl(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MaxAccessHandleTtlSeconds) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      `expiresInSeconds must be an integer between 1 and ${String(MaxAccessHandleTtlSeconds)}.`,
    );
  }
  return value;
}

function normalizeReference(
  reference: WriteImageAssetStorageObjectRequest["reference"]
  | OpenImageAssetStorageObjectReadRequest["reference"]
  | DeleteImageAssetStorageObjectRequest["reference"]
  | CreateImageAssetStorageAccessHandleRequest["reference"],
) {
  return Object.freeze({
    storageInstanceId: normalizeRequired(reference.storageInstanceId, "reference.storageInstanceId"),
    objectKey: normalizeObjectKey(reference.objectKey),
    objectVersionId: normalizeOptional(reference.objectVersionId),
    area: normalizeArea(reference.area),
  });
}

function normalizeObjectKey(value: string): string {
  const normalized = normalizeRequired(value, "reference.objectKey");
  if (normalized.startsWith("/") || normalized.includes("\\") || normalized.includes("..")) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "reference.objectKey must be a logical key and cannot include path traversal syntax.",
    );
  }
  return normalized;
}

function normalizeOptionalFileName(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    throw new ImageAssetStorageError(
      ImageAssetStorageErrorCodes.invalidRequest,
      "normalizedFileName cannot contain path separators or traversal segments.",
    );
  }
  return normalized.length > 255 ? normalized.slice(0, 255) : normalized;
}

function fallbackFileNameForMediaType(mediaType: string | undefined): string {
  switch (mediaType) {
    case "image/png":
      return "image.png";
    case "image/jpeg":
      return "image.jpg";
    case "image/webp":
      return "image.webp";
    case "image/gif":
      return "image.gif";
    case "image/bmp":
      return "image.bmp";
    case "image/tiff":
      return "image.tiff";
    case "image/avif":
      return "image.avif";
    case "image/heic":
      return "image.heic";
    case "image/heif":
      return "image.heif";
    default:
      return "image.bin";
  }
}

function inferMediaTypeFromObjectKey(objectKey: string): string | undefined {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".bmp")) {
    return "image/bmp";
  }
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) {
    return "image/tiff";
  }
  if (lower.endsWith(".avif")) {
    return "image/avif";
  }
  if (lower.endsWith(".heic")) {
    return "image/heic";
  }
  if (lower.endsWith(".heif")) {
    return "image/heif";
  }
  return undefined;
}

function isImageAssetStorageObjectArea(value: unknown): value is ImageAssetStorageObjectArea {
  return typeof value === "string" && Object.values(ImageAssetStorageObjectAreas).includes(value as ImageAssetStorageObjectArea);
}

function isImageAssetStorageAccessPurpose(value: unknown): value is ImageAssetStorageAccessPurpose {
  return typeof value === "string" && Object.values(ImageAssetStorageAccessPurposes).includes(value as ImageAssetStorageAccessPurpose);
}
