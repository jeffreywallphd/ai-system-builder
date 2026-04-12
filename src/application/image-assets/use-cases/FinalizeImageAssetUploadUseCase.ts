import { createHash } from "node:crypto";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import {
  ImageAssetDomainError,
  ImageAssetFingerprintAlgorithms,
  ImageAssetStatuses,
  rehydrateImageAsset,
  transitionImageAssetStatus,
  type ImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IImageAssetRepository } from "../ports/IImageAssetRepository";
import {
  ImageAssetAuditEventTypes,
  ImageAssetAuditOutcomes,
  publishImageAssetAuditEventBestEffort,
  type ImageAssetAuditSink,
} from "../ports/ImageAssetAuditPort";
import {
  ImageAssetStorageAccessPurposes,
  ImageAssetStorageErrorCodes,
  ImageAssetStorageLifecycleDeleteReasons,
  isImageAssetStorageError,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import {
  ImageAssetUploadFinalizationErrorCodes,
  validateFinalizeImageAssetUploadRequest,
  type FinalizeImageAssetUploadRequest,
  type FinalizeImageAssetUploadSuccess,
  type IFinalizeImageAssetUploadUseCase,
  type ImageAssetUploadFinalizationResult,
} from "./ImageAssetUploadFinalizationUseCaseContracts";
import {
  ImageAssetFailureDefaults,
  createImageAssetNormalizedFailure,
  withImageAssetNormalizedFailureDetails,
} from "./ImageAssetFailureNormalization";
import {
  ImageManipulationResilienceDurabilityClasses,
  ImageManipulationResilienceRecoveryKinds,
  ImageManipulationResilienceScopes,
  ImageManipulationResilienceStateKinds,
} from "@shared/contracts/image-workflows/ImageManipulationResilienceStateContracts";

export interface FinalizeImageAssetUploadUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly auditSink?: ImageAssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

interface UploadedContentObservation {
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly checksumSha512: string;
  readonly detectedMediaType?: string;
}

export class FinalizeImageAssetUploadUseCase implements IFinalizeImageAssetUploadUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: FinalizeImageAssetUploadUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: FinalizeImageAssetUploadRequest,
  ): Promise<ImageAssetUploadFinalizationResult<FinalizeImageAssetUploadSuccess>> {
    let request: FinalizeImageAssetUploadRequest;
    try {
      request = validateFinalizeImageAssetUploadRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset upload finalization request.",
        undefined,
        {
          reason: "upload-finalization-request-invalid",
          userFixable: true,
        },
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const authorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!authorization.isAuthorized) {
      await this.publishFinalizationAuditEvent({
        request,
        occurredAt,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "workspace-membership-required",
      });
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.accessDenied,
        "Image asset upload finalization requires active workspace membership.",
        undefined,
        {
          reason: "workspace-membership-required",
          summaryCategory: ImageAssetFailureDefaults.summary.unknown,
          kind: ImageAssetFailureDefaults.kind.operational,
        },
      );
    }

    const existing = await this.dependencies.imageAssetRepository.findImageAssetById(request.assetId, {
      includeDeleted: true,
    });
    if (!existing || existing.workspaceId !== request.workspaceId) {
      await this.publishFinalizationAuditEvent({
        request,
        occurredAt,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: ImageAssetUploadFinalizationErrorCodes.notFound,
      });
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.notFound,
        "Image asset was not found for the workspace.",
        undefined,
        {
          reason: "asset-not-found",
          summaryCategory: ImageAssetFailureDefaults.summary.unknown,
          kind: ImageAssetFailureDefaults.kind.operational,
        },
      );
    }

    if (existing.storageInstanceId !== request.storageReference.storageInstanceId) {
      await this.publishFinalizationAuditEvent({
        request,
        occurredAt,
        imageAsset: existing,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "storage-instance-mismatch",
      });
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.invalidRequest,
        "storageReference.storageInstanceId does not match image asset storageInstanceId.",
        undefined,
        {
          reason: "storage-reference-mismatch",
          userFixable: true,
        },
      );
    }

    if (existing.lifecycle.status !== ImageAssetStatuses.ingesting) {
      await this.publishFinalizationAuditEvent({
        request,
        occurredAt,
        imageAsset: existing,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: ImageAssetUploadFinalizationErrorCodes.invalidState,
      });
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.invalidState,
        `Image asset '${existing.assetId}' is '${existing.lifecycle.status}' and cannot be finalized from upload pending state.`,
        undefined,
        {
          reason: "asset-not-ingesting",
          summaryCategory: ImageAssetFailureDefaults.summary.output,
          kind: ImageAssetFailureDefaults.kind.operational,
        },
      );
    }

    try {
      const observed = await this.observeUploadedContent(request, existing.mediaType);
      this.assertContentConsistency(request, existing, observed);

      const normalizedFingerprint = this.resolveNormalizedFingerprint(request, existing, observed);
      const normalizedMediaType = request.finalizedMediaType ?? existing.mediaType;
      this.assertDetectedMediaType(normalizedMediaType, observed.detectedMediaType);
      const normalized = rehydrateImageAsset({
        ...existing,
        mediaType: normalizedMediaType,
        sizeBytes: observed.sizeBytes,
        fingerprint: normalizedFingerprint,
        lastModifiedBy: request.actorUserId,
        updatedAt: occurredAt,
      });

      const available = transitionImageAssetStatus(normalized, {
        nextStatus: ImageAssetStatuses.available,
        actorUserId: request.actorUserId,
        occurredAt,
      });

      const saved = await this.dependencies.imageAssetRepository.saveImageAsset(available, {
        operationKey: request.operationKey,
        actorUserId: request.actorUserId,
        occurredAt,
        correlationId: request.correlationId,
      });
      await this.dependencies.imageAssetRepository.setImageAssetOriginalObjectReference(
        saved.imageAsset.assetId,
        {
          storageInstanceId: request.storageReference.storageInstanceId,
          objectKey: request.storageReference.objectKey,
          objectVersionId: request.storageReference.objectVersionId,
        },
      );
      await this.publishFinalizationAuditEvent({
        request,
        occurredAt,
        imageAsset: saved.imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          storageInstanceId: request.storageReference.storageInstanceId,
          finalizedSizeBytes: observed.sizeBytes,
          fingerprintAlgorithm: saved.imageAsset.fingerprint.algorithm,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          imageAsset: saved.imageAsset,
          upload: Object.freeze({
            status: "finalized" as const,
            reference: request.storageReference,
            finalizedAt: occurredAt,
            observedSizeBytes: observed.sizeBytes,
            observedChecksumSha256: observed.checksumSha256,
          }),
        }),
      };
    } catch (error) {
      const failureReason = mapFailureReason(error);
      const cleanup = await this.failWithCleanup(existing, request, occurredAt, failureReason);
      const code = mapFailureCode(error);
      await this.publishFinalizationAuditEvent({
        request,
        occurredAt,
        imageAsset: existing,
        outcome: code === ImageAssetUploadFinalizationErrorCodes.internal
          ? ImageAssetAuditOutcomes.failed
          : ImageAssetAuditOutcomes.rejected,
        reasonCode: failureReason,
        details: cleanup,
      });

      return this.failure(
        code,
        error instanceof Error ? error.message : "Image asset upload finalization failed.",
        cleanup,
        {
          reason: failureReason,
          kind: code === ImageAssetUploadFinalizationErrorCodes.invalidRequest || code === ImageAssetUploadFinalizationErrorCodes.conflict
            ? ImageAssetFailureDefaults.kind.validation
            : ImageAssetFailureDefaults.kind.operational,
          summaryCategory: code === ImageAssetUploadFinalizationErrorCodes.conflict
            ? ImageAssetFailureDefaults.summary.validation
            : code === ImageAssetUploadFinalizationErrorCodes.internal
              ? ImageAssetFailureDefaults.summary.internal
              : ImageAssetFailureDefaults.summary.unknown,
          userFixable: code === ImageAssetUploadFinalizationErrorCodes.invalidRequest || code === ImageAssetUploadFinalizationErrorCodes.conflict,
          retryable: isImageAssetStorageError(error) && error.retryable,
          resilience: code === ImageAssetUploadFinalizationErrorCodes.internal
            ? {
              code: "asset-ingestion-finalization-degraded",
              scope: ImageManipulationResilienceScopes.authoritativeState,
              state: ImageManipulationResilienceStateKinds.degraded,
              summary: "Image ingestion finalization degraded due to storage or backend failure.",
              durability: ImageManipulationResilienceDurabilityClasses.unknown,
              recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
              recoveryRetryable: isImageAssetStorageError(error) ? error.retryable : false,
              recoveryRetryAfterMs: 3000,
            }
            : undefined,
        },
      );
    }
  }

  private async resolveWorkspaceAuthorization(
    workspaceId: string,
    actorUserIdentityId: string,
    occurredAt?: string,
  ): Promise<{ readonly isAuthorized: boolean; readonly isWorkspaceAdmin: boolean }> {
    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: occurredAt,
    });
    if (!snapshot) {
      return Object.freeze({ isAuthorized: false, isWorkspaceAdmin: false });
    }

    const isActiveMember = snapshot.isWorkspaceOwner
      || snapshot.membership?.status === WorkspaceMembershipStatuses.active;
    const isWorkspaceAdmin = snapshot.isWorkspaceOwner
      || snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);

    return Object.freeze({
      isAuthorized: isActiveMember,
      isWorkspaceAdmin,
    });
  }

  private async observeUploadedContent(
    request: FinalizeImageAssetUploadRequest,
    mediaType: string,
  ): Promise<UploadedContentObservation> {
    const opened = await this.dependencies.imageAssetStoragePort.openReadStream({
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      actorUserId: request.actorUserId,
      purpose: ImageAssetStorageAccessPurposes.workerProcess,
      reference: request.storageReference,
    });

    const sha256 = createHash("sha256");
    const sha512 = createHash("sha512");
    const signatureBytes: Uint8Array[] = [];
    let signatureByteLength = 0;
    const signatureByteLimit = 4096;
    let sizeBytes = 0;
    for await (const chunk of opened.stream) {
      sizeBytes += chunk.byteLength;
      sha256.update(chunk);
      sha512.update(chunk);
      if (signatureByteLength < signatureByteLimit) {
        const remaining = signatureByteLimit - signatureByteLength;
        const slice = chunk.byteLength > remaining ? chunk.slice(0, remaining) : chunk;
        signatureBytes.push(slice);
        signatureByteLength += slice.byteLength;
      }
    }

    if (sizeBytes < 1) {
      throw new Error("Uploaded content is empty.");
    }

    const observed: UploadedContentObservation = {
      sizeBytes,
      checksumSha256: sha256.digest("hex"),
      checksumSha512: sha512.digest("hex"),
      detectedMediaType: await detectMediaTypeFromSignature(signatureBytes),
    };

    if (opened.sizeBytes !== observed.sizeBytes) {
      throw new Error(
        `Stored object size mismatch: metadata reports ${String(opened.sizeBytes)} bytes but stream produced ${String(observed.sizeBytes)} bytes.`,
      );
    }

    if (opened.mediaType && opened.mediaType !== mediaType && request.finalizedMediaType === undefined) {
      throw new Error(
        `Stored object media type '${opened.mediaType}' does not match declared image asset media type '${mediaType}'.`,
      );
    }

    return observed;
  }

  private assertDetectedMediaType(
    expectedMediaType: string,
    detectedMediaType: string | undefined,
  ): void {
    if (!detectedMediaType) {
      return;
    }
    if (detectedMediaType !== expectedMediaType) {
      throw new Error(
        `Uploaded content signature media type '${detectedMediaType}' does not match expected media type '${expectedMediaType}'.`,
      );
    }
  }

  private assertContentConsistency(
    request: FinalizeImageAssetUploadRequest,
    existing: ImageAsset,
    observed: UploadedContentObservation,
  ): void {
    if (request.expectedSizeBytes !== undefined && request.expectedSizeBytes !== observed.sizeBytes) {
      throw new Error(
        `Uploaded content size ${String(observed.sizeBytes)} does not match expectedSizeBytes ${String(request.expectedSizeBytes)}.`,
      );
    }

    if (request.expectedChecksumSha256 && request.expectedChecksumSha256 !== observed.checksumSha256) {
      throw new Error("Uploaded content checksum does not match expectedChecksumSha256.");
    }

    if (existing.sizeBytes !== observed.sizeBytes) {
      throw new Error(
        `Uploaded content size ${String(observed.sizeBytes)} does not match image asset metadata sizeBytes ${String(existing.sizeBytes)}.`,
      );
    }

    if (existing.fingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha256
      && existing.fingerprint.digest !== observed.checksumSha256) {
      throw new Error("Uploaded content checksum does not match image asset fingerprint digest.");
    }

    if (existing.fingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha512
      && existing.fingerprint.digest !== observed.checksumSha512) {
      throw new Error("Uploaded content checksum does not match image asset fingerprint digest.");
    }
  }

  private resolveNormalizedFingerprint(
    request: FinalizeImageAssetUploadRequest,
    existing: ImageAsset,
    observed: UploadedContentObservation,
  ) {
    if (request.expectedFingerprint) {
      if (
        request.expectedFingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha256
        && request.expectedFingerprint.digest !== observed.checksumSha256
      ) {
        throw new Error("expectedFingerprint digest does not match uploaded content.");
      }
      if (
        request.expectedFingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha512
        && request.expectedFingerprint.digest !== observed.checksumSha512
      ) {
        throw new Error("expectedFingerprint digest does not match uploaded content.");
      }
      return request.expectedFingerprint;
    }

    if (existing.fingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha256) {
      return Object.freeze({
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: observed.checksumSha256,
      });
    }

    if (existing.fingerprint.algorithm === ImageAssetFingerprintAlgorithms.sha512) {
      return Object.freeze({
        algorithm: ImageAssetFingerprintAlgorithms.sha512,
        digest: observed.checksumSha512,
      });
    }

    return existing.fingerprint;
  }

  private async failWithCleanup(
    existing: ImageAsset,
    request: FinalizeImageAssetUploadRequest,
    occurredAt: string,
    failureReason: string,
  ): Promise<Readonly<Record<string, unknown>> | undefined> {
    if (existing.lifecycle.status !== ImageAssetStatuses.ingesting) {
      return undefined;
    }

    let cleanupAttempted = false;
    let cleanupDeleted = false;
    let cleanupErrorCode: string | undefined;

    if (request.cleanupOnFailure) {
      cleanupAttempted = true;
      try {
        const deleted = await this.dependencies.imageAssetStoragePort.deleteObject({
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          actorUserId: request.actorUserId,
          reason: ImageAssetStorageLifecycleDeleteReasons.ingestFailure,
          reference: request.storageReference,
        });
        cleanupDeleted = deleted.deleted;
      } catch (error) {
        cleanupErrorCode = isImageAssetStorageError(error) ? error.code : "unknown";
      }
    }

    try {
      const failed = transitionImageAssetStatus(existing, {
        nextStatus: ImageAssetStatuses.failed,
        actorUserId: request.actorUserId,
        occurredAt,
        failureReason,
      });

      await this.dependencies.imageAssetRepository.saveImageAsset(failed, {
        operationKey: `${request.operationKey}:failed`,
        actorUserId: request.actorUserId,
        occurredAt,
        correlationId: request.correlationId,
        reason: failureReason,
      });
    } catch {
      // best effort failure state persistence
    }

    return Object.freeze({
      cleanupAttempted,
      cleanupDeleted,
      cleanupErrorCode,
      failureReason,
    });
  }

  private failure(
    code: typeof ImageAssetUploadFinalizationErrorCodes[keyof typeof ImageAssetUploadFinalizationErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
    normalization?: {
      readonly reason: string;
      readonly kind?: typeof ImageAssetFailureDefaults.kind[keyof typeof ImageAssetFailureDefaults.kind];
      readonly summaryCategory?: typeof ImageAssetFailureDefaults.summary[keyof typeof ImageAssetFailureDefaults.summary];
      readonly userFixable?: boolean;
      readonly retryable?: boolean;
      readonly resilience?: {
        readonly code: string;
        readonly scope: typeof ImageManipulationResilienceScopes[keyof typeof ImageManipulationResilienceScopes];
        readonly state: typeof ImageManipulationResilienceStateKinds[keyof typeof ImageManipulationResilienceStateKinds];
        readonly summary: string;
        readonly durability?: typeof ImageManipulationResilienceDurabilityClasses[keyof typeof ImageManipulationResilienceDurabilityClasses];
        readonly recoveryKind?: typeof ImageManipulationResilienceRecoveryKinds[keyof typeof ImageManipulationResilienceRecoveryKinds];
        readonly recoveryRetryable?: boolean;
        readonly recoveryRetryAfterMs?: number;
      };
    },
  ): ImageAssetUploadFinalizationResult<never> {
    const normalizedDetails = normalization
      ? withImageAssetNormalizedFailureDetails(
        details,
        createImageAssetNormalizedFailure({
          layer: ImageAssetFailureDefaults.layer.ingestion,
          kind: normalization.kind ?? ImageAssetFailureDefaults.kind.validation,
          reason: normalization.reason,
          summaryCategory: normalization.summaryCategory ?? ImageAssetFailureDefaults.summary.validation,
          userFixable: normalization.userFixable,
          retryable: normalization.retryable,
          resilience: normalization.resilience,
          degraded: Boolean(normalization.resilience),
        }),
      )
      : details;
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details: normalizedDetails,
      }),
    };
  }

  private async publishFinalizationAuditEvent(input: {
    readonly request: FinalizeImageAssetUploadRequest;
    readonly occurredAt: string;
    readonly outcome: typeof ImageAssetAuditOutcomes[keyof typeof ImageAssetAuditOutcomes];
    readonly imageAsset?: ImageAsset;
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishImageAssetAuditEventBestEffort(this.dependencies.auditSink, {
      type: ImageAssetAuditEventTypes.uploadFinalized,
      occurredAt: input.occurredAt,
      workspaceId: input.request.workspaceId,
      actorUserId: input.request.actorUserId,
      correlationId: input.request.correlationId,
      operationKey: input.request.operationKey,
      outcome: input.outcome,
      asset: Object.freeze({
        assetId: input.request.assetId,
        storageInstanceId: input.imageAsset?.storageInstanceId ?? input.request.storageReference.storageInstanceId,
        ownerUserId: input.imageAsset?.ownerUserId,
        visibility: input.imageAsset?.visibility,
        originKind: input.imageAsset?.originKind,
        lifecycleStatus: input.imageAsset?.lifecycle.status,
        mediaType: input.imageAsset?.mediaType,
      }),
      details: Object.freeze({
        reasonCode: input.reasonCode,
        ...(input.details ?? {}),
      }),
    });
  }
}

