import type {
  AssetFamily,
  AssetLifecycleStatus,
  AssetReference,
  AssetType,
} from "../asset";
import { normalizeAssetId, normalizeAssetVersion } from "../asset";
import { createTransportOperation } from "../transport";
import type {
  AssetDefinitionCard,
  AssetDefinitionDetail,
  AssetRegistryListResult,
  AssetRegistryReadOptions,
} from "../../application/services/asset/asset-registry-read-facade.types";
import { createApiError } from "./api-error";
import { createApiRequest, type ApiRequest } from "./api-request";
import {
  createApiFailureResponse,
  createApiSuccessResponse,
  type ApiResponse,
} from "./api-response";

export const API_ASSET_DEFINITIONS_LIST_OPERATION = createTransportOperation("asset", "definitions-list");
export const API_ASSET_DEFINITION_READ_OPERATION = createTransportOperation("asset", "definition-read");
export const API_ASSET_DEFINITION_VERSION_READ_OPERATION = createTransportOperation("asset", "definition-version-read");

export type ApiAssetBuiltInFilter = "all" | "built-in" | "custom";

export interface ApiAssetDefinitionsListRequestPayload {
  readonly q?: string;
  readonly assetType?: readonly AssetType[];
  readonly assetFamily?: readonly AssetFamily[];
  readonly lifecycleStatus?: readonly AssetLifecycleStatus[];
  readonly builtIn?: ApiAssetBuiltInFilter;
  readonly limit?: number;
  readonly cursor?: string;
  readonly includeMetadata?: boolean;
}

export interface ApiAssetDefinitionReadRequestPayload {
  readonly definitionId: string;
  readonly version?: string;
  readonly expand?: readonly ApiAssetDefinitionExpansion[];
  readonly includeValidation?: boolean;
}

export type ApiAssetDefinitionExpansion =
  | "aiContext"
  | "configurationSchema"
  | "ports"
  | "requirements"
  | "provenance"
  | "metadata";

export type ApiAssetDefinitionsListRequest = ApiRequest<
  ApiAssetDefinitionsListRequestPayload,
  typeof API_ASSET_DEFINITIONS_LIST_OPERATION,
  Record<string, never>
>;

export type ApiAssetDefinitionReadRequest = ApiRequest<
  ApiAssetDefinitionReadRequestPayload,
  typeof API_ASSET_DEFINITION_READ_OPERATION,
  Record<string, never>
>;

export type ApiAssetDefinitionVersionReadRequest = ApiRequest<
  Required<Pick<ApiAssetDefinitionReadRequestPayload, "definitionId" | "version">> & Omit<ApiAssetDefinitionReadRequestPayload, "definitionId" | "version">,
  typeof API_ASSET_DEFINITION_VERSION_READ_OPERATION,
  Record<string, never>
>;

export type ApiAssetDefinitionsListResponse = ApiResponse<
  AssetRegistryListResult<AssetDefinitionCard>,
  Record<string, unknown>,
  typeof API_ASSET_DEFINITIONS_LIST_OPERATION,
  Record<string, never>
>;

export type ApiAssetDefinitionReadResponse = ApiResponse<
  AssetDefinitionDetail,
  Record<string, unknown>,
  typeof API_ASSET_DEFINITION_READ_OPERATION,
  Record<string, never>
>;

export type ApiAssetDefinitionVersionReadResponse = ApiResponse<
  AssetDefinitionDetail,
  Record<string, unknown>,
  typeof API_ASSET_DEFINITION_VERSION_READ_OPERATION,
  Record<string, never>
>;

export function createApiAssetDefinitionsListRequest(
  payload: ApiAssetDefinitionsListRequestPayload = {},
  options?: { requestId?: string; correlationId?: string },
): ApiAssetDefinitionsListRequest {
  return createApiRequest(API_ASSET_DEFINITIONS_LIST_OPERATION, payload, options);
}

export function createApiAssetDefinitionReadRequest(
  payload: ApiAssetDefinitionReadRequestPayload,
  options?: { requestId?: string; correlationId?: string },
): ApiAssetDefinitionReadRequest {
  return createApiRequest(API_ASSET_DEFINITION_READ_OPERATION, normalizeDefinitionReadPayload(payload), options);
}

