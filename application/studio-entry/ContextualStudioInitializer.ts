import {
  StudioEntryModes,
  StudioInitializationSources,
  type ContextualStudioInitialization,
  type StudioEntryRequest,
  type StudioInitializationContext,
  type StudioInitializationPayload,
  type StudioInitializationPrefill,
} from "./StudioEntryContracts";

function normalizePrefill(prefill: StudioInitializationPrefill | undefined): StudioInitializationPrefill | undefined {
  if (!prefill) {
    return undefined;
  }
  return Object.freeze({ values: Object.freeze({ ...prefill.values }) });
}

export class ContextualStudioInitializer {
  public createInitialization(
    studioType: string,
    request: StudioEntryRequest,
  ): StudioInitializationPayload {
    const normalizedStudioType = studioType.trim();
    if (!normalizedStudioType) {
      throw new Error("Studio initialization requires a studio type.");
    }

    const mode = request.mode
      ?? (request.handoff
        ? StudioEntryModes.handoff
        : request.asset
          ? StudioEntryModes.asset
          : request.intent
            ? StudioEntryModes.intent
            : StudioEntryModes.blank);

    const context = this.resolveContext(request, mode);
    const initialization: ContextualStudioInitialization = Object.freeze({ mode, context });

    return Object.freeze({
      studioType: normalizedStudioType,
      initialization,
    });
  }

  private resolveContext(
    request: StudioEntryRequest,
    mode: ContextualStudioInitialization["mode"],
  ): StudioInitializationContext {
    const prefill = normalizePrefill(request.prefill);

    if (mode === StudioEntryModes.handoff && request.handoff) {
      return Object.freeze({
        source: StudioInitializationSources.handoff,
        authoritativeAsset: request.asset
          ? Object.freeze({
            assetId: request.asset.assetId,
            versionId: request.asset.versionId,
            taxonomy: request.asset.taxonomy,
          })
          : Object.freeze({
            assetId: request.handoff.payload.assetId,
            versionId: request.handoff.payload.versionId,
            taxonomy: request.handoff.payload.taxonomy,
          }),
        handoff: Object.freeze({ handoff: request.handoff }),
        prefill,
      });
    }

    if (mode === StudioEntryModes.asset && request.asset) {
      return Object.freeze({
        source: StudioInitializationSources.asset,
        authoritativeAsset: Object.freeze({
          assetId: request.asset.assetId,
          versionId: request.asset.versionId,
          taxonomy: request.asset.taxonomy,
        }),
        prefill,
      });
    }

    if (mode === StudioEntryModes.intent && request.intent) {
      return Object.freeze({
        source: StudioInitializationSources.intent,
        intent: Object.freeze({ ...request.intent }),
        authoritativeAsset: request.asset
          ? Object.freeze({
            assetId: request.asset.assetId,
            versionId: request.asset.versionId,
            taxonomy: request.asset.taxonomy,
          })
          : undefined,
        prefill,
      });
    }

    return Object.freeze({
      source: mode === StudioEntryModes.new ? StudioInitializationSources.route : StudioInitializationSources.blank,
      prefill,
    });
  }
}
