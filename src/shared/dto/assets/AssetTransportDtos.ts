import type {
  ArchiveAssetRequest,
  BeginAssetUploadRequest,
  AuthorizeAssetDownloadRequest,
  DeleteAssetRequest,
  FinalizeAssetUploadRequest,
  GetAssetByIdQuery,
  ListAssetsQuery,
  RegisterAssetRequest,
  RegisterGeneratedOutputRequest,
  ResolveAssetPreviewQuery,
} from "../../../application/assets/use-cases/AssetServiceContracts";
import {
  validateArchiveAssetRequest,
  validateBeginAssetUploadRequest,
  validateAuthorizeAssetDownloadRequest,
  validateDeleteAssetRequest,
  validateFinalizeAssetUploadRequest,
  validateGetAssetByIdQuery,
  validateListAssetsQuery,
  validateRegisterAssetRequest,
  validateRegisterGeneratedOutputRequest,
  validateResolveAssetPreviewQuery,
} from "../../../application/assets/use-cases/AssetServiceContracts";
import type { Asset } from "../../../domain/assets/AssetDomain";
import {
  toAssetDetailDto,
  toAssetDownloadAuthorizationDto,
  toAssetPreviewResolutionDto,
  toAssetSummaryDto,
  type AssetDetailDto,
  type AssetDownloadAuthorizationDto,
  type AssetPreviewResolutionDto,
  type AssetSummaryDto,
} from "../../contracts/assets/AssetTransportContracts";
import type {
  AssetDownloadAuthorization,
  AssetPreviewResolution,
} from "../../../application/assets/use-cases/AssetServiceContracts";

export type RegisterAssetRequestDto = RegisterAssetRequest;
export type GetAssetByIdQueryDto = GetAssetByIdQuery;
export type ListAssetsQueryDto = ListAssetsQuery;
export type FinalizeAssetUploadRequestDto = FinalizeAssetUploadRequest;
export type AuthorizeAssetDownloadRequestDto = AuthorizeAssetDownloadRequest;
export type ResolveAssetPreviewQueryDto = ResolveAssetPreviewQuery;
export type RegisterGeneratedOutputRequestDto = RegisterGeneratedOutputRequest;
export type ArchiveAssetRequestDto = ArchiveAssetRequest;
export type DeleteAssetRequestDto = DeleteAssetRequest;
export type BeginAssetUploadRequestDto = BeginAssetUploadRequest;

export interface RegisterAssetResponseDto {
  readonly asset: AssetDetailDto;
}

export interface GetAssetByIdResponseDto {
  readonly asset: AssetDetailDto;
}

