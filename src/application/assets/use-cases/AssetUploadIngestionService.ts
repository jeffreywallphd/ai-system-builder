import {
  AssetDomainError,
  AssetLifecycleStates,
  addAssetVersion,
  createAssetLocationRef,
  createContentDescriptor,
  type Asset,
} from "../../../domain/assets/AssetDomain";
import type { IStorageLogicalAccessResolutionService } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import { StorageLogicalAccessOperationIntents } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import {
  type IStorageObjectPort,
  StorageObjectAccessError,
  StorageObjectErrorCodes,
} from "../../storage/ports/StorageObjectPort";
import type { StorageInstance } from "../../../domain/storage/StorageDomain";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { IAssetUploadSessionRepository } from "../ports/IAssetUploadSessionRepository";
import type { AssetAuditSink } from "../ports/AssetAuditPort";
import {
  AssetServiceErrorCodes,
  type AssetServiceResult,
} from "./AssetServiceContracts";

export interface IngestAssetUploadContentRequest {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly operationKey: string;
  readonly uploadSessionId: string;
  readonly contentType?: string;
  readonly content: AsyncIterable<Uint8Array>;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface IngestAssetUploadContentResult {
  readonly asset: Asset;
  readonly finalizedVersionId: string;
  readonly uploadSessionId: string;
  readonly content: {
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly checksum: {
      readonly algorithm: "sha256";
      readonly digest: string;
    };
    readonly originalFileName?: string;
  };
}

export interface AssetUploadIngestionServiceDependencies {
  readonly repository: IAssetRepository;
  readonly uploadSessionRepository: IAssetUploadSessionRepository;
  readonly storageLogicalAccessResolutionService: IStorageLogicalAccessResolutionService;
  readonly auditSink?: AssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class AssetUploadIngestionService {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AssetUploadIngestionServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  public async ingestUploadContent(
    input: IngestAssetUploadContentRequest,
  ): Promise<AssetServiceResult<IngestAssetUploadContentResult>> {
    const validationError = this.validateRequest(input);
    if (validationError) {
      return validationError;
    }

    const occurredAt = input.occurredAt ?? this.clock.now().toISOString();
    const uploadSession = await this.dependencies.uploadSessionRepository.findUploadSessionById(input.uploadSessionId);
    if (!uploadSession || uploadSession.workspaceId !== input.workspaceId) {
      return this.failure(AssetServiceErrorCodes.notFound, "Upload session was not found for the workspace.");
    }

    if (uploadSession.actorUserId !== input.actorUserId) {
      return this.failure(AssetServiceErrorCodes.accessDenied, "Upload session actor does not match authenticated actor.");
    }

    if (uploadSession.status !== "pending") {
      return this.failure(AssetServiceErrorCodes.invalidState, "Upload session is not pending.");
    }

    if (new Date(uploadSession.expiresAt).getTime() < new Date(occurredAt).getTime()) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "upload-session-expired", "Upload session has expired.");
      return this.failure(AssetServiceErrorCodes.invalidState, "Upload session has expired.");
    }

