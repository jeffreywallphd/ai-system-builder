import { randomUUID } from "node:crypto";
import { AssetServiceErrorCodes } from "../../../src/application/assets/use-cases/AssetServiceContracts";
import type { AssetUploadInitiationService } from "../../../src/application/assets/use-cases/AssetUploadInitiationService";
import type { AssetUploadIngestionService } from "../../../src/application/assets/use-cases/AssetUploadIngestionService";
import type { AssetDetailService } from "../../../src/application/assets/use-cases/AssetDetailService";
import { type AssetSummaryDto, toAssetDetailDto, toAssetSummaryDto } from "../../../src/shared/contracts/assets/AssetTransportContracts";
import {
  toGetAssetByIdQuery,
  toListAssetsQuery,
  toBeginAssetUploadRequest,
  toRegisterAssetRequest,
} from "../../../src/shared/dto/assets/AssetTransportDtos";
import {
  AssetManagementApiErrorCodes,
  type AssetManagementApiError,
  type AssetManagementApiResponse,
  type IngestAssetUploadContentApiRequest,
  type IngestAssetUploadContentApiResponse,
  type InitiateAssetUploadApiRequest,
  type InitiateAssetUploadApiResponse,
  type GetAssetDetailApiRequest,
  type GetAssetDetailApiResponse,
  type ListAssetsApiRequest,
  type ListAssetsApiResponse,
  type RegisterAssetApiRequest,
  type RegisterAssetApiResponse,
} from "./sdk/PublicAssetManagementApiContract";
import type { AssetDiscoveryService } from "../../../src/application/assets/use-cases/AssetDiscoveryService";

export interface AssetManagementBackendApiDependencies {
  readonly uploadInitiationService: AssetUploadInitiationService;
  readonly uploadIngestionService: AssetUploadIngestionService;
  readonly discoveryService: AssetDiscoveryService;
  readonly detailService: AssetDetailService;
}

export class AssetManagementBackendApi {
  public constructor(private readonly dependencies: AssetManagementBackendApiDependencies) {}

