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
  isImageAssetStorageError,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import {
  ImageAssetPreviewContentReadErrorCodes,
  validateOpenImageAssetPreviewContentRequest,
  type IOpenImageAssetPreviewContentUseCase,
  type ImageAssetPreviewContentReadResult,
  type OpenImageAssetPreviewContentRequest,
  type OpenImageAssetPreviewContentSuccess,
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

export interface OpenImageAssetPreviewContentUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly auditSink?: ImageAssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class OpenImageAssetPreviewContentUseCase implements IOpenImageAssetPreviewContentUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: OpenImageAssetPreviewContentUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: OpenImageAssetPreviewContentRequest,
  ): Promise<ImageAssetPreviewContentReadResult<OpenImageAssetPreviewContentSuccess>> {
    let request: OpenImageAssetPreviewContentRequest;
    try {
      request = validateOpenImageAssetPreviewContentRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset preview content request.",
        undefined,
        {
          reason: "preview-open-request-invalid",
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
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "workspace-membership-required",
      });
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.accessDenied,
        "Image asset preview retrieval requires active workspace membership.",
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

    if (imageAsset.lifecycle.status !== ImageAssetStatuses.available && imageAsset.lifecycle.status !== ImageAssetStatuses.archived) {
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.invalidState,
        `Image asset '${imageAsset.assetId}' is not available for preview retrieval.`,
        undefined,
        {
          reason: "asset-lifecycle-not-previewable",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.output,
        },
      );
    }

    const allowed = await this.canRequestPreview(imageAsset, request.actorUserId, occurredAt, authorization.isWorkspaceAdmin);
    if (!allowed) {
      await this.publishPreviewOpenAuditEvent({
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

    const claims = await this.dependencies.imageAssetStoragePort.resolveAccessHandle({
      handleToken: request.previewToken,
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      actorUserId: request.actorUserId,
      occurredAt,
    });
    if (!claims || claims.purpose !== ImageAssetStorageAccessPurposes.inlinePreview) {
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "preview-token-stale-or-invalid",
      });
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.invalidState,
        "Image asset preview token is stale or invalid. Request a new preview token.",
        Object.freeze({
          staleRequest: true,
        }),
        {
          reason: "preview-token-stale-or-invalid",
          kind: ImageAssetFailureDefaults.kind.validation,
          summaryCategory: ImageAssetFailureDefaults.summary.validation,
          userFixable: true,
          resilience: {
            code: "preview-request-stale",
            scope: ImageManipulationResilienceScopes.previewReadiness,
            state: ImageManipulationResilienceStateKinds.blocked,
            summary: "Preview token is stale and must be reissued.",
            durability: ImageManipulationResilienceDurabilityClasses.temporary,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.userAction,
            recoveryRetryable: false,
          },
        },
      );
    }

    try {
      const opened = await this.dependencies.imageAssetStoragePort.openReadStream({
        workspaceId: request.workspaceId,
        assetId: request.assetId,
        actorUserId: request.actorUserId,
        purpose: ImageAssetStorageAccessPurposes.inlinePreview,
        reference: claims.reference,
      });
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          responseSizeBytes: opened.sizeBytes,
          storageInstanceId: claims.reference.storageInstanceId,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          assetId: imageAsset.assetId,
          workspaceId: imageAsset.workspaceId,
          mediaType: imageAsset.mediaType,
          sizeBytes: opened.sizeBytes,
          contentDisposition: "inline",
          contentDispositionFileName: imageAsset.originalFilename,
          stream: opened.stream,
        }),
      };
    } catch (error) {
      if (isImageAssetStorageError(error)) {
        await this.publishPreviewOpenAuditEvent({
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
              code: "preview-content-temporarily-unavailable",
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
      await this.publishPreviewOpenAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.failed,
        reasonCode: "preview-open-failed",
      });
      return this.failure(
        ImageAssetPreviewContentReadErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset preview retrieval failed.",
        undefined,
        {
          reason: "preview-open-failed",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.internal,
          retryable: isImageAssetStorageError(error) ? error.retryable : false,
          resilience: {
            code: "preview-open-degraded",
            scope: ImageManipulationResilienceScopes.previewReadiness,
            state: ImageManipulationResilienceStateKinds.degraded,
            summary: "Preview retrieval degraded due to backend failure.",
            durability: ImageManipulationResilienceDurabilityClasses.unknown,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
            recoveryRetryable: isImageAssetStorageError(error) ? error.retryable : false,
            recoveryRetryAfterMs: 3000,
          },
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

  private async publishPreviewOpenAuditEvent(input: {
    readonly request: OpenImageAssetPreviewContentRequest;
    readonly occurredAt: string;
    readonly outcome: typeof ImageAssetAuditOutcomes[keyof typeof ImageAssetAuditOutcomes];
    readonly imageAsset?: ImageAsset;
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishImageAssetAuditEventBestEffort(this.dependencies.auditSink, {
      type: ImageAssetAuditEventTypes.previewContentOpened,
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
        ...(input.details ?? {}),
      }),
    });
  }
}
