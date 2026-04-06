import type {
  ArchiveAssetRequest,
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
  validateAuthorizeAssetDownloadRequest,
  validateDeleteAssetRequest,
  validateFinalizeAssetUploadRequest,
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

export interface RegisterAssetResponseDto {
  readonly asset: AssetDetailDto;
}

export interface GetAssetByIdResponseDto {
  readonly asset: AssetDetailDto;
}

export interface ListAssetsResponseDto {
  readonly items: ReadonlyArray<AssetSummaryDto>;
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

function toAssetDetailResponse(asset: Asset): AssetDetailDto {
  return toAssetDetailDto(asset);
}

export function toRegisterAssetRequest(value: RegisterAssetRequestDto): RegisterAssetRequest {
  return validateRegisterAssetRequest(value);
}

export function toListAssetsQuery(value: ListAssetsQueryDto): ListAssetsQuery {
  return validateListAssetsQuery(value);
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

export function toRegisterAssetResponseDto(asset: Asset): RegisterAssetResponseDto {
  return Object.freeze({
    asset: toAssetDetailResponse(asset),
  });
}

export function toGetAssetByIdResponseDto(asset: Asset): GetAssetByIdResponseDto {
  return Object.freeze({
    asset: toAssetDetailResponse(asset),
  });
}

export function toListAssetsResponseDto(items: ReadonlyArray<Asset>): ListAssetsResponseDto {
  return Object.freeze({
    items: Object.freeze(items.map((item) => toAssetSummaryDto(item))),
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

