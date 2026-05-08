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
  apiAssetDefinitionReadOptions,
  apiAssetDefinitionReference,
  createApiAssetDefinitionReadFailureResponse,
  createApiAssetDefinitionReadSuccessResponse,
  createApiAssetDefinitionVersionReadFailureResponse,
  createApiAssetDefinitionVersionReadSuccessResponse,
  createApiAssetDefinitionsListFailureResponse,
  createApiAssetDefinitionsListSuccessResponse,
  type ApiAssetDefinitionExpansion,
  type ApiAssetDefinitionsListRequestPayload,
} from "../../../../contracts/api";

interface ExpressRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  query?: Record<string, unknown>;
}

interface ExpressResponseLike {
  status: (code: number) => ExpressResponseLike;
  json: (body: unknown) => void;
}

export interface ExpressAssetRegistryRoutePort {
  get: (path: string, handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>) => void;
}

export interface RegisterAssetRegistryApiRoutesDependencies {
  app: ExpressAssetRegistryRoutePort;
  assetRegistryRead: AssetRegistryDefinitionReadPort;
}

const MAX_PUBLIC_LIMIT = 100;
const EXPANSIONS = new Set<ApiAssetDefinitionExpansion>(["aiContext", "configurationSchema", "ports", "requirements", "provenance", "metadata"]);

const getHeader = (headers: ExpressRequestLike["headers"], key: string) => {
  const value = headers?.[key];
  return Array.isArray(value) ? value[0] : value;
};

const contextFrom = (request: ExpressRequestLike) => ({
  requestId: getHeader(request.headers, "x-request-id"),
  correlationId: getHeader(request.headers, "x-correlation-id"),
});

export function registerAssetRegistryApiRoutes(dependencies: RegisterAssetRegistryApiRoutesDependencies): void {
  dependencies.app.get("/api/assets/definitions", async (request, response) => {
    const context = contextFrom(request);
    let query: Parameters<AssetRegistryDefinitionReadPort["listDefinitionCards"]>[0];
    try {
      query = toFacadeListQuery(parseListQuery(request.query ?? {}));
    } catch {
      response.status(400).json(createApiAssetDefinitionsListFailureResponse("validation", "Invalid asset definitions query.", context));
      return;
    }

    try {
      const result = await dependencies.assetRegistryRead.listDefinitionCards(query);
      response.status(200).json(createApiAssetDefinitionsListSuccessResponse(result, context));
    } catch {
      response.status(500).json(createApiAssetDefinitionsListFailureResponse("internal", "Unable to read asset definitions.", context));
    }
  });

  dependencies.app.get("/api/assets/definitions/:definitionId", async (request, response) => {
    const context = contextFrom(request);
    let payload;
    try {
      payload = parseDefinitionReadRequest(request, request.query?.version);
    } catch {
      response.status(400).json(createApiAssetDefinitionReadFailureResponse("validation", "Invalid asset definition read request.", context));
      return;
    }

    try {
      const detail = await dependencies.assetRegistryRead.readDefinitionDetail(
        apiAssetDefinitionReference(payload),
        apiAssetDefinitionReadOptions(payload),
      );
      if (!detail) {
        response.status(404).json(createApiAssetDefinitionReadFailureResponse("not-found", "Asset definition was not found.", context));
        return;
      }
      response.status(200).json(createApiAssetDefinitionReadSuccessResponse(detail, context));
    } catch {
      response.status(500).json(createApiAssetDefinitionReadFailureResponse("internal", "Unable to read asset definition.", context));
    }
  });

  dependencies.app.get("/api/assets/definitions/:definitionId/versions/:version", async (request, response) => {
    const context = contextFrom(request);
    let payload;
    try {
      payload = parseDefinitionReadRequest(request, request.params?.version);
    } catch {
      response.status(400).json(createApiAssetDefinitionVersionReadFailureResponse("validation", "Invalid asset definition version read request.", context));
      return;
    }

    try {
      const detail = await dependencies.assetRegistryRead.readDefinitionDetail(
        apiAssetDefinitionReference(payload),
        apiAssetDefinitionReadOptions(payload),
      );
      if (!detail) {
        response.status(404).json(createApiAssetDefinitionVersionReadFailureResponse("not-found", "Asset definition version was not found.", context));
        return;
      }
      response.status(200).json(createApiAssetDefinitionVersionReadSuccessResponse(detail, context));
    } catch {
      response.status(500).json(createApiAssetDefinitionVersionReadFailureResponse("internal", "Unable to read asset definition version.", context));
    }
  });
}

