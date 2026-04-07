import {
  AssetDomainError,
  AssetContentEncryptionFormats,
  AssetLifecycleStates,
  addAssetVersion,
  createAssetLocationRef,
  createContentDescriptor,
  type Asset,
} from "@domain/assets/AssetDomain";
import type { IStorageLogicalAccessResolutionService } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import { StorageLogicalAccessOperationIntents } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import {
  type IStorageObjectPort,
  StorageObjectAccessError,
  StorageObjectErrorCodes,
} from "../../storage/ports/StorageObjectPort";
import type { StorageInstance } from "@domain/storage/StorageDomain";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { IAssetUploadSessionRepository } from "../ports/IAssetUploadSessionRepository";
import {
  publishAssetAuditEventBestEffort,
  type AssetAuditSink,
} from "../ports/AssetAuditPort";
import type { IAssetContentCipherPort } from "../ports/AssetContentCipherPort";
import type { IEncryptionKeyResolutionService } from "../../security/use-cases/EncryptionKeyResolutionServiceContracts";
import { EncryptionMaterialClasses } from "../../security/use-cases/EncryptionKeyResolutionServiceContracts";
import type { IEncryptionPolicyEvaluationService } from "../../security/use-cases/EncryptionPolicyEvaluationServiceContracts";
import { ProtectedDataClasses } from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  publishEncryptionEnforcementEventBestEffort,
  type IEncryptionEnforcementObservabilityPort,
} from "../../security/ports/EncryptionEnforcementObservabilityPorts";
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
  readonly encryptionPolicyEvaluationService: IEncryptionPolicyEvaluationService;
  readonly encryptionKeyResolutionService: IEncryptionKeyResolutionService;
  readonly assetContentCipherPort: IAssetContentCipherPort;
  readonly encryptionObservabilityPort?: IEncryptionEnforcementObservabilityPort;
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
      await this.publishRejectedAuditEvent({
        occurredAt,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        assetId: uploadSession.assetId,
        uploadSessionId: uploadSession.uploadSessionId,
        reasonCode: "upload-session-actor-mismatch",
      });
      return this.failure(AssetServiceErrorCodes.accessDenied, "Upload session actor does not match authenticated actor.");
    }

    if (uploadSession.status !== "pending") {
      await this.publishAuditEvent({
        type: "asset-upload-finalized",
        occurredAt,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        outcome: "already-applied",
        asset: {
          assetId: uploadSession.assetId,
        },
        details: Object.freeze({
          uploadSessionId: uploadSession.uploadSessionId,
          reasonCode: "upload-session-not-pending",
        }),
      });
      return this.failure(AssetServiceErrorCodes.invalidState, "Upload session is not pending.");
    }

    if (new Date(uploadSession.expiresAt).getTime() < new Date(occurredAt).getTime()) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "upload-session-expired", "Upload session has expired.");
      await this.publishRejectedAuditEvent({
        occurredAt,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        assetId: uploadSession.assetId,
        uploadSessionId: uploadSession.uploadSessionId,
        reasonCode: "upload-session-expired",
      });
      return this.failure(AssetServiceErrorCodes.invalidState, "Upload session has expired.");
    }

    const requestedMimeType = normalizeOptionalIncomingMimeType(input.contentType);
    if (input.contentType && !requestedMimeType) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "upload-content-type-invalid", "Upload content type is invalid.");
      return this.failure(AssetServiceErrorCodes.invalidRequest, "contentType must be a valid media type.");
    }
    if (
      requestedMimeType
      && !isCompatibleMimeType(requestedMimeType, uploadSession.expected.mimeType)
    ) {
      await this.markUploadIncomplete(uploadSession, occurredAt, "upload-content-type-mismatch", "Upload content type does not match expected mime type.");
      return this.failure(AssetServiceErrorCodes.invalidRequest, "Upload content type does not match upload session expectations.");
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
    const finalizedVersionId = `${asset.id}:v${String(asset.versions.length + 1)}`;
    const contentEncryptionDecision = await this.dependencies.encryptionPolicyEvaluationService.evaluateContentEncryptionRequirement({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: input.workspaceId,
      storageInstanceId: uploadSession.storageInstanceId,
      occurredAt,
    });
    if (!contentEncryptionDecision.ok) {
      await this.publishEncryptionEvent({
        event: "asset-content.protected-write-evaluated",
        outcome: contentEncryptionDecision.error.code === "encryption-policy-violation" ? "denied" : "failed",
        occurredAt,
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        storageInstanceId: uploadSession.storageInstanceId,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        details: Object.freeze({
          errorCode: contentEncryptionDecision.error.code,
          reasonCode: "policy-evaluation-failed",
        }),
      });
      await this.markUploadIncomplete(
        uploadSession,
        occurredAt,
        contentEncryptionDecision.error.code,
        contentEncryptionDecision.error.message,
      );
      return this.failureFromEncryptionPolicy(contentEncryptionDecision.error.code, contentEncryptionDecision.error.message);
    }
    await this.publishEncryptionEvent({
      event: "asset-content.protected-write-evaluated",
      outcome: "succeeded",
      occurredAt,
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      storageInstanceId: uploadSession.storageInstanceId,
      dataClass: ProtectedDataClasses.assetContent,
      correlationId: input.correlationId,
      operationKey: input.operationKey,
      details: Object.freeze({
        contentEncryptionRequired: contentEncryptionDecision.value.required,
        keyScope: contentEncryptionDecision.value.keyScope,
        policyResolvedFrom: contentEncryptionDecision.value.resolvedFrom,
      }),
    });

    try {
      let writeContent: AsyncIterable<Uint8Array> = this.enforceMaximumPayloadSize(
        input.content,
        uploadSession.expected.sizeBytes,
      );
      let encryptedDescriptor: {
        readonly format: "asset-content/aes-256-gcm/v1";
        readonly algorithm: "aes-256-gcm";
        readonly keyReferenceId: string;
        readonly keyId: string;
        readonly keyVersion?: string;
        readonly keyScope: "server" | "workspace" | "storage-instance";
        readonly workspaceId?: string;
        readonly storageInstanceId?: string;
        readonly ivBase64: string;
        readonly authTagBase64: string;
        readonly aad: string;
        readonly encryptedAt: string;
      } | undefined;
      let plaintextSizeBytes: number | undefined;
      let plaintextChecksumDigest: string | undefined;
      let encryptionCompletion:
        | (() => Promise<{
          readonly plaintextSizeBytes: number;
          readonly plaintextChecksum: {
            readonly algorithm: "sha256";
            readonly digest: string;
          };
          readonly descriptor: {
            readonly format: "asset-content/aes-256-gcm/v1";
            readonly algorithm: "aes-256-gcm";
            readonly keyReferenceId: string;
            readonly keyId: string;
            readonly keyVersion?: string;
            readonly keyScope: "server" | "workspace" | "storage-instance";
            readonly workspaceId?: string;
            readonly storageInstanceId?: string;
            readonly ivBase64: string;
            readonly authTagBase64: string;
            readonly aad: string;
            readonly encryptedAt: string;
          };
        }>)
        | undefined;

      if (contentEncryptionDecision.value.required) {
        const keyResolution = await this.dependencies.encryptionKeyResolutionService.resolveKeyForMaterial({
          materialClass: EncryptionMaterialClasses.assetContent,
          workspaceId: input.workspaceId,
          storageInstanceId: uploadSession.storageInstanceId,
          occurredAt,
        });
        if (!keyResolution.ok) {
          await this.publishEncryptionEvent({
            event: "asset-content.protected-write-key-scope-resolved",
            outcome: keyResolution.error.code === "encryption-key-resolution-policy-violation" ? "denied" : "failed",
            occurredAt,
            actorUserId: input.actorUserId,
            workspaceId: input.workspaceId,
            storageInstanceId: uploadSession.storageInstanceId,
            dataClass: ProtectedDataClasses.assetContent,
            correlationId: input.correlationId,
            operationKey: input.operationKey,
            details: Object.freeze({
              errorCode: keyResolution.error.code,
              reasonCode: "key-resolution-failed",
            }),
          });
          await this.markUploadIncomplete(
            uploadSession,
            occurredAt,
            keyResolution.error.code,
            keyResolution.error.message,
          );
          return this.failureFromKeyResolution(keyResolution.error.code, keyResolution.error.message);
        }
        await this.publishEncryptionEvent({
          event: "asset-content.protected-write-key-scope-resolved",
          outcome: "succeeded",
          occurredAt,
          actorUserId: input.actorUserId,
          workspaceId: input.workspaceId,
          storageInstanceId: uploadSession.storageInstanceId,
          dataClass: ProtectedDataClasses.assetContent,
          correlationId: input.correlationId,
          operationKey: input.operationKey,
          details: Object.freeze({
            keyScope: keyResolution.value.keyScope,
            policyResolvedFrom: keyResolution.value.policyResolvedFrom,
            scopeOwnerScope: keyResolution.value.scopeOwner.scope,
          }),
        });

        const encryptionSession = await this.dependencies.assetContentCipherPort.beginEncryption({
          plaintext: writeContent,
          key: keyResolution.value.key,
          aad: buildAssetContentAad({
            workspaceId: input.workspaceId,
            storageInstanceId: uploadSession.storageInstanceId,
            assetId: asset.id,
            versionId: finalizedVersionId,
            objectKey: uploadSession.objectKey,
            area: uploadSession.area,
          }),
          encryptedAt: occurredAt,
        });
        writeContent = encryptionSession.ciphertext;
        encryptionCompletion = encryptionSession.complete;
      }

      const writeResult = await accessPlan.value.objectPort.writeObject({
        reference,
        content: writeContent,
        overwriteExisting: true,
      });

      if (encryptionCompletion) {
        const encryptedOutcome = await encryptionCompletion();
        encryptedDescriptor = {
          format: AssetContentEncryptionFormats.aes256GcmV1,
          algorithm: "aes-256-gcm",
          keyReferenceId: encryptedOutcome.descriptor.keyReferenceId,
          keyId: encryptedOutcome.descriptor.keyId,
          keyVersion: encryptedOutcome.descriptor.keyVersion,
          keyScope: encryptedOutcome.descriptor.keyScope,
          workspaceId: encryptedOutcome.descriptor.workspaceId,
          storageInstanceId: encryptedOutcome.descriptor.storageInstanceId,
          ivBase64: encryptedOutcome.descriptor.ivBase64,
          authTagBase64: encryptedOutcome.descriptor.authTagBase64,
          aad: encryptedOutcome.descriptor.aad,
          encryptedAt: encryptedOutcome.descriptor.encryptedAt,
        };
        plaintextSizeBytes = encryptedOutcome.plaintextSizeBytes;
        plaintextChecksumDigest = encryptedOutcome.plaintextChecksum.digest;
      }

      const effectiveSizeBytes = plaintextSizeBytes ?? writeResult.sizeBytes;
      if (effectiveSizeBytes !== uploadSession.expected.sizeBytes) {
        await this.cleanupObject(accessPlan.value.objectPort, reference);
        await this.markUploadIncomplete(
          uploadSession,
          occurredAt,
          "upload-size-mismatch",
          `Upload size mismatch. Expected ${String(uploadSession.expected.sizeBytes)} bytes but received ${String(effectiveSizeBytes)} bytes.`,
        );
        return this.failure(
          AssetServiceErrorCodes.invalidRequest,
          "Upload payload size did not match the expected upload session size.",
          Object.freeze({
            expectedSizeBytes: uploadSession.expected.sizeBytes,
            actualSizeBytes: effectiveSizeBytes,
          }),
        );
      }

      const finalizedMimeType = requestedMimeType ?? normalizeMimeType(uploadSession.expected.mimeType);
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
          sizeBytes: effectiveSizeBytes,
          checksum: {
            algorithm: "sha256",
            digest: plaintextChecksumDigest ?? writeResult.checksum.digest,
          },
          originalFileName: uploadSession.expected.fileName,
          encryption: encryptedDescriptor,
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
          sizeBytes: effectiveSizeBytes,
          checksumAlgorithm: "sha256",
          checksumDigest: plaintextChecksumDigest ?? writeResult.checksum.digest,
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
        outcome: "success",
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
          sizeBytes: effectiveSizeBytes,
          checksumAlgorithm: "sha256",
          encryptedAtRest: Boolean(encryptedDescriptor),
        },
      });

      await this.publishEncryptionEvent({
        event: "asset-content.protected-write-completed",
        outcome: "succeeded",
        occurredAt,
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        storageInstanceId: uploadSession.storageInstanceId,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        details: Object.freeze({
          encryptedAtRest: Boolean(encryptedDescriptor),
          contentEncryptionRequired: contentEncryptionDecision.value.required,
          descriptorKeyScope: encryptedDescriptor?.keyScope,
          contentSizeBytes: effectiveSizeBytes,
          checksumAlgorithm: "sha256",
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          asset: finalizedAsset,
          finalizedVersionId,
          uploadSessionId: uploadSession.uploadSessionId,
          content: Object.freeze({
            mimeType: finalizedMimeType,
            sizeBytes: effectiveSizeBytes,
            checksum: Object.freeze({
              algorithm: "sha256",
              digest: plaintextChecksumDigest ?? writeResult.checksum.digest,
            }),
            originalFileName: uploadSession.expected.fileName,
          }),
        }),
      };
    } catch (error) {
      await this.cleanupObject(accessPlan.value.objectPort, reference);
      const reasonCode = resolveUploadFailureCode(error);
      await this.markUploadIncomplete(
        uploadSession,
        occurredAt,
        reasonCode,
        resolveUploadFailureMessage(error),
      );
      await this.publishRejectedAuditEvent({
        occurredAt,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        assetId: uploadSession.assetId,
        uploadSessionId: uploadSession.uploadSessionId,
        reasonCode,
      });
      await this.publishEncryptionEvent({
        event: "asset-content.protected-write-completed",
        outcome: "failed",
        occurredAt,
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        storageInstanceId: uploadSession.storageInstanceId,
        dataClass: ProtectedDataClasses.assetContent,
        correlationId: input.correlationId,
        operationKey: input.operationKey,
        details: Object.freeze({
          reasonCode,
          contentEncryptionRequired: contentEncryptionDecision.value.required,
        }),
      });

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
        "Upload ingestion failed due to an internal error.",
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
        return this.failure(AssetServiceErrorCodes.policyViolation, "Upload payload exceeds storage policy limits.", error.context);
      case StorageObjectErrorCodes.notFound:
        return this.failure(AssetServiceErrorCodes.contentUnavailable, "Upload target content is unavailable.", error.context);
      case StorageObjectErrorCodes.invalidRequest:
        return this.failure(AssetServiceErrorCodes.invalidRequest, "Upload content request is invalid.", error.context);
      case StorageObjectErrorCodes.conflict:
        return this.failure(AssetServiceErrorCodes.conflict, "Upload content conflicts with existing storage state.", error.context);
      case StorageObjectErrorCodes.backendUnsupported:
      case StorageObjectErrorCodes.ioFailure:
      default:
        return this.failure(AssetServiceErrorCodes.internal, "Upload storage write failed.", error.context);
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

  private failureFromEncryptionPolicy(
    code: string,
    message: string,
  ): AssetServiceResult<never> {
    switch (code) {
      case "encryption-policy-invalid-request":
        return this.failure(AssetServiceErrorCodes.invalidRequest, message);
      case "encryption-policy-violation":
        return this.failure(AssetServiceErrorCodes.policyViolation, message);
      case "encryption-policy-resolution-failed":
        return this.failure(AssetServiceErrorCodes.invalidState, message);
      default:
        return this.failure(AssetServiceErrorCodes.internal, message);
    }
  }

  private failureFromKeyResolution(
    code: string,
    message: string,
  ): AssetServiceResult<never> {
    switch (code) {
      case "encryption-key-resolution-invalid-request":
        return this.failure(AssetServiceErrorCodes.invalidRequest, message);
      case "encryption-key-resolution-policy-violation":
        return this.failure(AssetServiceErrorCodes.policyViolation, message);
      case "encryption-key-resolution-key-unavailable":
      case "encryption-key-resolution-not-found":
        return this.failure(AssetServiceErrorCodes.invalidState, message);
      case "encryption-key-resolution-failed":
      default:
        return this.failure(AssetServiceErrorCodes.internal, message);
    }
  }

  private async publishAuditEvent(event: Parameters<AssetAuditSink["recordAssetEvent"]>[0]): Promise<void> {
    await publishAssetAuditEventBestEffort(this.dependencies.auditSink, event);
  }

  private async publishRejectedAuditEvent(input: {
    readonly occurredAt: string;
    readonly workspaceId: string;
    readonly actorUserId: string;
    readonly correlationId?: string;
    readonly operationKey: string;
    readonly assetId: string;
    readonly uploadSessionId: string;
    readonly reasonCode: string;
  }): Promise<void> {
    await this.publishAuditEvent({
      type: "asset-upload-finalized",
      occurredAt: input.occurredAt,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      operationKey: input.operationKey,
      outcome: "rejected",
      asset: {
        assetId: input.assetId,
      },
      details: Object.freeze({
        uploadSessionId: input.uploadSessionId,
        reasonCode: input.reasonCode,
      }),
    });
  }

  private async publishEncryptionEvent(
    event: Parameters<typeof publishEncryptionEnforcementEventBestEffort>[1],
  ): Promise<void> {
    await publishEncryptionEnforcementEventBestEffort(this.dependencies.encryptionObservabilityPort, event);
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

function normalizeOptionalIncomingMimeType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeMimeType(value);
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function isCompatibleMimeType(actual: string, expected: string): boolean {
  return normalizeMimeType(actual) === normalizeMimeType(expected);
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

function resolveUploadFailureMessage(error: unknown): string {
  if (error instanceof UploadPayloadTooLargeError) {
    return "Upload payload exceeded expected size.";
  }
  if (error instanceof StorageObjectAccessError) {
    return "Storage write failed during upload finalization.";
  }
  if (error instanceof AssetDomainError) {
    return "Asset metadata validation failed during upload finalization.";
  }
  return "Upload ingestion failed.";
}

function buildAssetContentAad(input: {
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly objectKey: string;
  readonly area: string;
}): string {
  return [
    "asset-content-encryption/v1",
    `workspace=${input.workspaceId}`,
    `storage=${input.storageInstanceId}`,
    `asset=${input.assetId}`,
    `version=${input.versionId}`,
    `area=${input.area}`,
    `object=${input.objectKey}`,
  ].join(";");
}

