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
  ImageAssetStorageErrorCodes,
  ImageAssetStorageObjectAreas,
  isImageAssetStorageError,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import {
  ImageAssetOriginalContentReadErrorCodes,
  validateGetImageAssetOriginalContentRequest,
  type GetImageAssetOriginalContentRequest,
  type GetImageAssetOriginalContentSuccess,
  type IGetImageAssetOriginalContentUseCase,
  type ImageAssetOriginalContentReadResult,
} from "./GetImageAssetOriginalContentUseCaseContracts";
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

export interface GetImageAssetOriginalContentUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly auditSink?: ImageAssetAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

export class GetImageAssetOriginalContentUseCase implements IGetImageAssetOriginalContentUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: GetImageAssetOriginalContentUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetImageAssetOriginalContentRequest,
  ): Promise<ImageAssetOriginalContentReadResult<GetImageAssetOriginalContentSuccess>> {
    let request: GetImageAssetOriginalContentRequest;
    try {
      request = validateGetImageAssetOriginalContentRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset original-content read request.",
        undefined,
        {
          reason: "original-content-request-invalid",
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
      await this.publishOriginalContentAuditEvent({
        request,
        occurredAt,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "workspace-membership-required",
      });
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.accessDenied,
        "Image asset original-content retrieval requires active workspace membership.",
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
        ImageAssetOriginalContentReadErrorCodes.notFound,
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
        ImageAssetOriginalContentReadErrorCodes.invalidState,
        `Image asset '${imageAsset.assetId}' is not available for original-content retrieval.`,
        undefined,
        {
          reason: "asset-lifecycle-not-retrievable",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.output,
          resilience: {
            code: "asset-retrieval-blocked",
            scope: ImageManipulationResilienceScopes.assetRetrieval,
            state: ImageManipulationResilienceStateKinds.blocked,
            summary: "Asset retrieval is blocked by lifecycle state.",
            durability: ImageManipulationResilienceDurabilityClasses.persistent,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.userAction,
            recoveryRetryable: false,
          },
        },
      );
    }

    const allowed = await this.canReadOriginalContent(imageAsset, request.actorUserId, occurredAt, authorization.isWorkspaceAdmin);
    if (!allowed) {
      await this.publishOriginalContentAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "authorization-denied",
      });
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
        undefined,
        {
          reason: "authorization-denied",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.unknown,
        },
      );
    }

    const reference = await this.dependencies.imageAssetRepository.getImageAssetOriginalObjectReference(imageAsset.assetId);
    if (!reference) {
      await this.publishOriginalContentAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.rejected,
        reasonCode: "original-reference-missing",
      });
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.contentUnavailable,
        "Image asset original content is not currently available.",
        undefined,
        {
          reason: "original-reference-missing",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.output,
          retryable: true,
          resilience: {
            code: "asset-retrieval-reference-missing",
            scope: ImageManipulationResilienceScopes.assetRetrieval,
            state: ImageManipulationResilienceStateKinds.temporarilyUnavailable,
            summary: "Original content reference is missing or stale.",
            durability: ImageManipulationResilienceDurabilityClasses.unknown,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
            recoveryRetryable: true,
            recoveryRetryAfterMs: 3000,
          },
        },
      );
    }

    if (reference.storageInstanceId !== imageAsset.storageInstanceId) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.invalidState,
        "Image asset original content storage reference does not match current storage instance binding.",
        undefined,
        {
          reason: "original-reference-storage-mismatch",
          kind: ImageAssetFailureDefaults.kind.validation,
          summaryCategory: ImageAssetFailureDefaults.summary.validation,
          userFixable: false,
        },
      );
    }

    try {
      const opened = await this.dependencies.imageAssetStoragePort.openReadStream({
        workspaceId: request.workspaceId,
        assetId: imageAsset.assetId,
        actorUserId: request.actorUserId,
        purpose: ImageAssetStorageAccessPurposes.downloadOriginal,
        reference: {
          storageInstanceId: reference.storageInstanceId,
          objectKey: reference.objectKey,
          objectVersionId: reference.objectVersionId,
          area: ImageAssetStorageObjectAreas.original,
        },
      });
      await this.publishOriginalContentAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.success,
        details: Object.freeze({
          responseSizeBytes: opened.sizeBytes,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          assetId: imageAsset.assetId,
          workspaceId: imageAsset.workspaceId,
          mediaType: imageAsset.mediaType,
          sizeBytes: opened.sizeBytes,
          contentDisposition: "attachment" as const,
          contentDispositionFileName: imageAsset.originalFilename,
          stream: opened.stream,
        }),
      };
    } catch (error) {
      if (isImageAssetStorageError(error)) {
        if (error.code === ImageAssetStorageErrorCodes.notFound) {
          await this.publishOriginalContentAuditEvent({
            request,
            occurredAt,
            imageAsset,
            outcome: ImageAssetAuditOutcomes.rejected,
            reasonCode: "storage-content-not-found",
          });
          return this.failure(
            ImageAssetOriginalContentReadErrorCodes.contentUnavailable,
            "Image asset original content is not currently available.",
            undefined,
            {
              reason: "storage-content-not-found",
              kind: ImageAssetFailureDefaults.kind.operational,
              summaryCategory: ImageAssetFailureDefaults.summary.output,
              retryable: true,
              resilience: {
                code: "asset-retrieval-temporarily-unavailable",
                scope: ImageManipulationResilienceScopes.assetRetrieval,
                state: ImageManipulationResilienceStateKinds.temporarilyUnavailable,
                summary: "Asset content is temporarily unavailable from storage.",
                durability: ImageManipulationResilienceDurabilityClasses.temporary,
                recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
                recoveryRetryable: true,
                recoveryRetryAfterMs: 3000,
              },
            },
          );
        }
        if (error.code === ImageAssetStorageErrorCodes.accessDenied) {
          await this.publishOriginalContentAuditEvent({
            request,
            occurredAt,
            imageAsset,
            outcome: ImageAssetAuditOutcomes.rejected,
            reasonCode: "storage-access-denied",
          });
          return this.failure(
            ImageAssetOriginalContentReadErrorCodes.accessDenied,
            "Image asset original-content retrieval was denied by storage access policy.",
            undefined,
            {
              reason: "storage-access-denied",
              kind: ImageAssetFailureDefaults.kind.operational,
              summaryCategory: ImageAssetFailureDefaults.summary.unknown,
            },
          );
        }
      }
      await this.publishOriginalContentAuditEvent({
        request,
        occurredAt,
        imageAsset,
        outcome: ImageAssetAuditOutcomes.failed,
        reasonCode: "original-content-open-failed",
      });
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset original-content retrieval failed.",
        undefined,
        {
          reason: "original-content-open-failed",
          kind: ImageAssetFailureDefaults.kind.operational,
          summaryCategory: ImageAssetFailureDefaults.summary.internal,
          retryable: isImageAssetStorageError(error) ? error.retryable : false,
          resilience: {
            code: "asset-retrieval-degraded",
            scope: ImageManipulationResilienceScopes.assetRetrieval,
            state: ImageManipulationResilienceStateKinds.degraded,
            summary: "Asset retrieval degraded due to storage/backend failure.",
            durability: ImageManipulationResilienceDurabilityClasses.unknown,
            recoveryKind: ImageManipulationResilienceRecoveryKinds.retry,
            recoveryRetryable: isImageAssetStorageError(error) ? error.retryable : false,
            recoveryRetryAfterMs: 3000,
          },
        },
      );
    }
  }

  private async canReadOriginalContent(
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
        action: ImageAssetAccessActions.downloadOriginal,
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
    code: typeof ImageAssetOriginalContentReadErrorCodes[keyof typeof ImageAssetOriginalContentReadErrorCodes],
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
  ): ImageAssetOriginalContentReadResult<never> {
    const normalizedDetails = normalization
      ? withImageAssetNormalizedFailureDetails(
        details,
        createImageAssetNormalizedFailure({
          layer: ImageAssetFailureDefaults.layer.retrieval,
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

  private async publishOriginalContentAuditEvent(input: {
    readonly request: GetImageAssetOriginalContentRequest;
    readonly occurredAt: string;
    readonly outcome: typeof ImageAssetAuditOutcomes[keyof typeof ImageAssetAuditOutcomes];
    readonly imageAsset?: ImageAsset;
    readonly reasonCode?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await publishImageAssetAuditEventBestEffort(this.dependencies.auditSink, {
      type: ImageAssetAuditEventTypes.originalContentAccessed,
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
