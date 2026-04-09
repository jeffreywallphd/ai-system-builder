import { createHash } from "node:crypto";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import {
  GeneratedResultDerivativeAvailabilityStatuses,
  GeneratedResultPreviewKinds,
  type GeneratedResultPreviewKind,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
  type IStorageLogicalAccessResolutionService,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import { isStorageObjectAccessError } from "@application/storage/ports/StorageObjectPort";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import type {
  IGeneratedResultPreviewAccessPort,
  IGeneratedResultPreviewImageProcessorPort,
} from "../ports/GeneratedResultPreviewGenerationPorts";
import {
  resolveGeneratedResultStorageObjectLookup,
} from "./GeneratedResultStorageObjectReference";
import {
  GenerateGeneratedResultPreviewErrorCodes,
  validateGenerateGeneratedResultPreviewRequest,
  type GenerateGeneratedResultPreviewErrorCode,
  type GenerateGeneratedResultPreviewRequest,
  type GenerateGeneratedResultPreviewResult,
  type GenerateGeneratedResultPreviewSuccess,
  type IGenerateGeneratedResultPreviewUseCase,
} from "./GenerateGeneratedResultPreviewUseCaseContracts";
import type {
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";

const DefaultMaxSourceBytes = 64 * 1024 * 1024;
const SupportedSourceMediaTypePattern = /^image\/[a-z0-9.+-]+$/;

const PreviewProfiles = Object.freeze({
  [GeneratedResultPreviewKinds.thumbnail]: Object.freeze({
    maxWidth: 320,
    maxHeight: 320,
    quality: 72,
    mediaType: "image/webp" as const,
  }),
  [GeneratedResultPreviewKinds.displaySafe]: Object.freeze({
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 82,
    mediaType: "image/webp" as const,
  }),
  [GeneratedResultPreviewKinds.historySafe]: Object.freeze({
    maxWidth: 768,
    maxHeight: 768,
    quality: 76,
    mediaType: "image/webp" as const,
  }),
});

export interface GenerateGeneratedResultPreviewUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly storageLogicalAccessResolutionService: IStorageLogicalAccessResolutionService;
  readonly previewImageProcessorPort: IGeneratedResultPreviewImageProcessorPort;
  readonly previewAccessPort: IGeneratedResultPreviewAccessPort;
  readonly maxSourceBytes?: number;
  readonly clock?: {
    now(): Date;
  };
}

export class GenerateGeneratedResultPreviewUseCase implements IGenerateGeneratedResultPreviewUseCase {
  private readonly clock: { now(): Date };
  private readonly maxSourceBytes: number;

  public constructor(private readonly dependencies: GenerateGeneratedResultPreviewUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };

    const maxSourceBytes = dependencies.maxSourceBytes ?? DefaultMaxSourceBytes;
    this.maxSourceBytes = Number.isInteger(maxSourceBytes) && maxSourceBytes > 0
      ? maxSourceBytes
      : DefaultMaxSourceBytes;
  }

  public async execute(
    input: GenerateGeneratedResultPreviewRequest,
  ): Promise<GenerateGeneratedResultPreviewResult<GenerateGeneratedResultPreviewSuccess>> {
    let request: GenerateGeneratedResultPreviewRequest;
    try {
      request = validateGenerateGeneratedResultPreviewRequest(input);
    } catch (error) {
      return this.failure(
        GenerateGeneratedResultPreviewErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result preview-generation request.",
        false,
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const previewKind = request.previewKind ?? GeneratedResultPreviewKinds.displaySafe;
    const previewProfile = PreviewProfiles[previewKind];
    if (!previewProfile) {
      return this.failure(
        GenerateGeneratedResultPreviewErrorCodes.invalidRequest,
        `Unsupported preview kind '${previewKind}'.`,
        false,
      );
    }

    const result = await this.dependencies.generatedResultRepository.findResultById(request.resultAssetId);
    if (!result || result.workspaceId !== request.workspaceId) {
      return this.failure(
        GenerateGeneratedResultPreviewErrorCodes.notFound,
        "Generated result was not found for the workspace.",
        false,
      );
    }

    if (
      result.status !== GeneratedResultAssetStatuses.available
      && result.status !== GeneratedResultAssetStatuses.previewReady
      && result.status !== GeneratedResultAssetStatuses.archived
    ) {
      return this.failure(
        GenerateGeneratedResultPreviewErrorCodes.invalidState,
        `Generated result '${result.resultAssetId}' is not preview-generatable in status '${result.status}'.`,
        false,
      );
    }

    const sourceMediaType = result.mediaType;
    if (!sourceMediaType || !SupportedSourceMediaTypePattern.test(sourceMediaType)) {
      return this.failure(
        GenerateGeneratedResultPreviewErrorCodes.invalidState,
        "Generated result mediaType is not an image type supported for preview generation.",
        false,
      );
    }

    const derivativeId = toPreviewDerivativeId(result.resultAssetId, previewKind);
    const existingPreviews = await this.dependencies.generatedResultRepository.listPreviewsByResultId(result.resultAssetId);
    const existingForKind = existingPreviews.find((entry) => entry.previewKind === previewKind);
    if (
      existingForKind
      && existingForKind.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.available
      && !request.forceRegenerate
    ) {
      if (!existingForKind.protectedResourceId || !existingForKind.accessHandle) {
        return this.failure(
          GenerateGeneratedResultPreviewErrorCodes.invalidState,
          "Existing preview descriptor is missing protected access metadata.",
          false,
        );
      }

      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          derivativeId: existingForKind.derivativeId,
          previewKind: existingForKind.previewKind,
          mediaType: existingForKind.mediaType ?? "image/webp",
          width: existingForKind.width ?? 1,
          height: existingForKind.height ?? 1,
          byteSize: existingForKind.byteSize ?? 1,
          protectedResourceId: existingForKind.protectedResourceId,
          accessHandle: existingForKind.accessHandle,
          status: "reused",
        }),
      };
    }

    const sourceReference = resolveGeneratedResultStorageObjectLookup({
      storageInstanceId: result.storageInstanceId,
      storageBindingReference: result.storageBindingReference,
      logicalAssetVersionId: result.logicalAssetVersionId,
    });
    if (!sourceReference) {
      const failure = await this.persistFailedPreview({
        result,
        existingPreview: existingForKind,
        derivativeId,
        previewKind,
        occurredAt,
        actorUserId: request.actorUserId,
        failureCode: "preview-source-reference-unavailable",
        failureMessage: "Generated result source reference is not available for preview generation.",
        resultCode: GenerateGeneratedResultPreviewErrorCodes.sourceUnavailable,
        retryable: false,
        operationKey: request.operationKey,
        correlationId: request.correlationId,
      });
      return this.failure(
        failure.code,
        failure.message,
        failure.retryable,
      );
    }

    try {
      const readPlan = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
        workspaceId: request.workspaceId,
        actorUserIdentityId: request.actorUserId,
        storageInstanceId: sourceReference.storageInstanceId,
        intent: StorageLogicalAccessOperationIntents.openObjectReadStream,
        occurredAt,
      });
      if (!readPlan.ok) {
        return this.failure(
          mapStorageResolutionErrorCode(readPlan.error.code),
          readPlan.error.message,
          isStorageResolutionRetryable(readPlan.error.code),
        );
      }

      const sourceStream = await readPlan.value.objectPort.openObjectReadStream({
        storageInstance: readPlan.value.storageInstance,
        objectKey: sourceReference.objectKey,
      });
      const sourceContent = await readStreamToBuffer(sourceStream, this.maxSourceBytes);

      const processed = await this.dependencies.previewImageProcessorPort.generatePreviewDerivative({
        sourceContent,
        sourceMediaType,
        previewKind,
        profile: previewProfile,
      });

      const createKeyPlan = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
        workspaceId: request.workspaceId,
        actorUserIdentityId: request.actorUserId,
        storageInstanceId: result.storageInstanceId,
        intent: StorageLogicalAccessOperationIntents.createObjectKey,
        occurredAt,
      });
      if (!createKeyPlan.ok) {
        return this.failure(
          mapStorageResolutionErrorCode(createKeyPlan.error.code),
          createKeyPlan.error.message,
          isStorageResolutionRetryable(createKeyPlan.error.code),
        );
      }

      const objectKey = createKeyPlan.value.objectPort.createObjectKey({
        storageInstance: createKeyPlan.value.storageInstance,
        namespace: "workspaces",
        logicalPathSegments: Object.freeze([
          request.workspaceId,
          "generated-results",
          result.resultAssetId,
          "previews",
          previewKind,
        ]),
        originalFileName: `${previewKind}.webp`,
        contentDigest: createHash("sha256").update(processed.content).digest("hex"),
        occurredAt,
      }).objectKey;

      const writePlan = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
        workspaceId: request.workspaceId,
        actorUserIdentityId: request.actorUserId,
        storageInstanceId: result.storageInstanceId,
        intent: StorageLogicalAccessOperationIntents.writeObject,
        occurredAt,
      });
      if (!writePlan.ok) {
        return this.failure(
          mapStorageResolutionErrorCode(writePlan.error.code),
          writePlan.error.message,
          isStorageResolutionRetryable(writePlan.error.code),
        );
      }

      await writePlan.value.objectPort.writeObject({
        reference: {
          storageInstance: writePlan.value.storageInstance,
          objectKey,
        },
        content: processed.content,
        overwriteExisting: true,
      });

      const access = this.dependencies.previewAccessPort.createPreviewAccessDescriptor({
        workspaceId: request.workspaceId,
        resultAssetId: result.resultAssetId,
        derivativeId,
        previewKind,
        storageInstanceId: result.storageInstanceId,
        objectKey,
        occurredAt,
      });

      const savedPreview = await this.dependencies.generatedResultRepository.savePreview(
        this.createAvailablePreviewRecord({
          result,
          existingPreview: existingForKind,
          derivativeId,
          previewKind,
          occurredAt,
          actorUserId: request.actorUserId,
          mediaType: processed.mediaType,
          width: processed.width,
          height: processed.height,
          byteSize: processed.byteSize,
          protectedResourceId: access.protectedResourceId,
          accessHandle: access.accessHandle,
        }),
        {
          operationKey: `${request.operationKey}:preview:${derivativeId}`,
          context: Object.freeze({
            actorUserId: request.actorUserId,
            occurredAt,
            correlationId: request.correlationId,
            reason: "generated-result-preview-generation",
          }),
          expectedRevision: existingForKind?.revision,
        },
      );

      await this.transitionResultToPreviewReadyIfNeeded({
        result,
        actorUserId: request.actorUserId,
        occurredAt,
        operationKey: request.operationKey,
        correlationId: request.correlationId,
      });

      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          derivativeId: savedPreview.record.derivativeId,
          previewKind: savedPreview.record.previewKind,
          mediaType: savedPreview.record.mediaType ?? "image/webp",
          width: savedPreview.record.width ?? processed.width,
          height: savedPreview.record.height ?? processed.height,
          byteSize: savedPreview.record.byteSize ?? processed.byteSize,
          protectedResourceId: savedPreview.record.protectedResourceId ?? access.protectedResourceId,
          accessHandle: savedPreview.record.accessHandle ?? access.accessHandle,
          status: "generated",
        }),
      };
    } catch (error) {
      const failureCode = isStorageObjectAccessError(error)
        ? "preview-storage-operation-failed"
        : "preview-processing-failed";
      const failureMessage = isStorageObjectAccessError(error)
        ? "Generated-result preview storage operation failed."
        : "Generated-result preview processing failed.";

      const persistedFailure = await this.persistFailedPreview({
        result,
        existingPreview: existingForKind,
        derivativeId,
        previewKind,
        occurredAt,
        actorUserId: request.actorUserId,
        failureCode,
        failureMessage,
        operationKey: request.operationKey,
        correlationId: request.correlationId,
      });

      return this.failure(
        persistedFailure.code,
        persistedFailure.message,
        persistedFailure.retryable,
      );
    }
  }

  private createAvailablePreviewRecord(input: {
    readonly result: GeneratedResultPersistenceRecord;
    readonly existingPreview?: GeneratedResultPreviewPersistenceRecord;
    readonly derivativeId: string;
    readonly previewKind: GeneratedResultPreviewKind;
    readonly occurredAt: string;
    readonly actorUserId: string;
    readonly mediaType: NonNullable<GeneratedResultPreviewPersistenceRecord["mediaType"]>;
    readonly width: number;
    readonly height: number;
    readonly byteSize: number;
    readonly protectedResourceId: string;
    readonly accessHandle: string;
  }): GeneratedResultPreviewPersistenceRecord {
    const isPrimaryPreview = input.previewKind === GeneratedResultPreviewKinds.displaySafe
      || !input.existingPreview?.isPrimaryPreview;

    return Object.freeze({
      derivativeId: input.derivativeId,
      resultAssetId: input.result.resultAssetId,
      resultLogicalAssetVersionId: input.result.logicalAssetVersionId,
      previewKind: input.previewKind,
      availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.available,
      isPrimaryPreview,
      protectedResourceId: input.protectedResourceId,
      accessHandle: input.accessHandle,
      mediaType: input.mediaType,
      width: input.width,
      height: input.height,
      byteSize: input.byteSize,
      generatedAt: input.occurredAt,
      failureCode: undefined,
      failureMessage: undefined,
      tenancy: input.result.tenancy,
      createdAt: input.existingPreview?.createdAt ?? input.occurredAt,
      createdBy: input.existingPreview?.createdBy ?? input.actorUserId,
      lastModifiedAt: input.occurredAt,
      lastModifiedBy: input.actorUserId,
      revision: input.existingPreview?.revision ?? 1,
      schemaVersion: input.existingPreview?.schemaVersion ?? 1,
    });
  }

  private async transitionResultToPreviewReadyIfNeeded(input: {
    readonly result: GeneratedResultPersistenceRecord;
    readonly actorUserId: string;
    readonly occurredAt: string;
    readonly operationKey: string;
    readonly correlationId?: string;
  }): Promise<void> {
    if (input.result.status !== GeneratedResultAssetStatuses.available) {
      return;
    }

    await this.dependencies.generatedResultRepository.saveResult(
      Object.freeze({
        ...input.result,
        status: GeneratedResultAssetStatuses.previewReady,
        previewReadyAt: input.occurredAt,
        previewReadyBy: input.actorUserId,
        lastModifiedAt: input.occurredAt,
        lastModifiedBy: input.actorUserId,
      }),
      {
        operationKey: `${input.operationKey}:result:${input.result.resultAssetId}:preview-ready`,
        context: Object.freeze({
          actorUserId: input.actorUserId,
          occurredAt: input.occurredAt,
          correlationId: input.correlationId,
          reason: "generated-result-preview-ready",
        }),
        expectedRevision: input.result.revision,
      },
    );
  }

  private async persistFailedPreview(input: {
    readonly result: GeneratedResultPersistenceRecord;
    readonly existingPreview?: GeneratedResultPreviewPersistenceRecord;
    readonly derivativeId: string;
    readonly previewKind: GeneratedResultPreviewKind;
    readonly occurredAt: string;
    readonly actorUserId: string;
    readonly failureCode: string;
    readonly failureMessage: string;
    readonly resultCode?: GenerateGeneratedResultPreviewErrorCode;
    readonly retryable?: boolean;
    readonly operationKey: string;
    readonly correlationId?: string;
  }): Promise<{ readonly code: GenerateGeneratedResultPreviewErrorCode; readonly message: string; readonly retryable: boolean }> {
    try {
      await this.dependencies.generatedResultRepository.savePreview(Object.freeze({
        derivativeId: input.derivativeId,
        resultAssetId: input.result.resultAssetId,
        resultLogicalAssetVersionId: input.result.logicalAssetVersionId,
        previewKind: input.previewKind,
        availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
        isPrimaryPreview: input.previewKind === GeneratedResultPreviewKinds.displaySafe,
        protectedResourceId: undefined,
        accessHandle: undefined,
        mediaType: undefined,
        width: undefined,
        height: undefined,
        byteSize: undefined,
        generatedAt: undefined,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        tenancy: input.result.tenancy,
        createdAt: input.existingPreview?.createdAt ?? input.occurredAt,
        createdBy: input.existingPreview?.createdBy ?? input.actorUserId,
        lastModifiedAt: input.occurredAt,
        lastModifiedBy: input.actorUserId,
        revision: input.existingPreview?.revision ?? 1,
        schemaVersion: input.existingPreview?.schemaVersion ?? 1,
      }), {
        operationKey: `${input.operationKey}:preview:${input.derivativeId}:failed`,
        context: Object.freeze({
          actorUserId: input.actorUserId,
          occurredAt: input.occurredAt,
          correlationId: input.correlationId,
          reason: "generated-result-preview-generation-failed",
        }),
        expectedRevision: input.existingPreview?.revision,
      });
    } catch {
      return Object.freeze({
        code: GenerateGeneratedResultPreviewErrorCodes.storageUnavailable,
        message: "Generated-result preview failure state could not be persisted.",
        retryable: true,
      });
    }

    const retryable = input.retryable ?? input.failureCode.includes("storage");
    return Object.freeze({
      code: input.resultCode
        ?? (retryable
          ? GenerateGeneratedResultPreviewErrorCodes.storageUnavailable
          : GenerateGeneratedResultPreviewErrorCodes.processingFailed),
      message: input.failureMessage,
      retryable,
    });
  }

  private failure(
    code: GenerateGeneratedResultPreviewErrorCode,
    message: string,
    retryable: boolean,
    details?: Readonly<Record<string, unknown>>,
  ): GenerateGeneratedResultPreviewResult<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        retryable,
        details,
      }),
    };
  }
}

