import type {
  ImageAssetAccessGrantDto,
  ImageAssetAccessPurpose,
  ImageAssetDetailDto,
  ImageAssetEventDto,
  ImageAssetListQueryFilters,
  ImageAssetSummaryDto,
  ImageAssetTransportContractVersion,
  ImageAssetUploadSessionDto,
} from "../../contracts/assets/ImageAssetTransportContracts";

export interface CreateImageAssetRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly originKind: ImageAssetDetailDto["originKind"];
  readonly visibility: ImageAssetDetailDto["visibility"];
  readonly ownerUserId?: string;
  readonly storage: {
    readonly storageInstanceId: string;
    readonly storageBindingReference?: string;
  };
  readonly mediaType: ImageAssetDetailDto["mediaType"];
  readonly originalFilename: string;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly fingerprint: ImageAssetDetailDto["fingerprint"];
  readonly sharingPolicy?: ImageAssetDetailDto["sharingPolicy"];
  readonly lineage?: ImageAssetDetailDto["lineage"];
}

export interface CreateImageAssetResponseDto {
  readonly asset: ImageAssetDetailDto;
}

export interface InitiateImageAssetUploadRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly fileName: string;
  readonly mediaType: ImageAssetDetailDto["mediaType"];
  readonly sizeBytes: number;
  readonly expectedFingerprint?: ImageAssetDetailDto["fingerprint"];
}

export interface InitiateImageAssetUploadResponseDto {
  readonly asset: ImageAssetDetailDto;
  readonly upload: ImageAssetUploadSessionDto;
}

export interface CompleteImageAssetUploadRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly uploadSessionId: string;
  readonly mediaType?: ImageAssetDetailDto["mediaType"];
  readonly sizeBytes?: number;
  readonly fingerprint?: ImageAssetDetailDto["fingerprint"];
  readonly completedAt?: string;
}

export interface CompleteImageAssetUploadResponseDto {
  readonly asset: ImageAssetDetailDto;
  readonly uploadSessionId: string;
  readonly finalizedAt: string;
}

export interface GetImageAssetMetadataRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly includeDeleted?: boolean;
}

export interface GetImageAssetMetadataResponseDto {
  readonly asset: ImageAssetDetailDto;
}

export interface ListImageAssetsRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly filters?: ImageAssetListQueryFilters;
}

export interface ListImageAssetsResponseDto {
  readonly items: ReadonlyArray<ImageAssetSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface RequestImageAssetPreviewRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly preferredMediaTypes?: ReadonlyArray<ImageAssetDetailDto["mediaType"]>;
}

export interface RequestImageAssetPreviewResponseDto {
  readonly assetId: string;
  readonly preview: ImageAssetDetailDto["preview"];
}

export interface RequestImageAssetAccessRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly purpose: ImageAssetAccessPurpose;
  readonly expiresInSeconds?: number;
  readonly suggestedFileName?: string;
}

export interface RequestImageAssetAccessResponseDto {
  readonly access: ImageAssetAccessGrantDto;
}

export interface ListImageAssetEventsRequestDto {
  readonly contractVersion: ImageAssetTransportContractVersion;
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly assetId?: string;
  readonly kinds?: ReadonlyArray<ImageAssetEventDto["kind"]>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListImageAssetEventsResponseDto {
  readonly items: ReadonlyArray<ImageAssetEventDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}
