import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionTypes,
  type AssetSelectorAssetReference,
  type AssetSelectorRequest,
} from "../../../domain/studio-shell/AssetSelectorContract";
import type { AssetSelectorSessionStore } from "../../../application/studio-entry/AssetSelectorSessionStore";
import { InlineAssetReturnStatuses, InlineAssetCreationService } from "../../routes/InlineAssetCreation";

export interface AssetSelectorReturnHandoffResult {
  readonly handled: boolean;
  readonly consumed: boolean;
  readonly nextSearch?: string;
  readonly returnedAsset?: AssetSelectorAssetReference;
}

export interface HandleSelectorReturnInput {
  readonly search: string;
  readonly sessionKey: string;
  readonly request: AssetSelectorRequest;
  readonly sessionStore: Pick<
    AssetSelectorSessionStore,
    "getSession" | "handleReturnPayload" | "resumeAfterCreationCancellation" | "activateSession" | "reportReturnPayloadError"
  >;
}

export class AssetSelectorReturnHandoffService {
  private readonly inlineCreationService: Pick<
    InlineAssetCreationService,
    "parseInlineReturnFromSearch" | "stripInlineReturnFromSearch"
  >;

  public constructor(
    inlineCreationService: Pick<InlineAssetCreationService, "parseInlineReturnFromSearch" | "stripInlineReturnFromSearch">
    = new InlineAssetCreationService(),
  ) {
    this.inlineCreationService = inlineCreationService;
  }

  public handle(input: HandleSelectorReturnInput): AssetSelectorReturnHandoffResult {
    const payload = this.inlineCreationService.parseInlineReturnFromSearch(input.search);
    if (!payload) {
      return Object.freeze({
        handled: false,
        consumed: false,
      });
    }

    if (payload.returnContextId && payload.returnContextId !== input.sessionKey) {
      return Object.freeze({
        handled: false,
        consumed: false,
      });
    }

    if (!input.sessionStore.getSession(input.sessionKey)) {
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (payload.status === InlineAssetReturnStatuses.cancelled) {
      input.sessionStore.resumeAfterCreationCancellation(input.sessionKey, "creation-cancelled");
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (!payload.assetId?.trim()) {
      input.sessionStore.reportReturnPayloadError(
        input.sessionKey,
        "Returned selector payload is missing required assetId.",
        "result.assets[0].assetId",
      );
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (!payload.assetType?.trim()) {
      input.sessionStore.reportReturnPayloadError(
        input.sessionKey,
        "Returned selector payload is missing required assetType.",
        "result.assets[0].assetType",
      );
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    const returnedAsset: AssetSelectorAssetReference = Object.freeze({
      assetId: payload.assetId,
      versionId: payload.versionId,
      assetType: payload.assetType,
      displayName: payload.displayName,
    });

    const stateAfterReturn = input.sessionStore.handleReturnPayload({
      sessionKey: input.sessionKey,
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.createNewAsset,
        assets: [returnedAsset],
      },
    });

    if (stateAfterReturn.validationErrors.length === 0) {
      input.sessionStore.activateSession(input.sessionKey);
    }

    return Object.freeze({
      handled: true,
      consumed: true,
      nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      returnedAsset: stateAfterReturn.validationErrors.length === 0 ? returnedAsset : undefined,
    });
  }
}

