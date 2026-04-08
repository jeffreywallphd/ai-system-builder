import { createHmac, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { SupportedImageMediaTypes, type SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";
import type { ImageAssetStorageObjectReference, IImageAssetStoragePort } from "@application/image-assets/ports/ImageAssetStoragePort";
import { isImageAssetStorageError } from "@application/image-assets/ports/ImageAssetStoragePort";
import type { IFinalizeImageAssetUploadUseCase } from "@application/image-assets/use-cases/ImageAssetUploadFinalizationUseCaseContracts";
import { ImageAssetUploadFinalizationErrorCodes } from "@application/image-assets/use-cases/ImageAssetUploadFinalizationUseCaseContracts";
import type { IGetImageAssetOriginalContentUseCase } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCaseContracts";
import { ImageAssetOriginalContentReadErrorCodes } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCaseContracts";
import type {
  IOpenImageAssetPreviewContentUseCase,
  IRequestImageAssetPreviewContentUseCase,
} from "@application/image-assets/use-cases/GetImageAssetPreviewContentUseCaseContracts";
import { ImageAssetPreviewContentReadErrorCodes } from "@application/image-assets/use-cases/GetImageAssetPreviewContentUseCaseContracts";
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
  ImageAssetFailureDefaults,
  createImageAssetNormalizedFailure,
  withImageAssetNormalizedFailureDetails,
} from "@application/image-assets/use-cases/ImageAssetFailureNormalization";
import {
  ImageManipulationResilienceDurabilityClasses,
  ImageManipulationResilienceRecoveryKinds,
  ImageManipulationResilienceScopes,
  ImageManipulationResilienceStateKinds,
} from "@shared/contracts/image-workflows/ImageManipulationResilienceStateContracts";
import {
  ImageAssetManagementObservability,
  ImageAssetManagementObservabilityFlows,
  type ImageAssetManagementObservabilityFlow,
} from "./ImageAssetManagementObservability";
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
  type OpenImageAssetPreviewContentStreamApiRequest,
  type OpenImageAssetPreviewContentStreamApiResponse,
  type OpenImageAssetOriginalContentStreamApiRequest,
  type OpenImageAssetOriginalContentStreamApiResponse,
  type RequestImageAssetPreviewApiRequest,
  type RequestImageAssetPreviewApiResponse,
} from "./sdk/PublicImageAssetManagementApiContract";

interface ImageAssetUploadSessionTokenPayload {
  readonly version: 1;
  readonly reservationId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly mediaType: SupportedImageMediaType;
  readonly expectedSizeBytes: number;
  readonly storageReference: ImageAssetStorageObjectReference;
  readonly expiresAt?: string;
}

export interface ImageAssetManagementBackendApiDependencies {
  readonly initiateImageAssetCreationUseCase: IInitiateImageAssetCreationUseCase;
  readonly finalizeImageAssetUploadUseCase: IFinalizeImageAssetUploadUseCase;
  readonly getImageAssetMetadataUseCase: IGetImageAssetMetadataUseCase;
  readonly listImageAssetMetadataUseCase: IListImageAssetMetadataUseCase;
  readonly getImageAssetOriginalContentUseCase: IGetImageAssetOriginalContentUseCase;
  readonly requestImageAssetPreviewContentUseCase: IRequestImageAssetPreviewContentUseCase;
  readonly openImageAssetPreviewContentUseCase: IOpenImageAssetPreviewContentUseCase;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly uploadSessionTokenSecret: string;
  readonly observability?: ImageAssetManagementObservability;
  readonly clock?: {
    now(): Date;
  };
}

const UploadSessionTokenVersion = "img-upload-v1";
const Sha256HexPattern = /^[a-f0-9]{64}$/;

export class ImageAssetManagementBackendApi {
  private readonly clock: { now(): Date };

  private readonly uploadSessionTokenSecret: string;

  private readonly observability: ImageAssetManagementObservability;

