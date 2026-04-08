import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";
import type {
  ImageAsset,
  ImageAssetOriginKind,
  ImageAssetStatus,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";

export interface ImageAssetRepositoryListQuery {
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly originKinds?: ReadonlyArray<ImageAssetOriginKind>;
  readonly lifecycleStatuses?: ReadonlyArray<ImageAssetStatus>;
  readonly visibilities?: ReadonlyArray<ResourceVisibility>;
  readonly mediaTypes?: ReadonlyArray<SupportedImageMediaType>;
  readonly storageInstanceIds?: ReadonlyArray<string>;
  readonly sourceRunIds?: ReadonlyArray<string>;
  readonly generationOperationIds?: ReadonlyArray<string>;
  readonly includeDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ImageAssetRepositoryMutationContext {
  readonly operationKey: string;
  readonly actorUserId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
}

export interface ImageAssetRepositoryMutationResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly imageAsset: ImageAsset;
}

export interface IImageAssetRepository {
  findImageAssetById(
    assetId: string,
    options?: {
      readonly includeDeleted?: boolean;
    },
  ): Promise<ImageAsset | undefined>;
  listImageAssets(query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>>;
  createImageAsset(
    imageAsset: ImageAsset,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult>;
  saveImageAsset(
    imageAsset: ImageAsset,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult>;
  archiveImageAsset(
    assetId: string,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined>;
  softDeleteImageAsset(
    assetId: string,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined>;
}
