import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
  type IStorageLogicalAccessResolutionService,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GeneratedResultDerivativeAvailabilityStatuses } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import type { IGeneratedResultPreviewAccessPort } from "../ports/GeneratedResultPreviewGenerationPorts";
import type { IGeneratedResultPersistenceRepository } from "../ports/IGeneratedResultPersistenceRepository";
import {
  GeneratedResultAuditEventTypes,
  GeneratedResultAuditOutcomes,
  publishGeneratedResultAuditEventBestEffort,
  type GeneratedResultAuditSink,
} from "../ports/GeneratedResultAuditPort";
import {
  GeneratedResultPreviewContentReadErrorCodes,
  validateOpenGeneratedResultPreviewContentRequest,
  type GeneratedResultPreviewContentReadResult,
  type IOpenGeneratedResultPreviewContentUseCase,
  type OpenGeneratedResultPreviewContentRequest,
  type OpenGeneratedResultPreviewContentSuccess,
} from "./GetGeneratedResultPreviewContentUseCaseContracts";

export interface OpenGeneratedResultPreviewContentUseCaseDependencies {
  readonly generatedResultRepository: IGeneratedResultPersistenceRepository;
  readonly storageLogicalAccessResolutionService: IStorageLogicalAccessResolutionService;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly previewAccessPort: IGeneratedResultPreviewAccessPort;
  readonly auditSink?: GeneratedResultAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class OpenGeneratedResultPreviewContentUseCase implements IOpenGeneratedResultPreviewContentUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: OpenGeneratedResultPreviewContentUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: OpenGeneratedResultPreviewContentRequest,
  ): Promise<GeneratedResultPreviewContentReadResult<OpenGeneratedResultPreviewContentSuccess>> {
    let request: OpenGeneratedResultPreviewContentRequest;
    try {
      request = validateOpenGeneratedResultPreviewContentRequest(input);
    } catch (error) {
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid generated-result preview-open request.",
      );
    }

    const occurredAt = request.occurredAt ?? this.clock.now().toISOString();
    const workspaceAuthorization = await this.resolveWorkspaceAuthorization(
      request.workspaceId,
      request.actorUserId,
      occurredAt,
    );
    if (!workspaceAuthorization.isAuthorized) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: "workspace-membership-required",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.accessDenied,
        "Generated-result preview retrieval requires active workspace membership.",
      );
    }

    const result = await this.dependencies.generatedResultRepository.findResultById(request.resultAssetId);
    if (!result || result.workspaceId !== request.workspaceId) {
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    if (
      result.visibility === AssetVisibilities.private
      && result.ownerUserId
      && result.ownerUserId !== request.actorUserId
      && !workspaceAuthorization.isWorkspaceAdmin
    ) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: "authorization-denied",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.notFound,
        "Generated result was not found for the workspace.",
      );
    }

    const accessHandle = `preview-access://generated-results/${request.previewToken}`;
    const resolvedAccess = this.dependencies.previewAccessPort.resolvePreviewAccessDescriptor({
      accessHandle,
    });
    if (
      !resolvedAccess
      || resolvedAccess.workspaceId !== request.workspaceId
      || resolvedAccess.resultAssetId !== request.resultAssetId
    ) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: "preview-token-stale-or-invalid",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.invalidState,
        "Generated-result preview token is stale or invalid. Request a new preview.",
        Object.freeze({
          staleRequest: true,
          reasonCode: "preview-token-stale-or-invalid",
        }),
      );
    }

    const previews = await this.dependencies.generatedResultRepository.listPreviewsByResultId(result.resultAssetId);
    const descriptor = previews.find((preview) =>
      preview.derivativeId === resolvedAccess.derivativeId && preview.accessHandle === accessHandle
    );
    if (!descriptor) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: "preview-token-stale-or-invalid",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.invalidState,
        "Generated-result preview token is stale or invalid. Request a new preview.",
        Object.freeze({
          staleRequest: true,
          reasonCode: "preview-token-stale-or-invalid",
        }),
      );
    }

    if (
      descriptor.availabilityStatus !== GeneratedResultDerivativeAvailabilityStatuses.available
      && descriptor.availabilityStatus !== GeneratedResultDerivativeAvailabilityStatuses.stale
    ) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: descriptor.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.pending
          ? "preview-pending"
          : descriptor.failureCode ?? "preview-failed",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.invalidState,
        "Generated-result preview is not available for retrieval.",
        Object.freeze({
          reasonCode: descriptor.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.pending
            ? "preview-pending"
            : descriptor.failureCode ?? "preview-failed",
        }),
      );
    }

    if (!descriptor.mediaType) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: "preview-media-type-missing",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.invalidState,
        "Generated-result preview media type is unavailable.",
        Object.freeze({
          reasonCode: "preview-media-type-missing",
        }),
      );
    }

    const resolution = await this.dependencies.storageLogicalAccessResolutionService.resolveLogicalAccessPlan({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserId,
      storageInstanceId: resolvedAccess.storageInstanceId,
      intent: StorageLogicalAccessOperationIntents.openObjectReadStream,
      occurredAt,
    });
    if (!resolution.ok) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: `storage-resolution-${resolution.error.code}`,
      });
      return this.failure(
        mapResolutionErrorCode(resolution.error.code),
        resolution.error.message,
      );
    }

    try {
      const metadata = await resolution.value.objectPort.readObjectMetadata({
        storageInstance: resolution.value.storageInstance,
        objectKey: resolvedAccess.objectKey,
      });
      const stream = await resolution.value.objectPort.openObjectReadStream({
        storageInstance: resolution.value.storageInstance,
        objectKey: resolvedAccess.objectKey,
      });
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.success,
        details: Object.freeze({
          previewKind: descriptor.previewKind,
          derivativeId: descriptor.derivativeId,
          responseSizeBytes: metadata.sizeBytes,
        }),
      });
      return {
        ok: true,
        value: Object.freeze({
          resultAssetId: result.resultAssetId,
          workspaceId: result.workspaceId,
          mediaType: descriptor.mediaType,
          sizeBytes: metadata.sizeBytes,
          contentDisposition: "inline",
          contentDispositionFileName: createPreviewFilename(result.resultAssetId, descriptor.mediaType),
          stream,
        }),
      };
    } catch {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        result,
        outcome: GeneratedResultAuditOutcomes.rejected,
        reasonCode: "preview-content-open-unavailable",
      });
      return this.failure(
        GeneratedResultPreviewContentReadErrorCodes.contentUnavailable,
        "Generated-result preview content is not currently available.",
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

  private failure(
    code: typeof GeneratedResultPreviewContentReadErrorCodes[keyof typeof GeneratedResultPreviewContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GeneratedResultPreviewContentReadResult<never> {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }

  private async publishPreviewOpenAuditEvent(input: {
    readonly request: OpenGeneratedResultPreviewContentRequest;
    readonly occurredAt: string;
    readonly outcome: typeof GeneratedResultAuditOutcomes[keyof typeof GeneratedResultAuditOutcomes];
    readonly result?: Awaited<ReturnType<IGeneratedResultPersistenceRepository["findResultById"]>>;
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishGeneratedResultAuditEventBestEffort(this.dependencies.auditSink, {
      type: GeneratedResultAuditEventTypes.previewContentOpened,
      occurredAt: input.occurredAt,
      workspaceId: input.request.workspaceId,
      actorUserId: input.request.actorUserId,
      correlationId: input.request.correlationId,
      operationKey: undefined,
      outcome: input.outcome,
      result: Object.freeze({
        resultAssetId: input.request.resultAssetId,
        runId: input.result?.runId,
        workflowId: input.result?.workflowId,
        systemId: input.result?.systemId,
        executionNodeId: input.result?.executionNodeId,
        storageInstanceId: input.result?.storageInstanceId,
        visibility: input.result?.visibility,
        lifecycleStatus: input.result?.status,
        mediaType: input.result?.mediaType,
      }),
      details: Object.freeze({
        reasonCode: input.reasonCode,
        ...(input.details ?? {}),
      }),
    });
  }
}

function mapResolutionErrorCode(code: string): typeof GeneratedResultPreviewContentReadErrorCodes[keyof typeof GeneratedResultPreviewContentReadErrorCodes] {
  switch (code) {
    case StorageLogicalAccessResolutionErrorCodes.invalidRequest:
      return GeneratedResultPreviewContentReadErrorCodes.invalidRequest;
    case StorageLogicalAccessResolutionErrorCodes.notFound:
      return GeneratedResultPreviewContentReadErrorCodes.notFound;
    case StorageLogicalAccessResolutionErrorCodes.policyViolation:
      return GeneratedResultPreviewContentReadErrorCodes.accessDenied;
    default:
      return GeneratedResultPreviewContentReadErrorCodes.internal;
  }
}

function createPreviewFilename(resultAssetId: string, mediaType: string): string {
  const extension = mediaTypeToExtension(mediaType);
  const safeId = resultAssetId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-");
  return `${safeId || "generated-result-preview"}.${extension}`;
}

function mediaTypeToExtension(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/bmp":
      return "bmp";
    case "image/tiff":
      return "tiff";
    case "image/avif":
      return "avif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}
