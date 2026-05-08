import type { AssetRegistryDefinitionReadPort } from "../../../../application/ports/asset";
import {
  ASSET_FAMILIES,
  ASSET_LIFECYCLE_STATUSES,
  ASSET_TYPES,
  isAssetFamily,
  isAssetLifecycleStatus,
  isAssetType,
  normalizeAssetId,
  normalizeAssetVersion,
  type AssetFamily,
  type AssetLifecycleStatus,
  type AssetType,
} from "../../../../contracts/asset";
import {
  DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL,
  DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL,
  DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL,
  createDesktopAssetDefinitionReadSuccessResponse,
  createDesktopAssetDefinitionVersionReadSuccessResponse,
  createDesktopAssetDefinitionsListSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  desktopAssetDefinitionReadOptions,
  desktopAssetDefinitionReference,
  type DesktopAssetBuiltInFilter,
  type DesktopAssetDefinitionExpansion,
  type DesktopAssetDefinitionReadRequest,
  type DesktopAssetDefinitionReadRequestPayload,
  type DesktopAssetDefinitionReadResponse,
  type DesktopAssetDefinitionVersionReadRequest,
  type DesktopAssetDefinitionVersionReadResponse,
  type DesktopAssetDefinitionsListRequest,
  type DesktopAssetDefinitionsListRequestPayload,
  type DesktopAssetDefinitionsListResponse,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface RegisterAssetRegistryIpcDependencies {
  readonly ipcMain: IpcMainHandlePort;
  readonly assetRegistryRead: AssetRegistryDefinitionReadPort;
}

const MAX_PUBLIC_LIMIT = 100;
const EXPANSIONS = new Set<DesktopAssetDefinitionExpansion>(["aiContext", "configurationSchema", "ports", "requirements", "provenance", "metadata"]);

export function createDesktopAssetDefinitionsListIpcHandler(
  dependencies: Pick<RegisterAssetRegistryIpcDependencies, "assetRegistryRead">,
) {
  return async (
    _event: unknown,
    request: DesktopAssetDefinitionsListRequest,
  ): Promise<DesktopAssetDefinitionsListResponse> => {
    const context = requestContext(request);
    let query;
    try {
      query = toFacadeListQuery(parseListPayload(request.payload));
    } catch {
      return failure(DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL, "validation", "Invalid asset definitions query.", context);
    }

    try {
      const result = await dependencies.assetRegistryRead.listDefinitionCards(query);
      return createDesktopAssetDefinitionsListSuccessResponse(result, context);
    } catch {
      return failure(DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL, "internal", "Unable to read asset definitions.", context);
    }
  };
}

export function createDesktopAssetDefinitionReadIpcHandler(
  dependencies: Pick<RegisterAssetRegistryIpcDependencies, "assetRegistryRead">,
) {
  return async (
    _event: unknown,
    request: DesktopAssetDefinitionReadRequest,
  ): Promise<DesktopAssetDefinitionReadResponse> => {
    const context = requestContext(request);
    let payload;
    try {
      payload = parseDefinitionReadPayload(request.payload, false);
    } catch {
      return failure(DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL, "validation", "Invalid asset definition read request.", context);
    }

    try {
      const detail = await dependencies.assetRegistryRead.readDefinitionDetail(
        desktopAssetDefinitionReference(payload),
        desktopAssetDefinitionReadOptions(payload),
      );
      if (!detail) {
        return failure(DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL, "not-found", "Asset definition was not found.", context);
      }
      return createDesktopAssetDefinitionReadSuccessResponse(detail, context);
    } catch {
      return failure(DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL, "internal", "Unable to read asset definition.", context);
    }
  };
}

export function createDesktopAssetDefinitionVersionReadIpcHandler(
  dependencies: Pick<RegisterAssetRegistryIpcDependencies, "assetRegistryRead">,
) {
  return async (
    _event: unknown,
    request: DesktopAssetDefinitionVersionReadRequest,
  ): Promise<DesktopAssetDefinitionVersionReadResponse> => {
    const context = requestContext(request);
    let payload;
    try {
      payload = parseDefinitionReadPayload(request.payload, true);
    } catch {
      return failure(DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL, "validation", "Invalid asset definition version read request.", context);
    }

    try {
      const detail = await dependencies.assetRegistryRead.readDefinitionDetail(
        desktopAssetDefinitionReference(payload),
        desktopAssetDefinitionReadOptions(payload),
      );
      if (!detail) {
        return failure(DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL, "not-found", "Asset definition version was not found.", context);
      }
      return createDesktopAssetDefinitionVersionReadSuccessResponse(detail, context);
    } catch {
      return failure(DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL, "internal", "Unable to read asset definition version.", context);
    }
  };
}

export function registerAssetRegistryIpc(dependencies: RegisterAssetRegistryIpcDependencies): void {
  dependencies.ipcMain.handle(
    DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL.value,
    createDesktopAssetDefinitionsListIpcHandler({ assetRegistryRead: dependencies.assetRegistryRead }),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL.value,
    createDesktopAssetDefinitionReadIpcHandler({ assetRegistryRead: dependencies.assetRegistryRead }),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL.value,
    createDesktopAssetDefinitionVersionReadIpcHandler({ assetRegistryRead: dependencies.assetRegistryRead }),
  );
}

function requestContext(request: { requestId?: string; correlationId?: string }) {
  return {
    requestId: request.requestId,
    correlationId: request.correlationId,
  };
}

function failure<TResponseChannel extends typeof DESKTOP_ASSET_DEFINITIONS_LIST_RESPONSE_CHANNEL | typeof DESKTOP_ASSET_DEFINITION_READ_RESPONSE_CHANNEL | typeof DESKTOP_ASSET_DEFINITION_VERSION_READ_RESPONSE_CHANNEL>(
  channel: TResponseChannel,
  code: "validation" | "internal" | "not-found" | "unavailable",
  message: string,
  context: { requestId?: string; correlationId?: string },
  details?: Record<string, unknown>,
): any {
  return createIpcFailureResponse(createIpcError(channel, code, message, {
    details,
    requestId: context.requestId,
    correlationId: context.correlationId,
  }));
}

function parseListPayload(payload: unknown): DesktopAssetDefinitionsListRequestPayload {
  const record = requireRecord(payload);
  return {
    ...(record.searchText !== undefined ? { searchText: optionalString(record.searchText, "searchText") } : {}),
    ...(record.assetTypes !== undefined ? { assetTypes: parseStringArray(record.assetTypes, "assetTypes").map((value) => assertKnown(value, isAssetType, ASSET_TYPES, "assetTypes")) as AssetType[] } : {}),
    ...(record.assetFamilies !== undefined ? { assetFamilies: parseStringArray(record.assetFamilies, "assetFamilies").map((value) => assertKnown(value, isAssetFamily, ASSET_FAMILIES, "assetFamilies")) as AssetFamily[] } : {}),
    ...(record.lifecycleStatuses !== undefined ? { lifecycleStatuses: parseStringArray(record.lifecycleStatuses, "lifecycleStatuses").map((value) => assertKnown(value, isAssetLifecycleStatus, ASSET_LIFECYCLE_STATUSES, "lifecycleStatuses")) as AssetLifecycleStatus[] } : {}),
    ...(record.builtIn !== undefined ? { builtIn: parseBuiltIn(record.builtIn) } : {}),
    ...(record.limit !== undefined ? { limit: parseLimit(record.limit) } : {}),
    ...(record.cursor !== undefined ? { cursor: parseCursor(record.cursor) } : {}),
    ...(record.includeMetadata !== undefined ? { includeMetadata: parseBoolean(record.includeMetadata, "includeMetadata") } : {}),
    boundary: parseBoundary(record.boundary),
  };
}

function toFacadeListQuery(payload: DesktopAssetDefinitionsListRequestPayload): Parameters<AssetRegistryDefinitionReadPort["listDefinitionCards"]>[0] {
  return {
    searchText: payload.searchText,
    assetTypes: payload.assetTypes,
    assetFamilies: payload.assetFamilies,
    lifecycleStatuses: payload.lifecycleStatuses,
    includeBuiltIns: payload.builtIn === "custom" ? false : undefined,
    includeCustom: payload.builtIn === "built-in" ? false : undefined,
    includeMetadata: payload.includeMetadata,
    limit: payload.limit,
    cursor: payload.cursor,
  };
}

function parseDefinitionReadPayload(payload: unknown, requireVersion: boolean): DesktopAssetDefinitionReadRequestPayload {
  const record = requireRecord(payload);
  const definitionId = normalizeAssetId(requiredString(record.definitionId, "definitionId"));
  const versionValue = record.version === undefined ? undefined : normalizeAssetVersion(requiredString(record.version, "version"));
  if (requireVersion && !versionValue) throw new Error("version is required");
  const expand = record.expand === undefined ? undefined : parseStringArray(record.expand, "expand").map((value) => {
    if (!EXPANSIONS.has(value as DesktopAssetDefinitionExpansion)) throw new Error("invalid expand");
    return value as DesktopAssetDefinitionExpansion;
  });
  return {
    definitionId,
    ...(versionValue ? { version: versionValue } : {}),
    ...(expand ? { expand } : {}),
    ...(record.includeValidation !== undefined ? { includeValidation: parseBoolean(record.includeValidation, "includeValidation") } : {}),
    boundary: parseBoundary(record.boundary),
  };
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("payload must be an object");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${fieldName} must be non-empty`);
  return trimmed;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new Error(`${fieldName} must be a string array`);
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function assertKnown<T extends readonly string[]>(value: string, predicate: (value: string) => boolean, allowed: T, fieldName: string): T[number] {
  const normalized = value.trim().toLowerCase();
  if (!predicate(normalized)) throw new Error(`${fieldName} must be one of ${allowed.join(", ")}`);
  return normalized as T[number];
}

function parseBuiltIn(value: unknown): DesktopAssetBuiltInFilter {
  if (value === "all" || value === "built-in" || value === "custom") return value;
  throw new Error("builtIn must be all, built-in, or custom");
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === "boolean") return value;
  throw new Error(`${fieldName} must be boolean`);
}

function parseLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > MAX_PUBLIC_LIMIT) throw new Error("invalid limit");
  return value;
}

function parseCursor(value: unknown): string {
  const cursor = requiredString(value, "cursor");
  if (cursor.length > 512 || /[\\/\x00-\x1f\x7f]/.test(cursor)) throw new Error("invalid cursor");
  return cursor;
}

function parseBoundary(value: unknown): DesktopAssetDefinitionsListRequestPayload["boundary"] {
  const record = requireRecord(value);
  if (record.host !== "desktop") throw new Error("boundary.host must be desktop");
  return {
    host: "desktop",
    source: requiredString(record.source, "boundary.source"),
  };
}
