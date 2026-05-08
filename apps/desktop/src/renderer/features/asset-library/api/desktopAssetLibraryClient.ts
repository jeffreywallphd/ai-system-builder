import {
  mapAssetDefinitionDetail,
  mapAssetDefinitionListResult,
  mapAssetResourceBackedViewDetail,
  mapAssetResourceBackedViewListResult,
  mapTransportEnvelopeError,
  mapTransportEnvelopeSuccess,
  type AssetLibraryClient,
  type AssetLibraryClientResult,
  type AssetLibraryDefinitionCard,
  type AssetLibraryDefinitionDetail,
  type AssetLibraryDetailOptions,
  type AssetLibraryListResult,
  type AssetLibraryQuery,
  type AssetLibraryResourceBackedViewCard,
  type AssetLibraryResourceBackedViewDetail,
  type AssetLibraryResourceBackedViewDetailOptions,
  type AssetLibraryResourceBackedViewQuery,
} from "../../../../../../../modules/ui/shared/asset-library";

interface DesktopAssetLibraryApiBridge {
  listAssetDefinitions?: (input?: AssetLibraryQuery, context?: { requestId?: string; correlationId?: string }) => Promise<unknown>;
  readAssetDefinition?: (
    input: { definitionId: string; version?: string; expand?: AssetLibraryDetailOptions["expand"]; includeValidation?: boolean },
    context?: { requestId?: string; correlationId?: string },
  ) => Promise<unknown>;
  readAssetDefinitionVersion?: (
    input: { definitionId: string; version: string; expand?: AssetLibraryDetailOptions["expand"]; includeValidation?: boolean },
    context?: { requestId?: string; correlationId?: string },
  ) => Promise<unknown>;
  listAssetResourceBackedViews?: (input?: AssetLibraryResourceBackedViewQuery, context?: { requestId?: string; correlationId?: string }) => Promise<unknown>;
  readAssetResourceBackedView?: (
    input: { viewId: string; expand?: AssetLibraryResourceBackedViewDetailOptions["expand"]; includeValidation?: boolean },
    context?: { requestId?: string; correlationId?: string },
  ) => Promise<unknown>;
}

function getDesktopAssetLibraryApi(): Required<DesktopAssetLibraryApiBridge> {
  const desktopApi = (globalThis as { window?: { desktopApi?: DesktopAssetLibraryApiBridge } }).window?.desktopApi;
  if (
    !desktopApi ||
    typeof desktopApi.listAssetDefinitions !== "function" ||
    typeof desktopApi.readAssetDefinition !== "function" ||
    typeof desktopApi.readAssetDefinitionVersion !== "function" ||
    typeof desktopApi.listAssetResourceBackedViews !== "function" ||
    typeof desktopApi.readAssetResourceBackedView !== "function"
  ) {
    throw new Error("Desktop Asset Library preload API is unavailable.");
  }
  return desktopApi as Required<DesktopAssetLibraryApiBridge>;
}

async function toClientResult<T>(
  call: () => Promise<unknown>,
  mapper: (payload: unknown) => T,
  fallbackMessage: string,
): Promise<AssetLibraryClientResult<T>> {
  try {
    const response = await call();
    const success = mapTransportEnvelopeSuccess(response, mapper);
    if (success) return success;
    return { ok: false, error: mapTransportEnvelopeError(response, { fallbackMessage }) };
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

export function createDesktopAssetLibraryClient(): AssetLibraryClient {
  const desktopApi = getDesktopAssetLibraryApi();

  return {
    async listAssetDefinitions(query = {}) {
      return toClientResult<AssetLibraryListResult<AssetLibraryDefinitionCard>>(
        () => desktopApi.listAssetDefinitions(query),
        mapAssetDefinitionListResult,
        "Unable to read asset definitions.",
      );
    },

    async readAssetDefinition(input, options = {}) {
      return toClientResult<AssetLibraryDefinitionDetail>(
        () => desktopApi.readAssetDefinition({
          definitionId: input.definitionId,
          ...(options.expand ? { expand: options.expand } : {}),
          ...(options.includeValidation !== undefined ? { includeValidation: options.includeValidation } : {}),
        }),
        mapAssetDefinitionDetail,
        "Unable to read asset definition.",
      );
    },

    async readAssetDefinitionVersion(input, options = {}) {
      return toClientResult<AssetLibraryDefinitionDetail>(
        () => desktopApi.readAssetDefinitionVersion({
          definitionId: input.definitionId,
          version: input.version,
          ...(options.expand ? { expand: options.expand } : {}),
          ...(options.includeValidation !== undefined ? { includeValidation: options.includeValidation } : {}),
        }),
        mapAssetDefinitionDetail,
        "Unable to read asset definition version.",
      );
    },

    async listAssetResourceBackedViews(query = {}) {
      return toClientResult<AssetLibraryListResult<AssetLibraryResourceBackedViewCard>>(
        () => desktopApi.listAssetResourceBackedViews(query),
        mapAssetResourceBackedViewListResult,
        "Unable to read asset resource-backed views.",
      );
    },

    async readAssetResourceBackedView(input, options = {}) {
      return toClientResult<AssetLibraryResourceBackedViewDetail>(
        () => desktopApi.readAssetResourceBackedView({
          viewId: input.viewId,
          ...(options.expand ? { expand: options.expand } : {}),
          ...(options.includeValidation !== undefined ? { includeValidation: options.includeValidation } : {}),
        }),
        mapAssetResourceBackedViewDetail,
        "Unable to read asset resource-backed view.",
      );
    },
  };
}