    const asset = await this.dependencies.repository.findAssetById(uploadSession.assetId);
    if (!asset || asset.ownership.workspaceId !== input.workspaceId) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "asset-not-found", "Asset was not found.");
      return this.failure(AssetServiceErrorCodes.notFound, "Asset was not found for upload finalization.");
    }

    if (asset.lifecycle.state !== AssetLifecycleStates.active) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "asset-invalid-state", "Asset is not active.");
      return this.failure(AssetServiceErrorCodes.invalidState, "Asset must be active for upload finalization.");
    }

    if (asset.storageBinding.storageInstanceId !== uploadSession.storageInstanceId) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "storage-mismatch", "Asset storage binding mismatch.");
      return this.failure(AssetServiceErrorCodes.invalidRequest, "Upload session storage does not match asset storage binding.");
    }

    const accessPlan = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
      actorUserIdentityId: input.actorUserId,
      workspaceId: input.workspaceId,
      storageInstanceId: uploadSession.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.writeObject,
      occurredAt,
    });
    if (!accessPlan.ok) {
      await this.markUploadIncomplete(
        uploadSession,
        occurredAt,
        accessPlan.error.code,
        accessPlan.error.message,
      );
      return this.failureFromLogicalAccessResolution(accessPlan.error.code, accessPlan.error.message, accessPlan.error.details);
    }

    const reference = {
      storageInstance: accessPlan.value.storageInstance,
      objectKey: uploadSession.objectKey,
    } as const;

    try {
      const writeResult = await accessPlan.value.objectPort.writeObject({
        reference,
        content: this.enforceMaximumPayloadSize(input.content, uploadSession.expected.sizeBytes),
        overwriteExisting: true,
      });

      if (writeResult.sizeBytes !== uploadSession.expected.sizeBytes) {
        await this.cleanupObject(accessPlan.value.objectPort, reference);
        await this.markUploadIncomplete(
          uploadSession,
          occurredAt,
          "upload-size-mismatch",
          `Upload size mismatch. Expected ${String(uploadSession.expected.sizeBytes)} bytes but received ${String(writeResult.sizeBytes)} bytes.`,
        );
        return this.failure(
          AssetServiceErrorCodes.invalidRequest,
          "Upload payload size did not match the expected upload session size.",
          Object.freeze({
            expectedSizeBytes: uploadSession.expected.sizeBytes,
            actualSizeBytes: writeResult.sizeBytes,
          }),
        );
      }

      const finalizedVersionId = `${asset.id}:v${String(asset.versions.length + 1)}`;
      const finalizedMimeType = normalizeMimeType(input.contentType ?? uploadSession.expected.mimeType);
      const finalizedAsset = addAssetVersion(asset, {
        versionId: finalizedVersionId,
        location: createAssetLocationRef({
          storageInstance: {
            storageInstanceId: uploadSession.storageInstanceId,
          },
          objectKey: uploadSession.objectKey,
          area: uploadSession.area,
        }),
        content: createContentDescriptor({
          mimeType: finalizedMimeType,
          sizeBytes: writeResult.sizeBytes,
          checksum: {
            algorithm: writeResult.checksum.algorithm,
            digest: writeResult.checksum.digest,
          },
          originalFileName: uploadSession.expected.fileName,
        }),
        actorUserId: input.actorUserId,
        occurredAt,
      });

      await this.dependencies.repository.saveAsset(finalizedAsset);
      await this.dependencies.uploadSessionRepository.saveUploadSession(Object.freeze({
        ...uploadSession,
        status: "completed",
        updatedAt: occurredAt,
        finalizedVersionId,
        finalizedContent: Object.freeze({
          mimeType: finalizedMimeType,
          sizeBytes: writeResult.sizeBytes,
          checksumAlgorithm: writeResult.checksum.algorithm,
          checksumDigest: writeResult.checksum.digest,
          originalFileName: uploadSession.expected.fileName,
        }),
        incompleteReasonCode: undefined,
        incompleteReasonMessage: undefined,
      }));

      await this.publishAuditEvent({
        type: "asset-upload-finalized",
        occurredAt,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        asset: {
          assetId: finalizedAsset.id,
          kind: finalizedAsset.kind,
          visibility: finalizedAsset.visibility,
          lifecycleState: finalizedAsset.lifecycle.state,
          versionId: finalizedVersionId,
        },
        details: {
          uploadSessionId: uploadSession.uploadSessionId,
          storageInstanceId: uploadSession.storageInstanceId,
          objectKey: uploadSession.objectKey,
          sizeBytes: writeResult.sizeBytes,
          checksumAlgorithm: writeResult.checksum.algorithm,
          checksumDigest: writeResult.checksum.digest,
        },
      });

      return {
        ok: true,
        value: Object.freeze({
          asset: finalizedAsset,
          finalizedVersionId,
          uploadSessionId: uploadSession.uploadSessionId,
          content: Object.freeze({
            mimeType: finalizedMimeType,
            sizeBytes: writeResult.sizeBytes,
            checksum: Object.freeze({
              algorithm: writeResult.checksum.algorithm,
              digest: writeResult.checksum.digest,
            }),
            originalFileName: uploadSession.expected.fileName,
          }),
        }),
      };
    } catch (error) {
      await this.cleanupObject(accessPlan.value.objectPort, reference);
      await this.markUploadIncomplete(
        uploadSession,
        occurredAt,
        resolveUploadFailureCode(error),
        error instanceof Error ? error.message : "Upload ingestion failed.",
      );

      if (error instanceof UploadPayloadTooLargeError) {
        return this.failure(
          AssetServiceErrorCodes.policyViolation,
          "Upload payload exceeded the allowed size.",
          Object.freeze({
            maxAllowedBytes: error.maxAllowedBytes,
            observedBytes: error.observedBytes,
          }),
        );
      }

      if (error instanceof StorageObjectAccessError) {
        return this.failureFromStorageObjectError(error);
      }

      if (error instanceof AssetDomainError) {
        return this.failure(AssetServiceErrorCodes.invalidRequest, error.message);
      }

      return this.failure(
        AssetServiceErrorCodes.internal,
        error instanceof Error ? error.message : "Upload ingestion failed.",
      );
    }
  }

  private async cleanupObject(
    objectPort: IStorageObjectPort,
    reference: {
      readonly storageInstance: StorageInstance;
      readonly objectKey: string;
    },
  ): Promise<void> {
    try {
      await objectPort.deleteObject({ reference });
    } catch {
      // best effort cleanup
    }
  }

  private async markUploadIncomplete(
    uploadSession: Awaited<ReturnType<IAssetUploadSessionRepository["findUploadSessionById"]>>,
    occurredAt: string,
    reasonCode: string,
    reasonMessage: string,
  ): Promise<void> {
    if (!uploadSession) {
      return;
    }

    try {
      await this.dependencies.uploadSessionRepository.saveUploadSession(Object.freeze({
        ...uploadSession,
        status: "incomplete",
        updatedAt: occurredAt,
        incompleteReasonCode: reasonCode,
        incompleteReasonMessage: reasonMessage,
      }));
    } catch {
      // best effort
    }
  }

  private validateRequest(input: IngestAssetUploadContentRequest): AssetServiceResult<never> | undefined {
    if (!normalizeOptional(input.actorUserId)) {
      return this.failure(AssetServiceErrorCodes.invalidRequest, "actorUserId is required.");
    }
    if (!normalizeOptional(input.workspaceId)) {
      return this.failure(AssetServiceErrorCodes.invalidRequest, "workspaceId is required.");
    }
    if (!normalizeOptional(input.operationKey)) {
      return this.failure(AssetServiceErrorCodes.invalidRequest, "operationKey is required.");
    }
    if (!normalizeOptional(input.uploadSessionId)) {
      return this.failure(AssetServiceErrorCodes.invalidRequest, "uploadSessionId is required.");
    }
    if (!input.content) {
      return this.failure(AssetServiceErrorCodes.invalidRequest, "content stream is required.");
    }

    if (input.occurredAt) {
      const parsed = new Date(input.occurredAt);
      if (Number.isNaN(parsed.getTime())) {
        return this.failure(AssetServiceErrorCodes.invalidRequest, "occurredAt must be a valid timestamp.");
      }
    }

    return undefined;
  }

  private failureFromStorageObjectError(error: StorageObjectAccessError): AssetServiceResult<never> {
    switch (error.code) {
      case StorageObjectErrorCodes.sizeLimitExceeded:
        return this.failure(AssetServiceErrorCodes.policyViolation, error.message, error.context);
      case StorageObjectErrorCodes.notFound:
        return this.failure(AssetServiceErrorCodes.contentUnavailable, error.message, error.context);
      case StorageObjectErrorCodes.invalidRequest:
        return this.failure(AssetServiceErrorCodes.invalidRequest, error.message, error.context);
      case StorageObjectErrorCodes.conflict:
        return this.failure(AssetServiceErrorCodes.conflict, error.message, error.context);
      case StorageObjectErrorCodes.backendUnsupported:
      case StorageObjectErrorCodes.ioFailure:
      default:
        return this.failure(AssetServiceErrorCodes.internal, error.message, error.context);
    }
  }

  private failureFromLogicalAccessResolution(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetServiceResult<never> {
    switch (code) {
      case "storage-logical-access-invalid-request":
        return this.failure(AssetServiceErrorCodes.invalidRequest, message, details);
      case "storage-logical-access-not-found":
        return this.failure(AssetServiceErrorCodes.notFound, message, details);
      case "storage-logical-access-policy-violation":
        return this.failure(AssetServiceErrorCodes.policyViolation, message, details);
      case "storage-logical-access-capability-unsupported":
        return this.failure(AssetServiceErrorCodes.invalidState, message, details);
      default:
        return this.failure(AssetServiceErrorCodes.internal, message, details);
    }
  }

  private async publishAuditEvent(event: Parameters<AssetAuditSink["recordAssetEvent"]>[0]): Promise<void> {
    if (!this.dependencies.auditSink) {
      return;
    }
    try {
      await this.dependencies.auditSink.recordAssetEvent(event);
    } catch {
      // best effort
    }
  }

  private failure(
    code: typeof AssetServiceErrorCodes[keyof typeof AssetServiceErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetServiceResult<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }

  private async *enforceMaximumPayloadSize(
    content: AsyncIterable<Uint8Array>,
    expectedSizeBytes: number,
  ): AsyncIterable<Uint8Array> {
    let observedBytes = 0;
    for await (const chunk of content) {
      observedBytes += chunk.byteLength;
      if (observedBytes > expectedSizeBytes) {
        throw new UploadPayloadTooLargeError(expectedSizeBytes, observedBytes);
      }
      yield chunk;
    }
  }
}

class UploadPayloadTooLargeError extends Error {
  public constructor(
    public readonly maxAllowedBytes: number,
    public readonly observedBytes: number,
  ) {
    super(`Upload payload exceeded expected size (${String(maxAllowedBytes)} bytes).`);
    this.name = "UploadPayloadTooLargeError";
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeMimeType(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withoutParameters = trimmed.split(";")[0]?.trim();
  if (!withoutParameters) {
    return "application/octet-stream";
  }
  return withoutParameters;
}

function resolveUploadFailureCode(error: unknown): string {
  if (error instanceof UploadPayloadTooLargeError) {
    return "upload-payload-too-large";
  }
  if (error instanceof StorageObjectAccessError) {
    return error.code;
  }
  return "upload-ingestion-failed";
}
