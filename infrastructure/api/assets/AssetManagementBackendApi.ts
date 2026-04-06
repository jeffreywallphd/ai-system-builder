import { randomUUID } from "node:crypto";
import { AssetServiceErrorCodes } from "../../../src/application/assets/use-cases/AssetServiceContracts";
import type { AssetUploadInitiationService } from "../../../src/application/assets/use-cases/AssetUploadInitiationService";
import { toAssetDetailDto } from "../../../src/shared/contracts/assets/AssetTransportContracts";
import {
  toBeginAssetUploadRequest,
  toRegisterAssetRequest,
} from "../../../src/shared/dto/assets/AssetTransportDtos";
import {
  AssetManagementApiErrorCodes,
  type AssetManagementApiError,
  type AssetManagementApiResponse,
  type InitiateAssetUploadApiRequest,
  type InitiateAssetUploadApiResponse,
  type RegisterAssetApiRequest,
  type RegisterAssetApiResponse,
} from "./sdk/PublicAssetManagementApiContract";

export interface AssetManagementBackendApiDependencies {
  readonly uploadInitiationService: AssetUploadInitiationService;
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

  private failedFromServiceError(
    code: typeof AssetServiceErrorCodes[keyof typeof AssetServiceErrorCodes],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AssetManagementApiResponse<never> {
    switch (code) {
      case AssetServiceErrorCodes.invalidRequest:
        return this.failed(AssetManagementApiErrorCodes.invalidRequest, message, details);
      case AssetServiceErrorCodes.accessDenied:
      case AssetServiceErrorCodes.policyViolation:
        return this.failed(AssetManagementApiErrorCodes.forbidden, message, details);
      case AssetServiceErrorCodes.notFound:
        return this.failed(AssetManagementApiErrorCodes.notFound, message, details);
      case AssetServiceErrorCodes.conflict:
        return this.failed(AssetManagementApiErrorCodes.conflict, message, details);
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
