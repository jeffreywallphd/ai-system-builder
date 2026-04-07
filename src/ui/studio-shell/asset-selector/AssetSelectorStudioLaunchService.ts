import type { AssetSelectorRequest } from "../../../domain/studio-shell/AssetSelectorContract";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
  type InlineAssetCreationResult,
} from "../../routes/InlineAssetCreation";
import {
  createWorkflowStudioOriginLaunchContext,
  type WorkflowStudioDraftLaunchReference,
} from "../workflow/WorkflowStudioLaunchContext";

export interface AssetSelectorWorkflowOriginContext {
  readonly studioId: string;
  readonly modeId?: string;
  readonly wizardPageId?: string;
  readonly draftReference?: WorkflowStudioDraftLaunchReference;
  readonly draftState?: string;
}

export interface AssetSelectorStudioLaunchRequest {
  readonly sessionKey: string;
  readonly selectorRequest: AssetSelectorRequest;
  readonly routePath: string;
  readonly routeSearch?: string;
  readonly routeHash?: string;
  readonly selectorTargetId?: string;
  readonly workflowOrigin?: AssetSelectorWorkflowOriginContext;
}

export class AssetSelectorStudioLaunchService {
  private static readonly maxDraftStateLength = 8_000;
  private readonly inlineCreationService: Pick<InlineAssetCreationService, "launch">;

  public constructor(
    inlineCreationService: Pick<InlineAssetCreationService, "launch"> = new InlineAssetCreationService(),
  ) {
    this.inlineCreationService = inlineCreationService;
  }

  public launch(input: AssetSelectorStudioLaunchRequest): InlineAssetCreationResult | undefined {
    const routePath = this.buildReturnRoutePath(input);
    const studioHandoff = this.buildStudioHandoff(input, routePath);
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
      studioHandoff,
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

  private buildStudioHandoff(
    input: AssetSelectorStudioLaunchRequest,
    returnRoutePath: string,
  ) {
    if (input.selectorRequest.context.originatingStudio !== "workflow-studio") {
      return undefined;
    }

    const workflowOrigin = input.workflowOrigin ?? {
      studioId: "studio-workflows",
    };

    const returnSearch = input.routeSearch?.trim();
    const returnHash = input.routeHash?.trim();
    const handoffId = this.createHandoffId(input);
    const boundedDraftState = workflowOrigin.draftState
      && workflowOrigin.draftState.length <= AssetSelectorStudioLaunchService.maxDraftStateLength
      ? workflowOrigin.draftState
      : undefined;

    return createWorkflowStudioOriginLaunchContext({
      handoffId,
      routePath: input.routePath,
      routeSearch: returnSearch,
      routeHash: returnHash,
      returnRoutePath,
      selectorTarget: {
        selectorSessionId: input.sessionKey,
        assetType: input.selectorRequest.assetType,
        originatingField: input.selectorRequest.context.originatingField,
        usageContext: input.selectorRequest.context.usageContext,
        selectorTargetId: input.selectorTargetId,
      },
      workflow: {
        studioId: workflowOrigin.studioId,
        modeId: workflowOrigin.modeId,
        wizardPageId: workflowOrigin.wizardPageId,
        draftReference: workflowOrigin.draftReference,
        draftState: boundedDraftState,
      },
    });
  }

  private createHandoffId(input: AssetSelectorStudioLaunchRequest): string {
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    return `handoff:${input.sessionKey}:${input.selectorRequest.assetType}:${Date.now()}:${randomSuffix}`;
  }
}