export interface ListAssetsResponseDto {
  readonly items: ReadonlyArray<AssetSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface FinalizeAssetUploadResponseDto {
  readonly asset: AssetDetailDto;
  readonly finalizedVersionId: string;
}

export interface AuthorizeAssetDownloadResponseDto {
  readonly authorization: AssetDownloadAuthorizationDto;
}

export interface ResolveAssetPreviewResponseDto {
  readonly preview: AssetPreviewResolutionDto;
}

export interface RegisterGeneratedOutputResponseDto {
  readonly asset: AssetDetailDto;
}

export interface BeginAssetUploadResponseDto {
  readonly asset: AssetDetailDto;
  readonly upload: {
    readonly uploadSessionId: string;
    readonly assetId: string;
    readonly workspaceId: string;
    readonly storageInstanceId: string;
    readonly objectKey: string;
    readonly area: Asset["versions"][number]["location"]["area"];
    readonly uploadEndpoint: string;
    readonly uploadMethod: "POST";
    readonly expected: {
      readonly fileName: string;
      readonly mimeType: string;
      readonly sizeBytes: number;
    };
    readonly expiresAt: string;
  };
}

function toAssetDetailResponse(asset: Asset): AssetDetailDto {
  return toAssetDetailDto(asset);
}

export function toRegisterAssetRequest(value: RegisterAssetRequestDto): RegisterAssetRequest {
  return validateRegisterAssetRequest(value);
}

export function toListAssetsQuery(value: ListAssetsQueryDto): ListAssetsQuery {
  return validateListAssetsQuery(value);
}

export function toGetAssetByIdQuery(value: GetAssetByIdQueryDto): GetAssetByIdQuery {
  return validateGetAssetByIdQuery(value);
}

export function toFinalizeAssetUploadRequest(value: FinalizeAssetUploadRequestDto): FinalizeAssetUploadRequest {
  return validateFinalizeAssetUploadRequest(value);
}

export function toAuthorizeAssetDownloadRequest(
  value: AuthorizeAssetDownloadRequestDto,
): AuthorizeAssetDownloadRequest {
  return validateAuthorizeAssetDownloadRequest(value);
}

export function toResolveAssetPreviewQuery(value: ResolveAssetPreviewQueryDto): ResolveAssetPreviewQuery {
  return validateResolveAssetPreviewQuery(value);
}

export function toRegisterGeneratedOutputRequest(
  value: RegisterGeneratedOutputRequestDto,
): RegisterGeneratedOutputRequest {
  return validateRegisterGeneratedOutputRequest(value);
}

export function toArchiveAssetRequest(value: ArchiveAssetRequestDto): ArchiveAssetRequest {
  return validateArchiveAssetRequest(value);
}

export function toDeleteAssetRequest(value: DeleteAssetRequestDto): DeleteAssetRequest {
  return validateDeleteAssetRequest(value);
}

export function toBeginAssetUploadRequest(value: BeginAssetUploadRequestDto): BeginAssetUploadRequest {
  return validateBeginAssetUploadRequest(value);
}

export function toRegisterAssetResponseDto(asset: Asset): RegisterAssetResponseDto {
  return Object.freeze({
    asset: toAssetDetailResponse(asset),
  });
}

export function toGetAssetByIdResponseDto(
  asset: Asset,
  metadata?: {
    readonly isOwnedByActor: boolean;
    readonly uploadState: "ready" | "archived" | "deleted";
    readonly previewAvailable: boolean;
    readonly previewMimeTypeHint?: string;
    readonly allowedActions: {
      readonly canInitiateUpload: boolean;
      readonly canAuthorizeDownload: boolean;
      readonly canResolvePreview: boolean;
      readonly canArchive: boolean;
      readonly canDelete: boolean;
    };
    readonly links: {
      readonly self: string;
      readonly list: string;
      readonly initiateUpload: string;
      readonly authorizeDownload: string;
      readonly resolvePreview: string;
      readonly listGeneratedOutputsBySource: string;
    };
    readonly lineage: {
      readonly sources: ReadonlyArray<{
        readonly sourceAssetId: string;
        readonly sourceAssetVersionId?: string;
        readonly relation?: string;
      }>;
    };
    readonly generatedOutputSource?: {
      readonly producerType: "run" | "system";
      readonly runId?: string;
      readonly systemId?: string;
    };
  },
): GetAssetByIdResponseDto {
  return Object.freeze({
    asset: toAssetDetailDto(asset, metadata),
  });
}

export function toListAssetsResponseDto(
  items: ReadonlyArray<Asset>,
  pagination?: ListAssetsResponseDto["pagination"],
): ListAssetsResponseDto {
  const returned = items.length;
  return Object.freeze({
    items: Object.freeze(items.map((item) => toAssetSummaryDto(item))),
    pagination: Object.freeze({
      limit: pagination?.limit ?? returned,
      offset: pagination?.offset ?? 0,
      returned,
      hasMore: pagination?.hasMore ?? false,
    }),
  });
}

export function toFinalizeAssetUploadResponseDto(
  asset: Asset,
  finalizedVersionId: string,
): FinalizeAssetUploadResponseDto {
  return Object.freeze({
    asset: toAssetDetailResponse(asset),
    finalizedVersionId,
  });
}

export function toAuthorizeAssetDownloadResponseDto(
  authorization: AssetDownloadAuthorization,
): AuthorizeAssetDownloadResponseDto {
  return Object.freeze({
    authorization: toAssetDownloadAuthorizationDto(authorization),
  });
}

export function toResolveAssetPreviewResponseDto(
  preview: AssetPreviewResolution,
): ResolveAssetPreviewResponseDto {
  return Object.freeze({
    preview: toAssetPreviewResolutionDto(preview),
  });
}

export function toRegisterGeneratedOutputResponseDto(asset: Asset): RegisterGeneratedOutputResponseDto {
  return Object.freeze({
    asset: toAssetDetailResponse(asset),
  });
}

export function toBeginAssetUploadResponseDto(
  asset: Asset,
  upload: BeginAssetUploadResponseDto["upload"],
): BeginAssetUploadResponseDto {
  return Object.freeze({
    asset: toAssetDetailResponse(asset),
    upload,
  });
}

