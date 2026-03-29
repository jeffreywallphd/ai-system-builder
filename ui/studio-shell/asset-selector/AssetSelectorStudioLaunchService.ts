import type { AssetSelectorRequest } from "../../../domain/studio-shell/AssetSelectorContract";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
  type InlineAssetCreationResult,
} from "../../routes/InlineAssetCreation";

export interface AssetSelectorStudioLaunchRequest {
  readonly sessionKey: string;
  readonly selectorRequest: AssetSelectorRequest;
  readonly routePath: string;
  readonly routeSearch?: string;
  readonly routeHash?: string;
}

export class AssetSelectorStudioLaunchService {
  private readonly inlineCreationService: Pick<InlineAssetCreationService, "launch">;

  public constructor(
    inlineCreationService: Pick<InlineAssetCreationService, "launch"> = new InlineAssetCreationService(),
  ) {
    this.inlineCreationService = inlineCreationService;
  }

  public launch(input: AssetSelectorStudioLaunchRequest): InlineAssetCreationResult | undefined {
    const routePath = this.buildReturnRoutePath(input);
    return this.inlineCreationService.launch({
      requestedRole: input.selectorRequest.assetType,
      mode: InlineAssetCreationModes.inlineContext,
      context: {
        source: "studio-shell",
        sourceIntentKey: "asset-selector-create-new",
        sourceIntentLabel: "Create new asset from selector",
        sourceMetadata: Object.freeze({
          selectorSessionId: input.sessionKey,
          selectorAssetType: input.selectorRequest.assetType,
          selectorOriginStudio: input.selectorRequest.context.originatingStudio,
          selectorOriginField: input.selectorRequest.context.originatingField,
        }),
      },
      returnTarget: {
        routePath,
        contextId: input.sessionKey,
      },
      selectorLaunch: {
        selectorSessionId: input.sessionKey,
        assetType: input.selectorRequest.assetType,
        returnRoutePath: routePath,
      },
    });
  }

  private buildReturnRoutePath(input: AssetSelectorStudioLaunchRequest): string {
    const search = input.routeSearch?.trim();
    const hash = input.routeHash?.trim();
    const withSearch = search ? `${input.routePath}${search.startsWith("?") ? search : `?${search}`}` : input.routePath;
    if (!hash) {
      return withSearch;
    }
    return hash.startsWith("#") ? `${withSearch}${hash}` : `${withSearch}#${hash}`;
  }
}