  public async registerAsset(
    request: RegisterAssetApiRequest,
  ): Promise<AssetManagementApiResponse<RegisterAssetApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(AssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    let parsedRequest: ReturnType<typeof toRegisterAssetRequest>;
    try {
      parsedRequest = toRegisterAssetRequest({
        actorUserId: actorUserIdentityId,
        workspaceId: request.workspaceId,
        operationKey: request.operationKey ?? `asset:register:${request.assetId}:${randomUUID()}`,
        correlationId: request.correlationId,
        occurredAt: request.occurredAt,
        assetId: request.assetId,
        kind: request.kind,
        ownerUserId: request.ownerUserId,
        visibility: request.visibility,
        sharingPolicyRef: request.sharingPolicyRef,
        storageInstanceId: request.storageInstanceId,
        initialVersion: request.initialVersion,
      });
    } catch (error) {
      return this.failed(
        AssetManagementApiErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Request validation failed.",
      );
    }

    const outcome = await this.dependencies.uploadInitiationService.registerAsset(parsedRequest);
    if (!outcome.ok) {
      return this.failedFromServiceError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        asset: toAssetDetailDto(outcome.value.asset),
      }),
    });
  }

  public async initiateAssetUpload(
    request: InitiateAssetUploadApiRequest,
  ): Promise<AssetManagementApiResponse<InitiateAssetUploadApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(AssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    let parsedRequest: ReturnType<typeof toBeginAssetUploadRequest>;
    try {
      parsedRequest = toBeginAssetUploadRequest({
        actorUserId: actorUserIdentityId,
        workspaceId: request.workspaceId,
        operationKey: request.operationKey ?? `asset:upload:initiate:${request.assetId}:${randomUUID()}`,
        correlationId: request.correlationId,
        occurredAt: request.occurredAt,
        assetId: request.assetId,
        storageInstanceId: request.storageInstanceId,
        fileName: request.fileName,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        area: request.area,
        expiresInSeconds: request.expiresInSeconds,
      });
    } catch (error) {
      return this.failed(
        AssetManagementApiErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Request validation failed.",
      );
    }

    const outcome = await this.dependencies.uploadInitiationService.beginAssetUpload(parsedRequest);
    if (!outcome.ok) {
      return this.failedFromServiceError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        asset: toAssetDetailDto(outcome.value.asset),
        upload: outcome.value.upload,
      }),
    });
  }

  public async ingestAssetUploadContent(
    request: IngestAssetUploadContentApiRequest,
  ): Promise<AssetManagementApiResponse<IngestAssetUploadContentApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(AssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const uploadSessionId = normalizeRequired(request.uploadSessionId);
    if (!uploadSessionId) {
      return this.failed(AssetManagementApiErrorCodes.invalidRequest, "uploadSessionId is required.");
    }

    const outcome = await this.dependencies.uploadIngestionService.ingestUploadContent({
      actorUserId: actorUserIdentityId,
      workspaceId: request.workspaceId,
      operationKey: request.operationKey ?? `asset:upload:ingest:${uploadSessionId}:${randomUUID()}`,
      correlationId: request.correlationId,
      occurredAt: request.occurredAt,
      uploadSessionId,
      contentType: request.contentType,
      content: request.content,
    });
    if (!outcome.ok) {
      return this.failedFromServiceError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        asset: toAssetDetailDto(outcome.value.asset),
        uploadSessionId: outcome.value.uploadSessionId,
        finalizedVersionId: outcome.value.finalizedVersionId,
        content: outcome.value.content,
      }),
    });
  }

  public async listAssets(
    request: ListAssetsApiRequest,
  ): Promise<AssetManagementApiResponse<ListAssetsApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(AssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    let parsedQuery: ReturnType<typeof toListAssetsQuery>;
    try {
      parsedQuery = toListAssetsQuery({
        actorUserId: actorUserIdentityId,
        workspaceId: request.workspaceId,
        correlationId: request.correlationId,
        occurredAt: request.occurredAt,
        scope: request.scope,
        ownerUserId: request.ownerUserId,
        createdByUserId: request.createdByUserId,
        storageInstanceId: request.storageInstanceId,
        assetKinds: request.assetKinds,
        visibilities: request.visibilities,
        lifecycleStates: request.lifecycleStates,
        sourceAssetId: request.sourceAssetId,
        sourceAssetVersionId: request.sourceAssetVersionId,
        limit: request.limit,
        offset: request.offset,
      });
    } catch (error) {
      return this.failed(
        AssetManagementApiErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Request validation failed.",
      );
    }

    const outcome = await this.dependencies.discoveryService.listAssets(parsedQuery);
    if (!outcome.ok) {
      return this.failedFromServiceError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        items: Object.freeze(outcome.value.items.map((item): AssetSummaryDto => toAssetSummaryDto(item))),
        pagination: outcome.value.pagination,
      }),
    });
  }

  public async getAssetDetail(
    request: GetAssetDetailApiRequest,
  ): Promise<AssetManagementApiResponse<GetAssetDetailApiResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failed(AssetManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    let parsedQuery: ReturnType<typeof toGetAssetByIdQuery>;
    try {
      parsedQuery = toGetAssetByIdQuery({
        actorUserId: actorUserIdentityId,
        workspaceId: request.workspaceId,
        assetId: request.assetId,
        correlationId: request.correlationId,
        occurredAt: request.occurredAt,
        includeDeleted: request.includeDeleted,
      });
    } catch (error) {
      return this.failed(
        AssetManagementApiErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "Request validation failed.",
      );
    }

    const outcome = await this.dependencies.detailService.getAssetById(parsedQuery);
    if (!outcome.ok) {
      return this.failedFromServiceError(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        asset: toAssetDetailDto(outcome.value.asset, outcome.value.metadata),
      }),
    });
  }

  private failedFromServiceError(
    code: typeof AssetServiceErrorCodes[keyof typeof AssetServiceErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetManagementApiResponse<never> {
    switch (code) {
      case AssetServiceErrorCodes.invalidRequest:
        return this.failed(AssetManagementApiErrorCodes.invalidRequest, message, details);
      case AssetServiceErrorCodes.accessDenied:
        return this.failed(AssetManagementApiErrorCodes.forbidden, message, details);
      case AssetServiceErrorCodes.notFound:
        return this.failed(AssetManagementApiErrorCodes.notFound, message, details);
      case AssetServiceErrorCodes.conflict:
        return this.failed(AssetManagementApiErrorCodes.conflict, message, details);
      case AssetServiceErrorCodes.policyViolation:
      case AssetServiceErrorCodes.invalidState:
        return this.failed(AssetManagementApiErrorCodes.invalidState, message, details);
      default:
        return this.failed(AssetManagementApiErrorCodes.internal, message, details);
    }
  }

  private failed(
    code: AssetManagementApiError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetManagementApiResponse<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    });
  }
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
