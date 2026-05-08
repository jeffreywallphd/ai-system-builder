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
import { createIpcChannel, type IpcChannel, type IpcChannelValue } from "./ipc-channel";
import { createIpcRequest, type IpcRequest } from "./ipc-request";
import { createIpcSuccessResponse, type IpcResponse } from "./ipc-response";

export const DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION = createTransportOperation("asset", "definitions-list");
export const DESKTOP_ASSET_DEFINITION_READ_OPERATION = createTransportOperation("asset", "definition-read");
export const DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION = createTransportOperation("asset", "definition-version-read");

export const DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL = createIpcChannel(DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION, "request");
export const DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION, "response");
export const DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL = createIpcChannel(DESKTOP_ASSET_DEFINITION_READ_OPERATION, "request");
export const DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_ASSET_DEFINITION_READ_OPERATION, "response");
export const DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL = createIpcChannel(DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION, "request");
export const DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION, "response");

export type DesktopAssetBuiltInFilter = "all" | "built-in" | "custom";

export interface DesktopAssetRegistryBoundaryContext {
  readonly host: "desktop";
  readonly source: string;
}

export interface DesktopAssetDefinitionsListRequestPayload {
  readonly searchText?: string;
  readonly assetTypes?: readonly AssetType[];
  readonly assetFamilies?: readonly AssetFamily[];
  readonly lifecycleStatuses?: readonly AssetLifecycleStatus[];
  readonly builtIn?: DesktopAssetBuiltInFilter;
  readonly limit?: number;
  readonly cursor?: string;
  readonly includeMetadata?: boolean;
  readonly boundary: DesktopAssetRegistryBoundaryContext;
}

export type DesktopAssetDefinitionExpansion =
  | "aiContext"
  | "configurationSchema"
  | "ports"
  | "requirements"
  | "provenance"
  | "metadata";

export interface DesktopAssetDefinitionReadRequestPayload {
  readonly definitionId: string;
  readonly version?: string;
  readonly expand?: readonly DesktopAssetDefinitionExpansion[];
  readonly includeValidation?: boolean;
  readonly boundary: DesktopAssetRegistryBoundaryContext;
}

export type DesktopAssetDefinitionsListRequest = IpcRequest<
  DesktopAssetDefinitionsListRequestPayload,
  typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION,
  Record<string, never>,
  typeof DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL.value
>;

export type DesktopAssetDefinitionReadRequest = IpcRequest<
  DesktopAssetDefinitionReadRequestPayload,
  typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION,
  Record<string, never>,
  typeof DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL.value
>;

export type DesktopAssetDefinitionVersionReadRequest = IpcRequest<
  Required<Pick<DesktopAssetDefinitionReadRequestPayload, "definitionId" | "version">> & Omit<DesktopAssetDefinitionReadRequestPayload, "definitionId" | "version">,
  typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION,
  Record<string, never>,
  typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL.value
>;

export type DesktopAssetDefinitionsListResponse = IpcResponse<
  AssetRegistryListResult<AssetDefinitionCard>,
  Record<string, unknown>,
  typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION,
  Record<string, never>,
  typeof DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL.value
>;

export type DesktopAssetDefinitionReadResponse = IpcResponse<
  AssetDefinitionDetail,
  Record<string, unknown>,
  typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION,
  Record<string, never>,
  typeof DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL.value
>;

export type DesktopAssetDefinitionVersionReadResponse = IpcResponse<
  AssetDefinitionDetail,
  Record<string, unknown>,
  typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION,
  Record<string, never>,
  typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL.value
>;

