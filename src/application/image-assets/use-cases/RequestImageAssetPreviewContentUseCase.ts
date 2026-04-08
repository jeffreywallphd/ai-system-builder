import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
} from "@domain/authorization/AuthorizationDomain";
import { ImageAssetStatuses, type ImageAsset } from "@domain/image-assets/ImageAssetDomain";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  ImageAssetAccessActions,
  createImageAssetAuthorizationResourceContext,
  toImageAssetPolicyDecisionEvaluationRequest,
} from "@shared/contracts/assets/ImageAssetAuthorizationContracts";
import type { IImageAssetRepository } from "../ports/IImageAssetRepository";
import {
  ImageAssetAuditEventTypes,
  ImageAssetAuditOutcomes,
  publishImageAssetAuditEventBestEffort,
  type ImageAssetAuditSink,
} from "../ports/ImageAssetAuditPort";
import {
  ImageAssetStorageAccessPurposes,
  ImageAssetStorageObjectAreas,
  isImageAssetStorageError,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import {
  ImageAssetPreviewAvailabilityStatuses,
  ImageAssetPreviewContentReadErrorCodes,
  validateRequestImageAssetPreviewContentRequest,
  type IRequestImageAssetPreviewContentUseCase,
  type ImageAssetPreviewContentReadResult,
  type RequestImageAssetPreviewContentRequest,
  type RequestImageAssetPreviewContentSuccess,
} from "./GetImageAssetPreviewContentUseCaseContracts";
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

const DefaultPreviewAccessExpirySeconds = 5 * 60;
const MaxPreviewAccessExpirySeconds = 60 * 60;

export interface RequestImageAssetPreviewContentUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly auditSink?: ImageAssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class RequestImageAssetPreviewContentUseCase implements IRequestImageAssetPreviewContentUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: RequestImageAssetPreviewContentUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: RequestImageAssetPreviewContentRequest,
  ): Promise<ImageAssetPreviewContentReadResult<RequestImageAssetPreviewContentSuccess>> {
    let request: RequestImageAssetPreviewContentRequest;
    try {
      request = validateRequestImageAssetPreviewContentRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset preview request.",
        undefined,
        {
          reason: "preview-request-invalid",
          kind: ImageAssetFailureDefaults.kind.validation,
          summaryCategory: ImageAssetFailureDefaults.summary.validation,
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
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "workspace-membership-required",
      });
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.accessDenied,
        "Image asset preview access requires active workspace membership.",
        undefined,
        {
          reason: "workspace-membership-required",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.unknown,
        },
      );
    }

    const imageAsset = await this.dependencies.imageAssetRepository.findImageAssetById(request.assetId, {
      includeDeleted: true,
    });
    if (!imageAsset || imageAsset.workspaceId !== request.workspaceId || imageAsset.lifecycle.status === ImageAssetStatuses.deleted) {
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
        undefined,
        {
          reason: "asset-not-found",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.unknown,
        },
      );
    }

    const allowed = await this.canRequestPreview(imageAsset, request.actorUserId, occurredAt, authorization.isWorkspaceAdmin);
    if (!allowed) {
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "authorization-denied",
      });
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
        undefined,
        {
          reason: "authorization-denied",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.unknown,
        },
      );
    }

    if (imageAsset.lifecycle.status === ImageAssetStatuses.ingesting || imageAsset.lifecycle.status === ImageAssetStatuses.failed) {
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          availabilityStatus: ImageAssetPreviewAvailabilityStatuses.pendingGeneration,
          resolvedFrom: "derived-preview",
        }),
      });
      return {
        ok: true,
        value: Object.freeze({
          assetId: imageAsset.assetId,
          workspaceId: imageAsset.workspaceId,
          representation: request.representation ?? "gallery",
          status: ImageAssetPreviewAvailabilityStatuses.pendingGeneration,
          mediaType: undefined,
          resolvedFrom: "derived-preview",
        }),
      };
    }

    const preferredMediaTypes = request.preferredMediaTypes ?? [];
    if (preferredMediaTypes.length > 0 && !preferredMediaTypes.includes(imageAsset.mediaType)) {
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          availabilityStatus: ImageAssetPreviewAvailabilityStatuses.pendingGeneration,
          resolvedFrom: "derived-preview",
        }),
      });
      return {
        ok: true,
        value: Object.freeze({
          assetId: imageAsset.assetId,
          workspaceId: imageAsset.workspaceId,
          representation: request.representation ?? "gallery",
          status: ImageAssetPreviewAvailabilityStatuses.pendingGeneration,
          mediaType: undefined,
          resolvedFrom: "derived-preview",
        }),
      };
    }

    const reference = await this.dependencies.imageAssetRepository.getImageAssetOriginalObjectReference(imageAsset.assetId);
    if (!reference) {
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          availabilityStatus: ImageAssetPreviewAvailabilityStatuses.unavailable,
          resolvedFrom: "original-fallback",
        }),
      });
      return {
        ok: true,
        value: Object.freeze({
          assetId: imageAsset.assetId,
          workspaceId: imageAsset.workspaceId,
          representation: request.representation ?? "gallery",
          status: ImageAssetPreviewAvailabilityStatuses.unavailable,
          mediaType: undefined,
          resolvedFrom: "original-fallback",
        }),
      };
    }

    if (reference.storageInstanceId !== imageAsset.storageInstanceId) {
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.invalidState,
        "Image asset preview reference does not match current storage instance binding.",
        undefined,
        {
          reason: "preview-reference-storage-mismatch",
          kind: ImageAssetFailureDefaults.kind.validation,
          summaryCategory: ImageAssetFailureDefaults.summary.validation,
        },
      );
    }

    try {
      const expiresInSeconds = clampPreviewExpirySeconds(request.expiresInSeconds);
      const access = await this.dependencies.imageAssetStoragePort.createAccessHandle({
        workspaceId: request.workspaceId,
        assetId: imageAsset.assetId,
        actorUserId: request.actorUserId,
        purpose: ImageAssetStorageAccessPurposes.inlinePreview,
        reference: Object.freeze({
          storageInstanceId: reference.storageInstanceId,
          objectKey: reference.objectKey,
          objectVersionId: reference.objectVersionId,
          area: ImageAssetStorageObjectAreas.original,
        }),
        expiresInSeconds,
        occurredAt,
      });
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          availabilityStatus: ImageAssetPreviewAvailabilityStatuses.available,
          resolvedFrom: "original-fallback",
          expiresAt: access.expiresAt,
          requestedExpirySeconds: expiresInSeconds,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          assetId: imageAsset.assetId,
          workspaceId: imageAsset.workspaceId,
          representation: request.representation ?? "gallery",
          status: ImageAssetPreviewAvailabilityStatuses.available,
          mediaType: imageAsset.mediaType,
          resolvedFrom: "original-fallback",
          access: Object.freeze({
            previewToken: access.handleToken,
            expiresAt: access.expiresAt,
          }),
        }),
      };
    } catch (error) {
      if (isImageAssetStorageError(error)) {
        await this.publishPreviewRequestAuditEvent({
          request,
          occurredAt,
          imageAsset,
          outcome: ImageAssetAuditOutcomes.rejected,
          reasonCode: "preview-content-unavailable",
        });
        return this.failure(
          ImageAssetPreviewContentReadErrorCodes.contentUnavailable,
          "Image asset preview is not currently available.",
          undefined,
          {
            reason: "preview-content-unavailable",
            kind: ImageAssetFailureDefaults.kind.operational,
            summaryCategory: ImageAssetFailureDefaults.summary.output,
            retryable: true,
            resilience: {
              code: "preview-temporarily-unavailable",
              scope: ImageManipulationResilienceScopes.previewReadiness,
              state: ImageManipulationResilienceStateKinds.temporarilyUnavailable,
              summary: "Preview content is temporarily unavailable.",
              durability: ImageManipulationResilienceDurabilityClasses.temporary,
              recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
              recoveryRetryable: true,
              recoveryRetryAfterMs: 3000,
            },
          },
        );
      }
      await this.publishPreviewRequestAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.failed,
        reasonCode: "preview-request-failed",
      });
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset preview request failed.",
        undefined,
        {
          reason: "preview-request-failed",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.internal,
          resilience: {
            code: "preview-readiness-degraded",
            scope: ImageManipulationResilienceScopes.previewReadiness,
            state: ImageManipulationResilienceStateKinds.degraded,
            summary: "Preview readiness degraded by backend failure.",
            durability: ImageManipulationResilienceDurabilityClasses.unknown,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
            recoveryRetryable: isImageAssetStorageError(error) ? error.retryable : false,
            recoveryRetryAfterMs: 3000,
          },
          retryable: isImageAssetStorageError(error) ? error.retryable : false,
        },
      );
    }
  }

  private async canRequestPreview(
    imageAsset: ImageAsset,
    actorUserId: string,
    occurredAt: string,
    isWorkspaceAdmin: boolean,
  ): Promise<boolean> {
    const evaluator = this.dependencies.authorizationPolicyDecisionEvaluator;
    if (!evaluator) {
      if (imageAsset.visibility === ResourceVisibilities.private) {
        return imageAsset.ownerUserId === actorUserId || isWorkspaceAdmin;
      }
      return true;
    }

    const ownershipScope = imageAsset.ownerUserId
      ? ResourceOwnershipScopes.userPrivate
      : ResourceOwnershipScopes.workspace;
    const publishedAt = imageAsset.visibility === ResourceVisibilities.published
      ? imageAsset.lifecycle.ingestedAt ?? imageAsset.updatedAt
      : undefined;

    const resource = createImageAssetAuthorizationResourceContext({
      assetId: imageAsset.assetId,
      workspaceId: imageAsset.workspaceId,
      ownershipScope,
      ownerUserIdentityId: imageAsset.ownerUserId,
      visibility: imageAsset.visibility,
      sharingPolicyMode: imageAsset.sharingPolicy.mode,
      sharingPolicyId: imageAsset.sharingPolicy.policyId,
      sharingPolicyVersion: imageAsset.sharingPolicy.policyVersion,
      allowResharing: false,
      isPublishedCapable: imageAsset.visibility === ResourceVisibilities.published,
      publishedAt,
    });

    const decision = await evaluator.evaluateDecision(
      toImageAssetPolicyDecisionEvaluationRequest({
        action: ImageAssetAccessActions.requestPreview,
        actor: {
          actorUserIdentityId: actorUserId,
          activeWorkspaceId: imageAsset.workspaceId,
        },
        workspaceId: imageAsset.workspaceId,
        resource,
        asOf: occurredAt,
      }),
    );

    return decision.decision.isAllowed;
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
    code: typeof ImageAssetPreviewContentReadErrorCodes[keyof typeof ImageAssetPreviewContentReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
    normalization?: {
      readonly reason: string;
      readonly kind: typeof ImageAssetFailureDefaults.kind[keyof typeof ImageAssetFailureDefaults.kind];
      readonly summaryCategory: typeof ImageAssetFailureDefaults.summary[keyof typeof ImageAssetFailureDefaults.summary];
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
  ): ImageAssetPreviewContentReadResult<never> {
    const normalizedDetails = normalization
      ? withImageAssetNormalizedFailureDetails(
        details,
        createImageAssetNormalizedFailure({
          layer: ImageAssetFailureDefaults.layer.preview,
          kind: normalization.kind,
          reason: normalization.reason,
          summaryCategory: normalization.summaryCategory,
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

  private async publishPreviewRequestAuditEvent(input: {
    readonly request: RequestImageAssetPreviewContentRequest;
    readonly occurredAt: string;
    readonly outcome: typeof ImageAssetAuditOutcomes[keyof typeof ImageAssetAuditOutcomes];
    readonly imageAsset?: ImageAsset;
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishImageAssetAuditEventBestEffort(this.dependencies.auditSink, {
      type: ImageAssetAuditEventTypes.previewAccessRequested,
      occurredAt: input.occurredAt,
      workspaceId: input.request.workspaceId,
      actorUserId: input.request.actorUserId,
      correlationId: input.request.correlationId,
      operationKey: undefined,
      outcome: input.outcome,
      asset: Object.freeze({
        assetId: input.request.assetId,
        storageInstanceId: input.imageAsset?.storageInstanceId,
        ownerUserId: input.imageAsset?.ownerUserId,
        visibility: input.imageAsset?.visibility,
        originKind: input.imageAsset?.originKind,
        lifecycleStatus: input.imageAsset?.lifecycle.status,
        mediaType: input.imageAsset?.mediaType,
      }),
      details: Object.freeze({
        reasonCode: input.reasonCode,
        representation: input.request.representation ?? "gallery",
        ...(input.details ?? {}),
      }),
    });
  }
}

function clampPreviewExpirySeconds(value: number | undefined): number {
  if (value === undefined) {
    return DefaultPreviewAccessExpirySeconds;
  }
  if (value > MaxPreviewAccessExpirySeconds) {
    return MaxPreviewAccessExpirySeconds;
  }
  return value;
}
