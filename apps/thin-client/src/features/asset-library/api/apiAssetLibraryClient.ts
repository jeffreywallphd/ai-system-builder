import {
  mapAssetDefinitionDetail,
  mapAssetDefinitionListResult,
  mapTransportEnvelopeError,
  mapTransportEnvelopeSuccess,
  type AssetLibraryClient,
  type AssetLibraryClientResult,
  type AssetLibraryDefinitionCard,
  type AssetLibraryDefinitionDetail,
  type AssetLibraryDefinitionExpansion,
  type AssetLibraryDetailOptions,
  type AssetLibraryListResult,
  type AssetLibraryQuery,
} from "../../../../../../modules/ui/shared/asset-library";
import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";

export interface CreateApiAssetLibraryClientOptions {
  readonly apiBaseUrl?: string;
}

function createApiUrl(apiBaseUrl: string, suffix: string): string {
  return `${apiBaseUrl.trim().replace(/\/+$/, "") || "/api"}${suffix}`;
}

function appendCsv(query: URLSearchParams, key: string, values: readonly string[] | undefined): void {
  if (values && values.length > 0) query.set(key, values.join(","));
}

function appendBoolean(query: URLSearchParams, key: string, value: boolean | undefined): void {
  if (value !== undefined) query.set(key, value ? "true" : "false");
}

function queryStringForList(query: AssetLibraryQuery): string {
  const params = new URLSearchParams();
  if (query.searchText) params.set("q", query.searchText);
  appendCsv(params, "assetType", query.assetTypes);
  appendCsv(params, "assetFamily", query.assetFamilies);
  appendCsv(params, "lifecycleStatus", query.lifecycleStatuses);
  if (query.builtIn) params.set("builtIn", query.builtIn);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function queryStringForDetail(options: AssetLibraryDetailOptions): string {
  const params = new URLSearchParams();
  appendCsv(params, "expand", options.expand as readonly AssetLibraryDefinitionExpansion[] | undefined);
  appendBoolean(params, "includeValidation", options.includeValidation);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

async function getJson(endpoint: string): Promise<{ status: number; envelope: unknown }> {
  const response = await secureFetch(endpoint, { method: "GET" });
  return {
    status: response.status,
    envelope: parseApiEnvelope(await response.json()),
  };
}

async function toClientResult<T>(
  endpoint: string,
  mapper: (payload: unknown) => T,
  fallbackMessage: string,
): Promise<AssetLibraryClientResult<T>> {
  try {
    const { status, envelope } = await getJson(endpoint);
    const success = mapTransportEnvelopeSuccess(envelope, mapper);
    if (success) return success;
    return { ok: false, error: mapTransportEnvelopeError(envelope, { status, fallbackMessage }) };
  } catch {
    return {
      ok: false,
      error: {
        code: "internal",
        message: fallbackMessage,
      },
    };
  }
}

export function createApiAssetLibraryClient(
  options: CreateApiAssetLibraryClientOptions = {},
): AssetLibraryClient {
  const apiBaseUrl = options.apiBaseUrl ?? "/api";

  return {
    async listAssetDefinitions(query = {}) {
      return toClientResult<AssetLibraryListResult<AssetLibraryDefinitionCard>>(
        createApiUrl(apiBaseUrl, `/assets/definitions${queryStringForList(query)}`),
        mapAssetDefinitionListResult,
        "Unable to read asset definitions.",
      );
    },

    async readAssetDefinition(input, detailOptions = {}) {
      return toClientResult<AssetLibraryDefinitionDetail>(
        createApiUrl(
          apiBaseUrl,
          `/assets/definitions/${encodeURIComponent(input.definitionId)}${queryStringForDetail(detailOptions)}`,
        ),
        mapAssetDefinitionDetail,
        "Unable to read asset definition.",
      );
    },

    async readAssetDefinitionVersion(input, detailOptions = {}) {
      return toClientResult<AssetLibraryDefinitionDetail>(
        createApiUrl(
          apiBaseUrl,
          `/assets/definitions/${encodeURIComponent(input.definitionId)}/versions/${encodeURIComponent(input.version)}${queryStringForDetail(detailOptions)}`,
        ),
        mapAssetDefinitionDetail,
        "Unable to read asset definition version.",
      );
    },
  };
}