  public constructor(private readonly dependencies: ImageAssetManagementBackendApiDependencies) {
    const secret = dependencies.uploadSessionTokenSecret.trim();
    if (!secret) {
      throw new Error("ImageAssetManagementBackendApi requires uploadSessionTokenSecret.");
    }

    this.uploadSessionTokenSecret = secret;
    this.observability = dependencies.observability ?? new ImageAssetManagementObservability();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async createImageAsset(
    request: CreateImageAssetApiRequest,
  ): Promise<ImageAssetManagementApiResponse<CreateImageAssetApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.create,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "creation"),
      );
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
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.create,
        request,
        this.failedFromCreateError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          correlationId: request.correlationId,
          operationKey,
          assetId: request.assetId,
        }),
      );
    }

    const uploadSessionId = this.createUploadSessionToken({
      version: 1,
      reservationId: outcome.value.upload.reservation.reservationId,
      workspaceId: outcome.value.imageAsset.workspaceId,
      assetId: outcome.value.imageAsset.assetId,
      mediaType: outcome.value.imageAsset.mediaType,
      expectedSizeBytes: outcome.value.imageAsset.sizeBytes,
      storageReference: outcome.value.upload.reservation.reference,
      expiresAt: outcome.value.upload.reservation.expiresAt,
    });

    const uploadPath = `/api/v1/image-assets/${encodeURIComponent(outcome.value.imageAsset.assetId)}/uploads/${encodeURIComponent(uploadSessionId)}/content`;

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.create,
      request,
      {
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
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        correlationId: request.correlationId,
        operationKey,
        assetId: outcome.value.imageAsset.assetId,
      }),
      Object.freeze({
        stage: "storage-reservation-issued",
      }),
    );
  }

  public async ingestImageAssetUploadContent(
    request: IngestImageAssetUploadContentApiRequest,
  ): Promise<ImageAssetManagementApiResponse<IngestImageAssetUploadContentApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "upload-ingest"),
      );
    }

    const uploadSession = this.resolveUploadSessionToken(request.uploadSessionId);
    if (!uploadSession) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest("uploadSessionId is invalid.", "upload-session-invalid", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    if (uploadSession.workspaceId !== request.workspaceId || uploadSession.assetId !== request.assetId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest("uploadSessionId does not match workspaceId/assetId.", "upload-session-context-mismatch", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }
    if (uploadSession.expiresAt && new Date(uploadSession.expiresAt).getTime() < this.clock.now().getTime()) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.failed(
          ImageAssetManagementApiErrorCodes.invalidState,
          "uploadSessionId has expired.",
          withImageAssetNormalizedFailureDetails(
            Object.freeze({
              validationCode: "upload-session-expired",
              staleRequest: true,
            }),
            createImageAssetNormalizedFailure({
              layer: ImageAssetFailureDefaults.layer.ingestion,
              kind: ImageAssetFailureDefaults.kind.validation,
              summaryCategory: ImageAssetFailureDefaults.summary.validation,
              reason: "ingest-upload-session-expired",
              userFixable: true,
              resilience: {
                code: "asset-ingestion-session-expired",
                scope: ImageManipulationResilienceScopes.authoritativeState,
                state: ImageManipulationResilienceStateKinds.blocked,
                summary: "Upload session is stale and must be restarted.",
                durability: ImageManipulationResilienceDurabilityClasses.temporary,
                recoveryKind: ImageManipulationResilienceRecoveryKinds.userAction,
                recoveryRetryable: false,
              },
            }),
          ),
        ),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    const normalizedContentType = normalizeMediaType(request.contentType);
    if (!normalizedContentType) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest("contentType is required for image upload ingestion.", "content-type-required", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }
    if (!SupportedImageMediaTypes.includes(normalizedContentType as SupportedImageMediaType)) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest(
          `contentType '${normalizedContentType}' is not supported for image ingestion.`,
          "content-type-unsupported",
          undefined,
          "upload-ingest",
        ),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }
    if (normalizedContentType !== uploadSession.mediaType) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest(
          `contentType '${normalizedContentType}' does not match reserved mediaType '${uploadSession.mediaType}'.`,
          "content-type-mismatch",
          undefined,
          "upload-ingest",
        ),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    const expectedChecksumSha256 = normalizeSha256(request.expectedChecksumSha256);
    if (request.expectedChecksumSha256 !== undefined && !expectedChecksumSha256) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest("expectedChecksumSha256 must be a lowercase hexadecimal sha256 digest.", "expected-checksum-invalid", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    if (request.expectedSizeBytes !== undefined && (!Number.isInteger(request.expectedSizeBytes) || request.expectedSizeBytes < 1)) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.invalidRequest("expectedSizeBytes must be an integer >= 1.", "expected-size-invalid", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    try {
      const writeOutcome = await this.dependencies.imageAssetStoragePort.writeObject({
        workspaceId: request.workspaceId,
        assetId: request.assetId,
        actorUserId,
        reservationId: uploadSession.reservationId,
        reference: uploadSession.storageReference,
        content: request.content,
        expectedSizeBytes: request.expectedSizeBytes ?? uploadSession.expectedSizeBytes,
        expectedChecksum: expectedChecksumSha256
          ? Object.freeze({
            algorithm: "sha256",
            digest: expectedChecksumSha256,
          })
          : undefined,
        overwriteExisting: true,
      });

      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        {
          ok: true,
          data: Object.freeze({
            assetId: request.assetId,
            uploadSessionId: request.uploadSessionId,
            sizeBytes: writeOutcome.sizeBytes,
            checksum: writeOutcome.checksum,
            writtenAt: writeOutcome.writtenAt,
          }),
        },
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    } catch (error) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadIngest,
        request,
        this.failedFromStorageError(error),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }
  }

  public async completeImageAssetUpload(
    request: CompleteImageAssetUploadApiRequest,
  ): Promise<ImageAssetManagementApiResponse<CompleteImageAssetUploadApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadFinalize,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "upload-ingest"),
      );
    }

    const uploadSession = this.resolveUploadSessionToken(request.uploadSessionId);
    if (!uploadSession) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadFinalize,
        request,
        this.invalidRequest("uploadSessionId is invalid.", "upload-session-invalid", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    if (uploadSession.workspaceId !== request.workspaceId || uploadSession.assetId !== request.assetId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadFinalize,
        request,
        this.invalidRequest("uploadSessionId does not match workspaceId/assetId.", "upload-session-context-mismatch", undefined, "upload-ingest"),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }
    if (uploadSession.expiresAt && new Date(uploadSession.expiresAt).getTime() < this.clock.now().getTime()) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadFinalize,
        request,
        this.failed(
          ImageAssetManagementApiErrorCodes.invalidState,
          "uploadSessionId has expired.",
          withImageAssetNormalizedFailureDetails(
            Object.freeze({
              validationCode: "upload-session-expired",
              staleRequest: true,
            }),
            createImageAssetNormalizedFailure({
              layer: ImageAssetFailureDefaults.layer.ingestion,
              kind: ImageAssetFailureDefaults.kind.validation,
              summaryCategory: ImageAssetFailureDefaults.summary.validation,
              reason: "finalize-upload-session-expired",
              userFixable: true,
            }),
          ),
        ),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
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
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.uploadFinalize,
        request,
        this.failedFromFinalizeError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
          operationKey,
        }),
      );
    }

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.uploadFinalize,
      request,
      {
        ok: true,
        data: Object.freeze({
          asset: toImageAssetDetailDto(outcome.value.imageAsset),
          uploadSessionId: request.uploadSessionId,
          finalizedAt: outcome.value.upload.finalizedAt,
        }),
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        assetId: outcome.value.imageAsset.assetId,
        correlationId: request.correlationId,
        operationKey,
      }),
      Object.freeze({
        stage: "upload-finalization",
      }),
    );
  }

  public async getImageAssetMetadata(
    request: GetImageAssetMetadataApiRequest,
  ): Promise<ImageAssetManagementApiResponse<GetImageAssetMetadataApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.metadataGet,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "retrieval"),
      );
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
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.metadataGet,
        request,
        this.failedFromMetadataReadError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.metadataGet,
      request,
      {
        ok: true,
        data: Object.freeze({
          asset: toImageAssetDetailDto(outcome.value.asset),
        }),
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        assetId: outcome.value.asset.assetId,
        correlationId: request.correlationId,
      }),
    );
  }

  public async listImageAssetMetadata(
    request: ListImageAssetMetadataApiRequest,
  ): Promise<ImageAssetManagementApiResponse<ListImageAssetMetadataApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.metadataList,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "retrieval"),
      );
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
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.metadataList,
        request,
        this.failedFromMetadataReadError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          correlationId: request.correlationId,
        }),
      );
    }

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.metadataList,
      request,
      {
        ok: true,
        data: Object.freeze({
          items: Object.freeze(outcome.value.items.map((item) => toImageAssetSummaryDto(item))),
          pagination: outcome.value.pagination,
        }),
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        correlationId: request.correlationId,
      }),
      Object.freeze({
        returned: outcome.value.pagination.returned,
        hasMore: outcome.value.pagination.hasMore,
      }),
    );
  }

  public async openImageAssetOriginalContentStream(
    request: OpenImageAssetOriginalContentStreamApiRequest,
  ): Promise<ImageAssetManagementApiResponse<OpenImageAssetOriginalContentStreamApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.originalOpen,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "retrieval"),
      );
    }

    const outcome = await this.dependencies.getImageAssetOriginalContentUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.originalOpen,
        request,
        this.failedFromOriginalContentReadError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.originalOpen,
      request,
      {
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
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        assetId: request.assetId,
        correlationId: request.correlationId,
      }),
      Object.freeze({
        stage: "retrieval-original-content",
      }),
    );
  }

  public async requestImageAssetPreview(
    request: RequestImageAssetPreviewApiRequest,
  ): Promise<ImageAssetManagementApiResponse<RequestImageAssetPreviewApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.previewRequest,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "retrieval"),
      );
    }

    const outcome = await this.dependencies.requestImageAssetPreviewContentUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      representation: request.representation,
      preferredMediaTypes: request.preferredMediaTypes,
      expiresInSeconds: request.expiresInSeconds,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.previewRequest,
        request,
        this.failedFromPreviewContentReadError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.previewRequest,
      request,
      {
        ok: true,
        data: Object.freeze({
          preview: Object.freeze({
            assetId: outcome.value.assetId,
            workspaceId: outcome.value.workspaceId,
            representation: outcome.value.representation,
            status: outcome.value.status,
            mediaType: outcome.value.mediaType,
            resolvedFrom: outcome.value.resolvedFrom,
            access: outcome.value.access
              ? Object.freeze({
                previewToken: outcome.value.access.previewToken,
                expiresAt: outcome.value.access.expiresAt,
                contentEndpoint: `/api/v1/image-assets/${encodeURIComponent(outcome.value.assetId)}/preview/content`,
              })
              : undefined,
          }),
        }),
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        assetId: outcome.value.assetId,
        correlationId: request.correlationId,
      }),
      Object.freeze({
        availabilityStatus: outcome.value.status,
      }),
    );
  }

  public async openImageAssetPreviewContentStream(
    request: OpenImageAssetPreviewContentStreamApiRequest,
  ): Promise<ImageAssetManagementApiResponse<OpenImageAssetPreviewContentStreamApiResponse>> {
    const actorUserId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserId) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.previewOpen,
        request,
        this.invalidRequest("actorUserIdentityId is required.", "actor-user-identity-required", undefined, "retrieval"),
      );
    }

    const outcome = await this.dependencies.openImageAssetPreviewContentUseCase.execute({
      actorUserId,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      previewToken: request.previewToken,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
    });
    if (!outcome.ok) {
      return this.recordOutcome(
        ImageAssetManagementObservabilityFlows.previewOpen,
        request,
        this.failedFromPreviewContentReadError(outcome.error.code, outcome.error.message, outcome.error.details),
        Object.freeze({
          actorUserIdentityId: actorUserId,
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          correlationId: request.correlationId,
        }),
      );
    }

    return this.recordOutcome(
      ImageAssetManagementObservabilityFlows.previewOpen,
      request,
      {
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
      },
      Object.freeze({
        actorUserIdentityId: actorUserId,
        workspaceId: request.workspaceId,
        assetId: request.assetId,
        correlationId: request.correlationId,
      }),
      Object.freeze({
        stage: "retrieval-preview-content",
      }),
    );
  }

  private async recordOutcome<TRequest, TResponse>(
    flow: ImageAssetManagementObservabilityFlow,
    request: TRequest,
    response: ImageAssetManagementApiResponse<TResponse>,
    trace?: Readonly<{
      readonly actorUserIdentityId?: string;
      readonly workspaceId?: string;
      readonly assetId?: string;
      readonly correlationId?: string;
      readonly operationKey?: string;
    }>,
    diagnostics?: Readonly<Record<string, unknown>>,
  ): Promise<ImageAssetManagementApiResponse<TResponse>> {
    await this.observability.recordApiOutcome({
      flow,
      request,
      response: response as ImageAssetManagementApiResponse<unknown>,
      occurredAt: this.clock.now().toISOString(),
      trace,
      diagnostics,
    });
    return response;
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
      if (!payload.mediaType || !SupportedImageMediaTypes.includes(payload.mediaType)) {
        return undefined;
      }
      if (!Number.isInteger(payload.expectedSizeBytes) || payload.expectedSizeBytes < 1) {
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
    const normalizedDetails = withImageAssetNormalizedFailureDetails(
      details,
      createImageAssetNormalizedFailure({
        layer: ImageAssetFailureDefaults.layer.ingestion,
        kind: code === ImageAssetCreationErrorCodes.invalidRequest
          ? ImageAssetFailureDefaults.kind.validation
          : ImageAssetFailureDefaults.kind.operational,
        summaryCategory: code === ImageAssetCreationErrorCodes.invalidRequest
          ? ImageAssetFailureDefaults.summary.validation
          : code === ImageAssetCreationErrorCodes.internal
            ? ImageAssetFailureDefaults.summary.internal
            : ImageAssetFailureDefaults.summary.unknown,
        reason: code,
        userFixable: code === ImageAssetCreationErrorCodes.invalidRequest,
      }),
    );
    switch (code) {
      case ImageAssetCreationErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, normalizedDetails);
      case ImageAssetCreationErrorCodes.accessDenied:
      case ImageAssetCreationErrorCodes.policyViolation:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, normalizedDetails);
      case ImageAssetCreationErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, normalizedDetails);
      case ImageAssetCreationErrorCodes.invalidState:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, normalizedDetails);
      case ImageAssetCreationErrorCodes.conflict:
        return this.failed(ImageAssetManagementApiErrorCodes.conflict, message, normalizedDetails);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, normalizedDetails);
    }
  }

  private failedFromFinalizeError(
    code: typeof ImageAssetUploadFinalizationErrorCodes[keyof typeof ImageAssetUploadFinalizationErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    const normalizedDetails = details?.imageManipulationFailure
      ? details
      : withImageAssetNormalizedFailureDetails(
        details,
        createImageAssetNormalizedFailure({
          layer: ImageAssetFailureDefaults.layer.ingestion,
          kind: code === ImageAssetUploadFinalizationErrorCodes.invalidRequest
            || code === ImageAssetUploadFinalizationErrorCodes.conflict
            ? ImageAssetFailureDefaults.kind.validation
            : ImageAssetFailureDefaults.kind.operational,
          summaryCategory: code === ImageAssetUploadFinalizationErrorCodes.invalidRequest
            || code === ImageAssetUploadFinalizationErrorCodes.conflict
            ? ImageAssetFailureDefaults.summary.validation
            : code === ImageAssetUploadFinalizationErrorCodes.internal
              ? ImageAssetFailureDefaults.summary.internal
              : ImageAssetFailureDefaults.summary.unknown,
          reason: code,
          userFixable: code === ImageAssetUploadFinalizationErrorCodes.invalidRequest
            || code === ImageAssetUploadFinalizationErrorCodes.conflict,
        }),
      );
    switch (code) {
      case ImageAssetUploadFinalizationErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, normalizedDetails);
      case ImageAssetUploadFinalizationErrorCodes.accessDenied:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, normalizedDetails);
      case ImageAssetUploadFinalizationErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, normalizedDetails);
      case ImageAssetUploadFinalizationErrorCodes.invalidState:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, normalizedDetails);
      case ImageAssetUploadFinalizationErrorCodes.conflict:
        return this.failed(ImageAssetManagementApiErrorCodes.conflict, message, normalizedDetails);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, normalizedDetails);
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
    const normalizedDetails = details?.imageManipulationFailure
      ? details
      : withImageAssetNormalizedFailureDetails(
        details,
        createImageAssetNormalizedFailure({
          layer: ImageAssetFailureDefaults.layer.retrieval,
          kind: code === ImageAssetOriginalContentReadErrorCodes.invalidRequest
            ? ImageAssetFailureDefaults.kind.validation
            : ImageAssetFailureDefaults.kind.operational,
          summaryCategory: code === ImageAssetOriginalContentReadErrorCodes.invalidRequest
            ? ImageAssetFailureDefaults.summary.validation
            : code === ImageAssetOriginalContentReadErrorCodes.internal
              ? ImageAssetFailureDefaults.summary.internal
              : ImageAssetFailureDefaults.summary.unknown,
          reason: code,
          userFixable: code === ImageAssetOriginalContentReadErrorCodes.invalidRequest
            || code === ImageAssetOriginalContentReadErrorCodes.invalidState,
        }),
      );
    switch (code) {
      case ImageAssetOriginalContentReadErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, normalizedDetails);
      case ImageAssetOriginalContentReadErrorCodes.accessDenied:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, normalizedDetails);
      case ImageAssetOriginalContentReadErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, normalizedDetails);
      case ImageAssetOriginalContentReadErrorCodes.invalidState:
      case ImageAssetOriginalContentReadErrorCodes.contentUnavailable:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, normalizedDetails);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, normalizedDetails);
    }
  }

  private failedFromPreviewContentReadError(
    code: typeof ImageAssetPreviewContentReadErrorCodes[keyof typeof ImageAssetPreviewContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetManagementApiResponse<never> {
    const normalizedDetails = details?.imageManipulationFailure
      ? details
      : withImageAssetNormalizedFailureDetails(
        details,
        createImageAssetNormalizedFailure({
          layer: ImageAssetFailureDefaults.layer.preview,
          kind: code === ImageAssetPreviewContentReadErrorCodes.invalidRequest
            || code === ImageAssetPreviewContentReadErrorCodes.invalidState
            ? ImageAssetFailureDefaults.kind.validation
            : ImageAssetFailureDefaults.kind.operational,
          summaryCategory: code === ImageAssetPreviewContentReadErrorCodes.invalidRequest
            || code === ImageAssetPreviewContentReadErrorCodes.invalidState
            ? ImageAssetFailureDefaults.summary.validation
            : code === ImageAssetPreviewContentReadErrorCodes.internal
              ? ImageAssetFailureDefaults.summary.internal
              : ImageAssetFailureDefaults.summary.unknown,
          reason: code,
          userFixable: code === ImageAssetPreviewContentReadErrorCodes.invalidRequest
            || code === ImageAssetPreviewContentReadErrorCodes.invalidState,
        }),
      );
    switch (code) {
      case ImageAssetPreviewContentReadErrorCodes.invalidRequest:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, message, normalizedDetails);
      case ImageAssetPreviewContentReadErrorCodes.accessDenied:
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, message, normalizedDetails);
      case ImageAssetPreviewContentReadErrorCodes.notFound:
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, message, normalizedDetails);
      case ImageAssetPreviewContentReadErrorCodes.invalidState:
      case ImageAssetPreviewContentReadErrorCodes.contentUnavailable:
        return this.failed(ImageAssetManagementApiErrorCodes.invalidState, message, normalizedDetails);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, message, normalizedDetails);
    }
  }

  private failedFromStorageError(error: unknown): ImageAssetManagementApiResponse<never> {
    if (!isImageAssetStorageError(error)) {
      return this.failed(
        ImageAssetManagementApiErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset upload ingestion failed.",
        withImageAssetNormalizedFailureDetails(
          undefined,
          createImageAssetNormalizedFailure({
            layer: ImageAssetFailureDefaults.layer.ingestion,
            kind: ImageAssetFailureDefaults.kind.operational,
            summaryCategory: ImageAssetFailureDefaults.summary.internal,
            reason: "upload-ingestion-internal",
          }),
        ),
      );
    }

    const normalizedDetails = withImageAssetNormalizedFailureDetails(
      undefined,
      createImageAssetNormalizedFailure({
        layer: ImageAssetFailureDefaults.layer.ingestion,
        kind: error.code === "image-asset-storage-invalid-request"
          || error.code === "image-asset-storage-reservation-denied"
          || error.code === "image-asset-storage-conflict"
          || error.code === "image-asset-storage-size-limit-exceeded"
          ? ImageAssetFailureDefaults.kind.validation
          : ImageAssetFailureDefaults.kind.operational,
        summaryCategory: error.code === "image-asset-storage-invalid-request"
          || error.code === "image-asset-storage-reservation-denied"
          || error.code === "image-asset-storage-conflict"
          || error.code === "image-asset-storage-size-limit-exceeded"
          ? ImageAssetFailureDefaults.summary.validation
          : error.code === "image-asset-storage-io-failure"
            ? ImageAssetFailureDefaults.summary.connectivity
            : ImageAssetFailureDefaults.summary.unknown,
        reason: error.code,
        retryable: error.retryable,
        resilience: error.retryable
          ? {
            code: "asset-ingestion-temporarily-unavailable",
            scope: ImageManipulationResilienceScopes.authoritativeState,
            state: ImageManipulationResilienceStateKinds.temporarilyUnavailable,
            summary: "Image ingestion is temporarily unavailable due to storage/backend degradation.",
            durability: ImageManipulationResilienceDurabilityClasses.temporary,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
            recoveryRetryable: true,
            recoveryRetryAfterMs: 3000,
          }
          : undefined,
      }),
    );

    switch (error.code) {
      case "image-asset-storage-invalid-request":
      case "image-asset-storage-reservation-denied":
        return this.failed(ImageAssetManagementApiErrorCodes.invalidRequest, error.message, normalizedDetails);
      case "image-asset-storage-access-denied":
        return this.failed(ImageAssetManagementApiErrorCodes.forbidden, error.message, normalizedDetails);
      case "image-asset-storage-not-found":
        return this.failed(ImageAssetManagementApiErrorCodes.notFound, error.message, normalizedDetails);
      case "image-asset-storage-conflict":
      case "image-asset-storage-size-limit-exceeded":
        return this.failed(ImageAssetManagementApiErrorCodes.conflict, error.message, normalizedDetails);
      default:
        return this.failed(ImageAssetManagementApiErrorCodes.internal, error.message, normalizedDetails);
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

  private invalidRequest(
    message: string,
    validationCode: string,
    details?: Readonly<Record<string, unknown>>,
    context: "upload-ingest" | "retrieval" | "creation" = "upload-ingest",
  ): ImageAssetManagementApiResponse<never> {
    const layer = context === "retrieval"
      ? ImageAssetFailureDefaults.layer.retrieval
      : ImageAssetFailureDefaults.layer.ingestion;
    const reasonPrefix = context === "creation"
      ? "create"
      : context === "retrieval"
        ? "retrieval"
        : "ingest";
    return this.failed(
      ImageAssetManagementApiErrorCodes.invalidRequest,
      message,
      withImageAssetNormalizedFailureDetails(
        Object.freeze({
          validationCode,
          ...(details ?? {}),
        }),
        createImageAssetNormalizedFailure({
          layer,
          kind: ImageAssetFailureDefaults.kind.validation,
          summaryCategory: ImageAssetFailureDefaults.summary.validation,
          reason: `${reasonPrefix}-${validationCode}`,
          userFixable: true,
        }),
      ),
    );
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

function normalizeMediaType(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const [mediaType] = normalized.split(";");
  return mediaType?.trim() || undefined;
}

function normalizeSha256(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return Sha256HexPattern.test(normalized) ? normalized : undefined;
}