export function createApiAssetDefinitionVersionReadRequest(
  payload: Required<Pick<ApiAssetDefinitionReadRequestPayload, "definitionId" | "version">> & Omit<ApiAssetDefinitionReadRequestPayload, "definitionId" | "version">,
  options?: { requestId?: string; correlationId?: string },
): ApiAssetDefinitionVersionReadRequest {
  return createApiRequest(API_ASSET_DEFINITION_VERSION_READ_OPERATION, normalizeDefinitionReadPayload(payload) as ApiAssetDefinitionVersionReadRequest["payload"], options);
}

export function createApiAssetDefinitionsListSuccessResponse(
  value: AssetRegistryListResult<AssetDefinitionCard>,
  options?: { requestId?: string; correlationId?: string },
): ApiAssetDefinitionsListResponse {
  return createApiSuccessResponse(API_ASSET_DEFINITIONS_LIST_OPERATION, value, options);
}

export function createApiAssetDefinitionReadSuccessResponse(
  value: AssetDefinitionDetail,
  options?: { requestId?: string; correlationId?: string },
): ApiAssetDefinitionReadResponse {
  return createApiSuccessResponse(API_ASSET_DEFINITION_READ_OPERATION, value, options);
}

export function createApiAssetDefinitionVersionReadSuccessResponse(
  value: AssetDefinitionDetail,
  options?: { requestId?: string; correlationId?: string },
): ApiAssetDefinitionVersionReadResponse {
  return createApiSuccessResponse(API_ASSET_DEFINITION_VERSION_READ_OPERATION, value, options);
}

export function createApiAssetDefinitionsListFailureResponse(
  code: "validation" | "internal" | "not-found" | "unavailable",
  message: string,
  options?: { details?: Record<string, unknown>; requestId?: string; correlationId?: string },
): ApiAssetDefinitionsListResponse {
  return createApiFailureResponse(createApiError(API_ASSET_DEFINITIONS_LIST_OPERATION, code, message, options), options);
}

export function createApiAssetDefinitionReadFailureResponse(
  code: "validation" | "internal" | "not-found" | "unavailable",
  message: string,
  options?: { details?: Record<string, unknown>; requestId?: string; correlationId?: string },
): ApiAssetDefinitionReadResponse {
  return createApiFailureResponse(createApiError(API_ASSET_DEFINITION_READ_OPERATION, code, message, options), options);
}

export function createApiAssetDefinitionVersionReadFailureResponse(
  code: "validation" | "internal" | "not-found" | "unavailable",
  message: string,
  options?: { details?: Record<string, unknown>; requestId?: string; correlationId?: string },
): ApiAssetDefinitionVersionReadResponse {
  return createApiFailureResponse(createApiError(API_ASSET_DEFINITION_VERSION_READ_OPERATION, code, message, options), options);
}

export function apiAssetDefinitionReference(payload: Pick<ApiAssetDefinitionReadRequestPayload, "definitionId" | "version">): AssetReference {
  return {
    kind: "asset-definition",
    id: normalizeAssetId(payload.definitionId),
    ...(payload.version ? { version: normalizeAssetVersion(payload.version) } : {}),
  };
}

export function apiAssetDefinitionReadOptions(payload: Pick<ApiAssetDefinitionReadRequestPayload, "expand" | "includeValidation">): AssetRegistryReadOptions {
  const expand = new Set(payload.expand ?? []);
  return {
    includeValidation: payload.includeValidation,
    includeAiContext: expand.has("aiContext"),
    includeConfigurationSchema: expand.has("configurationSchema"),
    includePorts: expand.has("ports"),
    includeRequirements: expand.has("requirements"),
    includeMetadata: expand.has("metadata"),
  };
}

function normalizeDefinitionReadPayload<T extends ApiAssetDefinitionReadRequestPayload>(payload: T): T {
  return {
    ...payload,
    definitionId: normalizeAssetId(payload.definitionId),
    ...(payload.version ? { version: normalizeAssetVersion(payload.version) } : {}),
  };
}