function parseListQuery(query: Record<string, unknown>): ApiAssetDefinitionsListRequestPayload {
  return {
    ...(singleString(query.q, "q") ? { q: singleString(query.q, "q") } : {}),
    ...(query.assetType !== undefined ? { assetType: parseCsv(query.assetType, "assetType").map((value) => assertKnown(value, isAssetType, ASSET_TYPES, "assetType")) as AssetType[] } : {}),
    ...(query.assetFamily !== undefined ? { assetFamily: parseCsv(query.assetFamily, "assetFamily").map((value) => assertKnown(value, isAssetFamily, ASSET_FAMILIES, "assetFamily")) as AssetFamily[] } : {}),
    ...(query.lifecycleStatus !== undefined ? { lifecycleStatus: parseCsv(query.lifecycleStatus, "lifecycleStatus").map((value) => assertKnown(value, isAssetLifecycleStatus, ASSET_LIFECYCLE_STATUSES, "lifecycleStatus")) as AssetLifecycleStatus[] } : {}),
    ...(query.builtIn !== undefined ? { builtIn: parseBuiltIn(singleString(query.builtIn, "builtIn")) } : {}),
    ...(query.limit !== undefined ? { limit: parseLimit(singleString(query.limit, "limit")) } : {}),
    ...(query.cursor !== undefined ? { cursor: parseCursor(singleString(query.cursor, "cursor")) } : {}),
    ...(query.includeMetadata !== undefined ? { includeMetadata: parseBoolean(singleString(query.includeMetadata, "includeMetadata")) } : {}),
  };
}

function toFacadeListQuery(query: ApiAssetDefinitionsListRequestPayload): Parameters<AssetRegistryDefinitionReadPort["listDefinitionCards"]>[0] {
  return {
    searchText: query.q,
    assetTypes: query.assetType,
    assetFamilies: query.assetFamily,
    lifecycleStatuses: query.lifecycleStatus,
    includeBuiltIns: query.builtIn === "custom" ? false : undefined,
    includeCustom: query.builtIn === "built-in" ? false : undefined,
    includeMetadata: query.includeMetadata,
    limit: query.limit,
    cursor: query.cursor,
  };
}

function parseDefinitionReadRequest(request: ExpressRequestLike, versionValue: unknown) {
  const definitionId = normalizeAssetId(request.params?.definitionId ?? "");
  const expand = request.query?.expand === undefined ? undefined : parseCsv(request.query.expand, "expand").map((value) => {
    if (!EXPANSIONS.has(value as ApiAssetDefinitionExpansion)) throw new Error("invalid expand");
    return value as ApiAssetDefinitionExpansion;
  });
  return {
    definitionId,
    ...(versionValue !== undefined ? { version: normalizeAssetVersion(singleString(versionValue, "version")) } : {}),
    ...(expand ? { expand } : {}),
    ...(request.query?.includeValidation !== undefined ? { includeValidation: parseBoolean(singleString(request.query.includeValidation, "includeValidation")) } : {}),
  };
}

function singleString(value: unknown, name: string): string {
  if (Array.isArray(value)) {
    if (value.length !== 1 || typeof value[0] !== "string") throw new Error(`invalid ${name}`);
    return value[0];
  }
  if (typeof value !== "string") throw new Error(`invalid ${name}`);
  return value;
}

function parseCsv(value: unknown, name: string): string[] {
  return singleString(value, name).split(",").map((entry) => entry.trim()).filter(Boolean);
}

function assertKnown<T extends readonly string[]>(value: string, predicate: (value: string) => boolean, allowed: T, name: string): T[number] {
  const normalized = value.trim().toLowerCase();
  if (!predicate(normalized)) throw new Error(`${name} must be one of ${allowed.join(", ")}`);
  return normalized as T[number];
}

function parseBuiltIn(value: string): "all" | "built-in" | "custom" {
  if (value === "all" || value === "built-in" || value === "custom") return value;
  throw new Error("invalid builtIn");
}

function parseBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("invalid boolean");
}

function parseLimit(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error("invalid limit");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PUBLIC_LIMIT) throw new Error("invalid limit");
  return parsed;
}

function parseCursor(value: string): string {
  const cursor = value.trim();
  if (!cursor || cursor.length > 512 || /[\\/\x00-\x1f\x7f]/.test(cursor)) throw new Error("invalid cursor");
  return cursor;
}
