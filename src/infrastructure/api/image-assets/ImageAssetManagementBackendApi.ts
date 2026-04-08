import { createHmac, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { ImageAssetStorageObjectReference, IImageAssetStoragePort } from "@application/image-assets/ports/ImageAssetStoragePort";
import { isImageAssetStorageError } from "@application/image-assets/ports/ImageAssetStoragePort";
import type { IFinalizeImageAssetUploadUseCase } from "@application/image-assets/use-cases/ImageAssetUploadFinalizationUseCaseContracts";
import { ImageAssetUploadFinalizationErrorCodes } from "@application/image-assets/use-cases/ImageAssetUploadFinalizationUseCaseContracts";
import type { IGetImageAssetOriginalContentUseCase } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCaseContracts";
import { ImageAssetOriginalContentReadErrorCodes } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCaseContracts";
import type { IGetImageAssetMetadataUseCase, IListImageAssetMetadataUseCase } from "@application/image-assets/use-cases/ImageAssetMetadataReadUseCaseContracts";
import { ImageAssetMetadataReadErrorCodes } from "@application/image-assets/use-cases/ImageAssetMetadataReadUseCaseContracts";
import type { IInitiateImageAssetCreationUseCase } from "@application/image-assets/use-cases/ImageAssetCreationUseCaseContracts";
import { ImageAssetCreationErrorCodes } from "@application/image-assets/use-cases/ImageAssetCreationUseCaseContracts";
import type {
  ImageAssetMetadataDetail,
  ImageAssetMetadataSummary,
} from "@application/image-assets/use-cases/ImageAssetMetadataReadUseCaseContracts";
import {
  ImageAssetTransportContractVersions,
  type ImageAssetDetailDto,
  type ImageAssetSummaryDto,
} from "@shared/contracts/assets/ImageAssetTransportContracts";
import {
  ImageAssetManagementApiErrorCodes,
  type CompleteImageAssetUploadApiRequest,
  type CompleteImageAssetUploadApiResponse,
  type CreateImageAssetApiRequest,
  type CreateImageAssetApiResponse,
  type GetImageAssetMetadataApiRequest,
  type GetImageAssetMetadataApiResponse,
  type ImageAssetManagementApiError,
  type ImageAssetManagementApiResponse,
  type IngestImageAssetUploadContentApiRequest,
  type IngestImageAssetUploadContentApiResponse,
  type ListImageAssetMetadataApiRequest,
  type ListImageAssetMetadataApiResponse,
  type OpenImageAssetOriginalContentStreamApiRequest,
  type OpenImageAssetOriginalContentStreamApiResponse,
} from "./sdk/PublicImageAssetManagementApiContract";

interface ImageAssetUploadSessionTokenPayload {
  readonly version: 1;
  readonly reservationId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly storageReference: ImageAssetStorageObjectReference;
  readonly expiresAt?: string;
}

export interface ImageAssetManagementBackendApiDependencies {
  readonly initiateImageAssetCreationUseCase: IInitiateImageAssetCreationUseCase;
  readonly finalizeImageAssetUploadUseCase: IFinalizeImageAssetUploadUseCase;
  readonly getImageAssetMetadataUseCase: IGetImageAssetMetadataUseCase;
  readonly listImageAssetMetadataUseCase: IListImageAssetMetadataUseCase;
  readonly getImageAssetOriginalContentUseCase: IGetImageAssetOriginalContentUseCase;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly uploadSessionTokenSecret: string;
  readonly clock?: {
    now(): Date;
  };
}

const UploadSessionTokenVersion = "img-upload-v1";

export class ImageAssetManagementBackendApi {
  private readonly clock: { now(): Date };

  private readonly uploadSessionTokenSecret: string;

  public constructor(private readonly dependencies: ImageAssetManagementBackendApiDependencies) {
    const secret = dependencies.uploadSessionTokenSecret.trim();
    if (!secret) {
      throw new Error("ImageAssetManagementBackendApi requires uploadSessionTokenSecret.");
    }

    this.uploadSessionTokenSecret = secret;
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async createImageAsset(
    request: CreateImageAssetApiRequest,
  ): Promise<ImageAssetManagementApiResponse<CreateImageAssetApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const operationKey = normalizeOptional(request.operationKey)
      ?? `image-asset:create:${normalizeOptional(request.assetId) ?? "new"}:${randomUUID()}`;
    const outcome = await this.dependencies.initiateImageAssetCreationUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      operationKey,
      assetId: request.assetId,
      ownerUserId: request.ownerUserIdentityId,
      storageInstanceId: request.storageInstanceId,
      visibility: request.visibility,
      sharingPolicy: request.sharingPolicy,
      originKind: request.originKind,
      mediaType: request.mediaType,
      originalFilename: request.originalFilename,
      normalizedFilename: request.normalizedFilename,
      sizeBytes: request.sizeBytes,
      fingerprint: request.fingerprint,
      lineage: request.lineage,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromCreateError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const uploadSessionId = this.createUploadSessionToken({
      version: 1,
      reservationId: outcome.value.upload.reservation.reservationId,
      workspaceId: outcome.value.imageAsset.workspaceId,
      assetId: outcome.value.imageAsset.assetId,
      storageReference: outcome.value.upload.reservation.reference,
      expiresAt: outcome.value.upload.reservation.expiresAt,
    });

    const uploadPath = `/api/v1/image-assets/${encodeURIComponent(outcome.value.imageAsset.assetId)}/uploads/${encodeURIComponent(uploadSessionId)}/content`;

    return {
      ok: true,
      data: Object.freeze({
        asset: toImageAssetDetailDto(outcome.value.imageAsset),
        upload: Object.freeze({
          uploadSessionId,
          uploadEndpoint: uploadPath,
          uploadMethod: "POST",
          expected: Object.freeze({
            fileName: outcome.value.imageAsset.originalFilename,
            mediaType: outcome.value.imageAsset.mediaType,
            sizeBytes: outcome.value.imageAsset.sizeBytes,
          }),
          expiresAt: outcome.value.upload.reservation.expiresAt,
        }),
      }),
    };
  }

  public async ingestImageAssetUploadContent(
    request: IngestImageAssetUploadContentApiRequest,
  ): Promise<ImageAssetManagementApiResponse<IngestImageAssetUploadContentApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const uploadSession = this.resolveUploadSessionToken(request.uploadSessionId);
    if (!uploadSession) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "uploadSessionId is invalid.");
    }

    if (uploadSession.workspaceId !== request.workspaceId || uploadSession.assetId !== request.assetId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "uploadSessionId does not match workspaceId/assetId.");
    }
    if (uploadSession.expiresAt && new Date(uploadSession.expiresAt).getTime() < this.clock.now().getTime()) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidState, "uploadSessionId has expired.");
    }

    try {
      const writeOutcome = await this.dependencies.imageAssetStoragePort.writeObject({
        workspaceId: request.workspaceId,
        assetId: request.assetId,
        actorUserId,
        reservationId: uploadSession.reservationId,
        reference: uploadSession.storageReference,
        content: request.content,
        expectedSizeBytes: request.expectedSizeBytes,
        expectedChecksum: request.expectedChecksumSha256
          ? Object.freeze({
            algorithm: "sha256",
            digest: request.expectedChecksumSha256,
          })
          : undefined,
        overwriteExisting: true,
      });

      return {
        ok: true,
        data: Object.freeze({
          assetId: request.assetId,
          uploadSessionId: request.uploadSessionId,
          sizeBytes: writeOutcome.sizeBytes,
          checksum: writeOutcome.checksum,
          writtenAt: writeOutcome.writtenAt,
        }),
      };
    } catch (error) {
      return this.failedFromStorageError(error);
    }
  }

  public async completeImageAssetUpload(
    request: CompleteImageAssetUploadApiRequest,
  ): Promise<ImageAssetManagementApiResponse<CompleteImageAssetUploadApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const uploadSession = this.resolveUploadSessionToken(request.uploadSessionId);
    if (!uploadSession) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "uploadSessionId is invalid.");
    }

    if (uploadSession.workspaceId !== request.workspaceId || uploadSession.assetId !== request.assetId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "uploadSessionId does not match workspaceId/assetId.");
    }

    const operationKey = normalizeOptional(request.operationKey)
      ?? `image-asset:upload:finalize:${request.assetId}:${randomUUID()}`;
    const outcome = await this.dependencies.finalizeImageAssetUploadUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      operationKey,
      storageReference: uploadSession.storageReference,
      finalizedMediaType: request.finalizedMediaType,
      expectedSizeBytes: request.expectedSizeBytes,
      expectedChecksumSha256: request.expectedChecksumSha256,
      expectedFingerprint: request.expectedFingerprint,
      cleanupOnFailure: request.cleanupOnFailure,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });

    if (!outcome.ok) {
      return this.failedFromFinalizeError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return {
      ok: true,
      data: Object.freeze({
        asset: toImageAssetDetailDto(outcome.value.imageAsset),
        uploadSessionId: request.uploadSessionId,
        finalizedAt: outcome.value.upload.finalizedAt,
      }),
    };
  }

  public async getImageAssetMetadata(
    request: GetImageAssetMetadataApiRequest,
  ): Promise<ImageAssetManagementApiResponse<GetImageAssetMetadataApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const outcome = await this.dependencies.getImageAssetMetadataUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      includeDeleted: request.includeDeleted,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromMetadataReadError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return {
      ok: true,
      data: Object.freeze({
        asset: toImageAssetDetailDto(outcome.value.asset),
      }),
    };
  }

  public async listImageAssetMetadata(
    request: ListImageAssetMetadataApiRequest,
  ): Promise<ImageAssetManagementApiResponse<ListImageAssetMetadataApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const outcome = await this.dependencies.listImageAssetMetadataUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      ownerUserIds: request.ownerUserIdentityIds,
      originKinds: request.originKinds,
      lifecycleStatuses: request.lifecycleStatuses,
      visibilities: request.visibilities,
      mediaTypes: request.mediaTypes,
      storageInstanceIds: request.storageInstanceIds,
      sourceRunIds: request.sourceRunIds,
      generationOperationIds: request.generationOperationIds,
      createdAfter: request.createdAfter,
      createdBefore: request.createdBefore,
      updatedAfter: request.updatedAfter,
      updatedBefore: request.updatedBefore,
      includeDeleted: request.includeDeleted,
      limit: request.limit,
      offset: request.offset,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromMetadataReadError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return {
      ok: true,
      data: Object.freeze({
        items: Object.freeze(outcome.value.items.map((item) => toImageAssetSummaryDto(item))),
        pagination: outcome.value.pagination,
      }),
    };
  }

  public async openImageAssetOriginalContentStream(
    request: OpenImageAssetOriginalContentStreamApiRequest,
  ): Promise<ImageAssetManagementApiResponse<OpenImageAssetOriginalContentStreamApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const outcome = await this.dependencies.getImageAssetOriginalContentUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.failedFromOriginalContentReadError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return {
      ok: true,
      data: Object.freeze({
        assetId: outcome.value.assetId,
        workspaceId: outcome.value.workspaceId,
        mimeType: outcome.value.mediaType,
        sizeBytes: outcome.value.sizeBytes,
        contentDisposition: outcome.value.contentDisposition,
        contentDispositionFileName: outcome.value.contentDispositionFileName,
        stream: outcome.value.stream,
      }),
    };
  }

  private createUploadSessionToken(payload: ImageAssetUploadSessionTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", this.uploadSessionTokenSecret)
      .update(`${UploadSessionTokenVersion}.${encodedPayload}`, "utf8")
      .digest("base64url");
    return `${UploadSessionTokenVersion}.${encodedPayload}.${signature}`;
  }

  private resolveUploadSessionToken(token: string): ImageAssetUploadSessionTokenPayload | undefined {
    const [version, encodedPayload, signature] = token.split(".");
    if (!version || !encodedPayload || !signature || version !== UploadSessionTokenVersion) {
      return undefined;
    }

    const expectedSignature = createHmac("sha256", this.uploadSessionTokenSecret)
      .update(`${version}.${encodedPayload}`, "utf8")
      .digest("base64url");
    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
    if (signatureBuffer.length !== expectedSignatureBuffer.length) {
      return undefined;
    }
    if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
      return undefined;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as ImageAssetUploadSessionTokenPayload;
      if (payload.version !== 1) {
        return undefined;
      }
      if (!normalizeRequired(payload.reservationId) || !normalizeRequired(payload.workspaceId) || !normalizeRequired(payload.assetId)) {
        return undefined;
      }
      if (!payload.storageReference || !normalizeRequired(payload.storageReference.storageInstanceId) || !normalizeRequired(payload.storageReference.objectKey)) {
        return undefined;
      }
      return payload;
    } catch {
      return undefined;
    }
  }

  private failedFromCreateError(
    code: typeof ImageAssetCreationErrorCodes[keyof typeof ImageAssetCreationErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    switch (code) {
      case ImageAssetCreationErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, details);
      case ImageAssetCreationErrorCodes.accessDenied:
      case ImageAssetCreationErrorCodes.policyViolation:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, details);
      case ImageAssetCreationErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, details);
      case ImageAssetCreationErrorCodes.invalidState:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, details);
      case ImageAssetCreationErrorCodes.conflict:
        return this.failed(ImageAssetManagementApiErrorCodes.conflict, message, details);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromFinalizeError(
    code: typeof ImageAssetUploadFinalizationErrorCodes[keyof typeof ImageAssetUploadFinalizationErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    switch (code) {
      case ImageAssetUploadFinalizationErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, details);
      case ImageAssetUploadFinalizationErrorCodes.accessDenied:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, details);
      case ImageAssetUploadFinalizationErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, details);
      case ImageAssetUploadFinalizationErrorCodes.invalidState:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, details);
      case ImageAssetUploadFinalizationErrorCodes.conflict:
        return this.failed(ImageAssetManagementApiErrorCodes.conflict, message, details);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromMetadataReadError(
    code: typeof ImageAssetMetadataReadErrorCodes[keyof typeof ImageAssetMetadataReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    switch (code) {
      case ImageAssetMetadataReadErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, details);
      case ImageAssetMetadataReadErrorCodes.accessDenied:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, details);
      case ImageAssetMetadataReadErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, details);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromOriginalContentReadError(
    code: typeof ImageAssetOriginalContentReadErrorCodes[keyof typeof ImageAssetOriginalContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    switch (code) {
      case ImageAssetOriginalContentReadErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, details);
      case ImageAssetOriginalContentReadErrorCodes.accessDenied:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, details);
      case ImageAssetOriginalContentReadErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, details);
      case ImageAssetOriginalContentReadErrorCodes.invalidState:
      case ImageAssetOriginalContentReadErrorCodes.contentUnavailable:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, details);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, details);
    }
  }

  private failedFromStorageError(error: unknown): ImageAssetManagementApiResponse<never> {
    if (!isImageAssetStorageError(error)) {
      return this.failed(
        ImageAssetManagementApiErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset upload ingestion failed.",
      );
    }

    switch (error.code) {
      case "image-asset-storage-invalid-request":
      case "image-asset-storage-reservation-denied":
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, error.message);
      case "image-asset-storage-access-denied":
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, error.message);
      case "image-asset-storage-not-found":
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, error.message);
      case "image-asset-storage-conflict":
      case "image-asset-storage-size-limit-exceeded":
        return this.failed(ImageAssetManagementApiErrorCodes.conflict, error.message);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, error.message);
    }
  }

  private failed(
    code: ImageAssetManagementApiError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function toImageAssetSummaryDto(summary: ImageAssetMetadataSummary): ImageAssetSummaryDto {
  return Object.freeze({
    contractVersion: ImageAssetTransportContractVersions.v1,
    assetId: summary.assetId,
    originKind: summary.originKind,
    mediaType: summary.mediaType,
    normalizedFilename: summary.normalizedFilename,
    sizeBytes: summary.sizeBytes,
    visibility: summary.visibility,
    ownership: Object.freeze({
      workspaceId: summary.workspaceId,
      ownerUserId: summary.ownerUserId,
      createdBy: "system",
      lastModifiedBy: "system",
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    }),
    storage: Object.freeze({
      storageInstanceId: summary.storage.storageInstanceId,
      storageBindingReference: summary.storage.storageBindingReference,
    }),
    lifecycle: summary.lifecycle,
    preview: Object.freeze({
      available: false,
    }),
  });
}

function toImageAssetDetailDto(detail: ImageAssetMetadataDetail): ImageAssetDetailDto {
  return Object.freeze({
    ...toImageAssetSummaryDto(detail),
    originalFilename: detail.originalFilename,
    fingerprint: detail.fingerprint,
    sharingPolicy: detail.sharingPolicy,
    lineage: detail.lineage,
    ownership: Object.freeze({
      workspaceId: detail.workspaceId,
      ownerUserId: detail.ownerUserId,
      createdBy: detail.createdBy,
      lastModifiedBy: detail.lastModifiedBy,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    }),
  });
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
