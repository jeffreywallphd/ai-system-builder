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

export interface GetImageAssetOriginalContentUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly imageAssetStoragePort: IImageAssetStoragePort;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
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
        ImageAssetOriginalContentReadErrorCodes.accessDenied,
        "Image asset original-content retrieval requires active workspace membership.",
      );
    }

    const imageAsset = await this.dependencies.imageAssetRepository.findImageAssetById(request.assetId, {
      includeDeleted: true,
    });
    if (!imageAsset || imageAsset.workspaceId !== request.workspaceId || imageAsset.lifecycle.status === ImageAssetStatuses.deleted) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
      );
    }

    if (imageAsset.lifecycle.status !== ImageAssetStatuses.available && imageAsset.lifecycle.status !== ImageAssetStatuses.archived) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.invalidState,
        `Image asset '${imageAsset.assetId}' is not available for original-content retrieval.`,
      );
    }

    const allowed = await this.canReadOriginalContent(imageAsset, request.actorUserId, occurredAt, authorization.isWorkspaceAdmin);
    if (!allowed) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
      );
    }

    const reference = await this.dependencies.imageAssetRepository.getImageAssetOriginalObjectReference(imageAsset.assetId);
    if (!reference) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.contentUnavailable,
        "Image asset original content is not currently available.",
      );
    }

    if (reference.storageInstanceId !== imageAsset.storageInstanceId) {
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.invalidState,
        "Image asset original content storage reference does not match current storage instance binding.",
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
          return this.failure(
            ImageAssetOriginalContentReadErrorCodes.contentUnavailable,
            "Image asset original content is not currently available.",
          );
        }
        if (error.code === ImageAssetStorageErrorCodes.accessDenied) {
          return this.failure(
            ImageAssetOriginalContentReadErrorCodes.accessDenied,
            "Image asset original-content retrieval was denied by storage access policy.",
          );
        }
      }
      return this.failure(
        ImageAssetOriginalContentReadErrorCodes.internal,
        error instanceof Error ? error.message : "Image asset original-content retrieval failed.",
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
  ): ImageAssetOriginalContentReadResult<never> {
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
