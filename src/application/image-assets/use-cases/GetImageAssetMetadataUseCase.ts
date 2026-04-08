import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
} from "@domain/authorization/AuthorizationDomain";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  ImageAssetAccessActions,
  createImageAssetAuthorizationResourceContext,
  toImageAssetPolicyDecisionEvaluationRequest,
} from "@shared/contracts/assets/ImageAssetAuthorizationContracts";
import type { ImageAsset } from "@domain/image-assets/ImageAssetDomain";
import type { IImageAssetRepository } from "../ports/IImageAssetRepository";
import {
  ImageAssetMetadataReadErrorCodes,
  toImageAssetMetadataDetail,
  validateGetImageAssetMetadataRequest,
  type GetImageAssetMetadataRequest,
  type GetImageAssetMetadataSuccess,
  type IGetImageAssetMetadataUseCase,
  type ImageAssetMetadataReadResult,
} from "./ImageAssetMetadataReadUseCaseContracts";

export interface GetImageAssetMetadataUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly clock?: {
    now(): Date;
  };
}

export class GetImageAssetMetadataUseCase implements IGetImageAssetMetadataUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: GetImageAssetMetadataUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GetImageAssetMetadataRequest,
  ): Promise<ImageAssetMetadataReadResult<GetImageAssetMetadataSuccess>> {
    let request: GetImageAssetMetadataRequest;
    try {
      request = validateGetImageAssetMetadataRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetMetadataReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset metadata request.",
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
        ImageAssetMetadataReadErrorCodes.accessDenied,
        "Image asset metadata lookup requires active workspace membership.",
      );
    }

    const imageAsset = await this.dependencies.imageAssetRepository.findImageAssetById(request.assetId, {
      includeDeleted: true,
    });
    if (!imageAsset || imageAsset.workspaceId !== request.workspaceId) {
      return this.failure(
        ImageAssetMetadataReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
      );
    }

    if (!request.includeDeleted && imageAsset.lifecycle.status === "deleted") {
      return this.failure(
        ImageAssetMetadataReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
      );
    }

    const allowed = await this.canViewAsset(imageAsset, request.actorUserId, authorization.isWorkspaceAdmin, occurredAt);
    if (!allowed) {
      return this.failure(
        ImageAssetMetadataReadErrorCodes.notFound,
        "Image asset was not found for the workspace.",
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        asset: toImageAssetMetadataDetail(imageAsset),
      }),
    };
  }

  private async canViewAsset(
    imageAsset: ImageAsset,
    actorUserId: string,
    isWorkspaceAdmin: boolean,
    occurredAt: string,
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
        action: ImageAssetAccessActions.viewMetadata,
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
    code: typeof ImageAssetMetadataReadErrorCodes[keyof typeof ImageAssetMetadataReadErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ImageAssetMetadataReadResult<never> {
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