function mapFailureReason(error: unknown): string {
  if (error instanceof ImageAssetDomainError) {
    return "domain-validation-failed";
  }
  if (isImageAssetStorageError(error)) {
    return `storage-${error.code}`;
  }
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes("checksum")) {
      return "checksum-mismatch";
    }
    if (normalized.includes("size")) {
      return "size-mismatch";
    }
    if (normalized.includes("media type")) {
      return "media-type-mismatch";
    }
    return "upload-finalization-failed";
  }
  return "upload-finalization-failed";
}

type FileTypeFromBuffer = (buffer: Uint8Array) => Promise<{ readonly mime?: string } | undefined>;

async function resolveFileTypeFromBuffer(): Promise<FileTypeFromBuffer | undefined> {
  try {
    const moduleRecord = await import("file-type") as Readonly<Record<string, unknown>>;
    const candidate = moduleRecord.fileTypeFromBuffer as FileTypeFromBuffer | undefined;
    if (typeof candidate === "function") {
      return candidate;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function detectMediaTypeFromSignature(chunks: ReadonlyArray<Uint8Array>): Promise<string | undefined> {
  if (chunks.length === 0) {
    return undefined;
  }
  const detector = await resolveFileTypeFromBuffer();

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const payload = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const detectedMediaType = detector
    ? (await detector(payload))?.mime?.toLowerCase()
    : undefined;
  return detectedMediaType ?? detectMediaTypeFromMagicBytes(payload);
}

function detectMediaTypeFromMagicBytes(payload: Uint8Array): string | undefined {
  const startsWith = (signature: ReadonlyArray<number>): boolean =>
    signature.every((value, index) => payload[index] === value);
  if (payload.length >= 8 && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (payload.length >= 3 && startsWith([0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (payload.length >= 6 && (startsWith([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) {
    return "image/gif";
  }
  if (payload.length >= 2 && startsWith([0x42, 0x4d])) {
    return "image/bmp";
  }
  if (payload.length >= 12 && payload[0] === 0x52 && payload[1] === 0x49 && payload[2] === 0x46 && payload[3] === 0x46
    && payload[8] === 0x57 && payload[9] === 0x45 && payload[10] === 0x42 && payload[11] === 0x50) {
    return "image/webp";
  }
  if (payload.length >= 4) {
    const littleEndianTiff = startsWith([0x49, 0x49, 0x2a, 0x00]);
    const bigEndianTiff = startsWith([0x4d, 0x4d, 0x00, 0x2a]);
    if (littleEndianTiff || bigEndianTiff) {
      return "image/tiff";
    }
  }
  if (payload.length >= 12) {
    const isFtyp = payload[4] === 0x66 && payload[5] === 0x74 && payload[6] === 0x79 && payload[7] === 0x70;
    if (isFtyp) {
      const brand = String.fromCharCode(payload[8] ?? 0, payload[9] ?? 0, payload[10] ?? 0, payload[11] ?? 0).toLowerCase();
      if (brand === "avif" || brand === "avis") {
        return "image/avif";
      }
      if (brand.startsWith("heic")) {
        return "image/heic";
      }
      if (brand.startsWith("heif") || brand.startsWith("mif1")) {
        return "image/heif";
      }
    }
  }
  return undefined;
}

function mapFailureCode(
  error: unknown,
): typeof ImageAssetUploadFinalizationErrorCodes[keyof typeof ImageAssetUploadFinalizationErrorCodes] {
  if (isImageAssetStorageError(error)) {
    if (error.code === ImageAssetStorageErrorCodes.notFound) {
      return ImageAssetUploadFinalizationErrorCodes.notFound;
    }
    if (error.code === ImageAssetStorageErrorCodes.accessDenied) {
      return ImageAssetUploadFinalizationErrorCodes.accessDenied;
    }
    if (error.code === ImageAssetStorageErrorCodes.conflict) {
      return ImageAssetUploadFinalizationErrorCodes.conflict;
    }
    return ImageAssetUploadFinalizationErrorCodes.internal;
  }

  if (error instanceof ImageAssetDomainError) {
    return ImageAssetUploadFinalizationErrorCodes.invalidRequest;
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes("checksum") || normalized.includes("size") || normalized.includes("mismatch")) {
      return ImageAssetUploadFinalizationErrorCodes.conflict;
    }
  }

  return ImageAssetUploadFinalizationErrorCodes.internal;
}
