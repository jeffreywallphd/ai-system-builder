import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionTypes,
  type AssetSelectorAssetReference,
  type AssetSelectorRequest,
} from "../../../domain/studio-shell/AssetSelectorContract";
import {
  AssetSelectorSessionLifecycleStates,
  type AssetSelectorSessionStore,
} from "../../../application/studio-entry/AssetSelectorSessionStore";
import { InlineAssetCreationService } from "../../routes/InlineAssetCreation";
import {
  StudioReturnPayloadResolutionKinds,
  StudioReturnPayloadResolver,
} from "../../routes/StudioReturnPayloadResolution";

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
  private readonly inlineCreationService: Pick<InlineAssetCreationService, "stripInlineReturnFromSearch">;
  private readonly returnPayloadResolver: Pick<StudioReturnPayloadResolver, "resolveFromSearch">;

  public constructor(
    inlineCreationService: Pick<InlineAssetCreationService, "stripInlineReturnFromSearch">
    = new InlineAssetCreationService(),
    returnPayloadResolver: Pick<StudioReturnPayloadResolver, "resolveFromSearch">
    = new StudioReturnPayloadResolver(),
  ) {
    this.inlineCreationService = inlineCreationService;
    this.returnPayloadResolver = returnPayloadResolver;
  }

  public handle(input: HandleSelectorReturnInput): AssetSelectorReturnHandoffResult {
    const resolution = this.returnPayloadResolver.resolveFromSearch(input.search);
    if (!resolution.handled) {
      return Object.freeze({
        handled: false,
        consumed: false,
      });
    }

    if (resolution.selectorSessionId && resolution.selectorSessionId !== input.sessionKey) {
      return Object.freeze({
        handled: false,
        consumed: false,
      });
    }

    const session = input.sessionStore.getSession(input.sessionKey);
    if (!session) {
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (
      resolution.kind === StudioReturnPayloadResolutionKinds.created
      && session.lifecycleState !== AssetSelectorSessionLifecycleStates.creatingNew
      && session.lifecycleState !== AssetSelectorSessionLifecycleStates.returning
    ) {
      this.reportInvalidReturn(
        input,
        "Returned selector payload is stale for the current session state.",
        "session.lifecycleState",
      );
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (resolution.kind === StudioReturnPayloadResolutionKinds.cancelled) {
      input.sessionStore.resumeAfterCreationCancellation(input.sessionKey, "creation-cancelled");
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (resolution.kind === StudioReturnPayloadResolutionKinds.noSelection) {
      input.sessionStore.resumeAfterCreationCancellation(input.sessionKey, "creation-no-selection");
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (resolution.kind === StudioReturnPayloadResolutionKinds.invalid) {
      const issue = resolution.issues[0];
      input.sessionStore.reportReturnPayloadError(
        input.sessionKey,
        issue?.message ?? "Returned selector payload is malformed.",
        issue?.path,
      );
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    if (resolution.kind !== StudioReturnPayloadResolutionKinds.created || !resolution.returnedAsset) {
      return Object.freeze({
        handled: true,
        consumed: true,
        nextSearch: this.inlineCreationService.stripInlineReturnFromSearch(input.search),
      });
    }

    const returnedAsset: AssetSelectorAssetReference = resolution.returnedAsset;

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

  private reportInvalidReturn(
    input: HandleSelectorReturnInput,
    message: string,
    path?: string,
  ): void {
    input.sessionStore.reportReturnPayloadError(
      input.sessionKey,
      message,
      path,
    );
  }
}

