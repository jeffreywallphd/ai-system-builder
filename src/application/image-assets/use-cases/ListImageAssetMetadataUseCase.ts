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
  toImageAssetMetadataSummary,
  validateListImageAssetMetadataRequest,
  type IListImageAssetMetadataUseCase,
  type ImageAssetMetadataReadResult,
  type ListImageAssetMetadataRequest,
  type ListImageAssetMetadataSuccess,
} from "./ImageAssetMetadataReadUseCaseContracts";

export interface ListImageAssetMetadataUseCaseDependencies {
  readonly imageAssetRepository: IImageAssetRepository;
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly clock?: {
    now(): Date;
  };
}

const DefaultListLimit = 25;
const MaxListLimit = 100;

export class ListImageAssetMetadataUseCase implements IListImageAssetMetadataUseCase {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: ListImageAssetMetadataUseCaseDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: ListImageAssetMetadataRequest,
  ): Promise<ImageAssetMetadataReadResult<ListImageAssetMetadataSuccess>> {
    let request: ListImageAssetMetadataRequest;
    try {
      request = validateListImageAssetMetadataRequest(input);
    } catch (error) {
      return this.failure(
        ImageAssetMetadataReadErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Invalid image asset list request.",
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
        "Image asset listing requires active workspace membership.",
      );
    }

    const limit = clampLimit(request.limit);
    const offset = request.offset ?? 0;
    const targetVisibleCount = offset + limit + 1;
    const batchSize = clampLimit(Math.max(limit * 2, 50));
    const visible: ImageAsset[] = [];
    let repositoryOffset = 0;

    while (visible.length < targetVisibleCount) {
      const batch = await this.dependencies.imageAssetRepository.listImageAssets({
        workspaceId: request.workspaceId,
        ownerUserIds: request.ownerUserIds,
        originKinds: request.originKinds,
        lifecycleStatuses: request.lifecycleStatuses,
        visibilities: request.visibilities,
        mediaTypes: request.mediaTypes,
        storageInstanceIds: request.storageInstanceIds,
        sourceRunIds: request.sourceRunIds,
        generationOperationIds: request.generationOperationIds,
        createdAfter: request.createdAfter,
        createdBefore: request.createdBefore,
        updatedAfter: request.updatedAfter,
        updatedBefore: request.updatedBefore,
        includeDeleted: request.includeDeleted,
        limit: batchSize,
        offset: repositoryOffset,
      });

      if (batch.length < 1) {
        break;
      }

      repositoryOffset += batch.length;
      const decisions = await Promise.all(batch.map((asset) =>
        this.canViewAsset(asset, request.actorUserId, authorization.isWorkspaceAdmin, occurredAt)
      ));
      for (let index = 0; index < batch.length; index += 1) {
        if (decisions[index]) {
          const asset = batch[index];
          if (asset) {
            visible.push(asset);
          }
        }
      }

      if (batch.length < batchSize) {
        break;
      }
    }

    const page = Object.freeze(visible
      .slice(offset, offset + limit)
      .map((asset) => toImageAssetMetadataSummary(asset)));
    const hasMore = visible.length > (offset + limit);

    return {
      ok: true,
      value: Object.freeze({
        items: page,
        pagination: Object.freeze({
          limit,
          offset,
          returned: page.length,
          hasMore,
        }),
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

function clampLimit(limit: number | undefined): number {
  if (Number.isInteger(limit) && (limit as number) > 0) {
    return Math.min(limit as number, MaxListLimit);
  }
  return DefaultListLimit;
}
