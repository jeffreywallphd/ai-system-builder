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

export interface FinalizeImageAssetUploadUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

interface UploadedContentObservation {
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly checksumSha512: string;
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
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const authorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!authorization.isAuthorized) {
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.accessDenied,
        "Image asset upload finalization requires active workspace membership.",
      );
    }

    const existing = await this.dependencies.imageAssetRepository.findImageAssetById(request.assetId, {
      includeDeleted: true,
    });
    if (!existing || existing.workspaceId !== request.workspaceId) {
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.notFound,
        "Image asset was not found for the workspace.",
      );
    }

    if (existing.storageInstanceId !== request.storageReference.storageInstanceId) {
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.invalidRequest,
        "storageReference.storageInstanceId does not match image asset storageInstanceId.",
      );
    }

    if (existing.lifecycle.status !== ImageAssetStatuses.ingesting) {
      return this.failure(
        ImageAssetUploadFinalizationErrorCodes.invalidState,
        `Image asset '${existing.assetId}' is '${existing.lifecycle.status}' and cannot be finalized from upload pending state.`,
      );
    }

    try {
      const observed = await this.observeUploadedContent(request, existing.mediaType);
      this.assertContentConsistency(request, existing, observed);

      const normalizedFingerprint = this.resolveNormalizedFingerprint(request, existing, observed);
      const normalizedMediaType = request.finalizedMediaType ?? existing.mediaType;
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
      return this.failure(
        code,
        error instanceof Error ? error.message : "Image asset upload finalization failed.",
        cleanup,
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
    let sizeBytes = 0;
    for await (const chunk of opened.stream) {
      sizeBytes += chunk.byteLength;
      sha256.update(chunk);
      sha512.update(chunk);
    }

    const observed: UploadedContentObservation = {
      sizeBytes,
      checksumSha256: sha256.digest("hex"),
      checksumSha512: sha512.digest("hex"),
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
  ): ImageAssetUploadFinalizationResult<never> {
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