async function readStreamToBuffer(stream: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error(`Generated-result preview source exceeds size limit (${String(maxBytes)} bytes).`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((entry) => Buffer.from(entry)));
}

function mapStorageResolutionErrorCode(code: string): GenerateGeneratedResultPreviewErrorCode {
  switch (code) {
    case StorageLogicalAccessResolutionErrorCodes.invalidRequest:
      return GenerateGeneratedResultPreviewErrorCodes.invalidRequest;
    case StorageLogicalAccessResolutionErrorCodes.notFound:
      return GenerateGeneratedResultPreviewErrorCodes.sourceUnavailable;
    case StorageLogicalAccessResolutionErrorCodes.policyViolation:
      return GenerateGeneratedResultPreviewErrorCodes.invalidState;
    case StorageLogicalAccessResolutionErrorCodes.capabilityUnsupported:
      return GenerateGeneratedResultPreviewErrorCodes.invalidState;
    default:
      return GenerateGeneratedResultPreviewErrorCodes.storageUnavailable;
  }
}

function isStorageResolutionRetryable(code: string): boolean {
  return code === StorageLogicalAccessResolutionErrorCodes.internal;
}

function toPreviewDerivativeId(resultAssetId: string, previewKind: GeneratedResultPreviewKind): string {
  return `preview-${previewKind}-${createHash("sha256").update(`${resultAssetId}:${previewKind}`).digest("hex").slice(0, 20)}`;
}