function normalizeRequiredTextField(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must be a non-empty, trimmed string.`);
  }
  return normalized;
}

function normalizeBoundary(boundary: DesktopAssetRegistryBoundaryContext): DesktopAssetRegistryBoundaryContext {
  return {
    host: "desktop",
    source: normalizeRequiredTextField(boundary.source, "boundary.source"),
  };
}

function normalizeDefinitionReadPayload<T extends DesktopAssetDefinitionReadRequestPayload>(payload: T): T {
  return {
    ...payload,
    definitionId: normalizeAssetId(payload.definitionId),
    ...(payload.version ? { version: normalizeAssetVersion(payload.version) } : {}),
    boundary: normalizeBoundary(payload.boundary),
  };
}

export function createDesktopAssetDefinitionsListRequest(
  payload: DesktopAssetDefinitionsListRequestPayload,
  options?: { requestId?: string; correlationId?: string },
): DesktopAssetDefinitionsListRequest {
  return createIpcRequest(
    DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL,
    { ...payload, boundary: normalizeBoundary(payload.boundary) },
    options,
  );
}

export function createDesktopAssetDefinitionReadRequest(
  payload: DesktopAssetDefinitionReadRequestPayload,
  options?: { requestId?: string; correlationId?: string },
): DesktopAssetDefinitionReadRequest {
  return createIpcRequest(
    DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL,
    normalizeDefinitionReadPayload(payload),
    options,
  );
}

export function createDesktopAssetDefinitionVersionReadRequest(
  payload: Required<Pick<DesktopAssetDefinitionReadRequestPayload, "definitionId" | "version">> & Omit<DesktopAssetDefinitionReadRequestPayload, "definitionId" | "version">,
  options?: { requestId?: string; correlationId?: string },
): DesktopAssetDefinitionVersionReadRequest {
  return createIpcRequest(
    DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL,
    normalizeDefinitionReadPayload(payload) as DesktopAssetDefinitionVersionReadRequest["payload"],
    options,
  );
}

export function createDesktopAssetDefinitionsListSuccessResponse(
  value: AssetRegistryListResult<AssetDefinitionCard>,
  options?: { requestId?: string; correlationId?: string },
): DesktopAssetDefinitionsListResponse {
  return createIpcSuccessResponse(DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL, value, options);
}

export function createDesktopAssetDefinitionReadSuccessResponse(
  value: AssetDefinitionDetail,
  options?: { requestId?: string; correlationId?: string },
): DesktopAssetDefinitionReadResponse {
  return createIpcSuccessResponse(DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL, value, options);
}

export function createDesktopAssetDefinitionVersionReadSuccessResponse(
  value: AssetDefinitionDetail,
  options?: { requestId?: string; correlationId?: string },
): DesktopAssetDefinitionVersionReadResponse {
  return createIpcSuccessResponse(DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL, value, options);
}

export function desktopAssetDefinitionReference(payload: Pick<DesktopAssetDefinitionReadRequestPayload, "definitionId" | "version">): AssetReference {
  return {
    kind: "asset-definition",
    id: normalizeAssetId(payload.definitionId),
    ...(payload.version ? { version: normalizeAssetVersion(payload.version) } : {}),
  };
}

export function desktopAssetDefinitionReadOptions(payload: Pick<DesktopAssetDefinitionReadRequestPayload, "expand" | "includeValidation">): AssetRegistryReadOptions {
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

export function getDesktopAssetDefinitionsListChannel(
  kind: "request",
): IpcChannel<typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION, "request", IpcChannelValue<typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION, "request">>;
export function getDesktopAssetDefinitionsListChannel(
  kind: "response",
): IpcChannel<typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION, "response", IpcChannelValue<typeof DESKTOP_ASSET_DEFINITIONS_LIST_OPERATION, "response">>;
export function getDesktopAssetDefinitionsListChannel(kind: "request" | "response") {
  return kind === "request" ? DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL : DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL;
}

export function getDesktopAssetDefinitionReadChannel(
  kind: "request",
): IpcChannel<typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION, "request", IpcChannelValue<typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION, "request">>;
export function getDesktopAssetDefinitionReadChannel(
  kind: "response",
): IpcChannel<typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION, "response", IpcChannelValue<typeof DESKTOP_ASSET_DEFINITION_READ_OPERATION, "response">>;
export function getDesktopAssetDefinitionReadChannel(kind: "request" | "response") {
  return kind === "request" ? DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL : DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL;
}

export function getDesktopAssetDefinitionVersionReadChannel(
  kind: "request",
): IpcChannel<typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION, "request", IpcChannelValue<typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION, "request">>;
export function getDesktopAssetDefinitionVersionReadChannel(
  kind: "response",
): IpcChannel<typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION, "response", IpcChannelValue<typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_OPERATION, "response">>;
export function getDesktopAssetDefinitionVersionReadChannel(kind: "request" | "response") {
  return kind === "request" ? DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL : DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL;
}
