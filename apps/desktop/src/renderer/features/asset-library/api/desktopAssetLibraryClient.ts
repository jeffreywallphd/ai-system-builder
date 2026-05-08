import {
  mapAssetDefinitionDetail,
  mapAssetDefinitionListResult,
  mapTransportEnvelopeError,
  mapTransportEnvelopeSuccess,
  type AssetLibraryClient,
  type AssetLibraryClientResult,
  type AssetLibraryDefinitionCard,
  type AssetLibraryDefinitionDetail,
  type AssetLibraryDetailOptions,
  type AssetLibraryListResult,
  type AssetLibraryQuery,
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
}

function getDesktopAssetLibraryApi(): Required<DesktopAssetLibraryApiBridge> {
  const desktopApi = (globalThis as { window?: { desktopApi?: DesktopAssetLibraryApiBridge } }).window?.desktopApi;
  if (
    !desktopApi ||
    typeof desktopApi.listAssetDefinitions !== "function" ||
    typeof desktopApi.readAssetDefinition !== "function" ||
    typeof desktopApi.readAssetDefinitionVersion !== "function"
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
          expand: options.expand,
          includeValidation: options.includeValidation,
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
          expand: options.expand,
          includeValidation: options.includeValidation,
        }),
        mapAssetDefinitionDetail,
        "Unable to read asset definition version.",
      );
    },
  };
}
