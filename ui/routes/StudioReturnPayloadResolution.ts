import type { AssetSelectorAssetReference } from "../../domain/studio-shell/AssetSelectorContract";
import {
  InlineAssetCreationService,
  InlineAssetReturnStatuses,
  type InlineAssetReturnPayload,
} from "./InlineAssetCreation";
import type { StudioLaunchHandoffContract } from "./StudioHandoffContract";

export const StudioReturnPayloadResolutionKinds = Object.freeze({
  none: "none",
  created: "created",
  cancelled: "cancelled",
  noSelection: "no-selection",
  invalid: "invalid",
});

export type StudioReturnPayloadResolutionKind =
  typeof StudioReturnPayloadResolutionKinds[keyof typeof StudioReturnPayloadResolutionKinds];

export interface StudioReturnPayloadResolutionIssue {
  readonly message: string;
  readonly path?: string;
}

export interface StudioReturnPayloadResolution {
  readonly handled: boolean;
  readonly kind: StudioReturnPayloadResolutionKind;
  readonly payload?: InlineAssetReturnPayload;
  readonly handoff?: StudioLaunchHandoffContract;
  readonly selectorSessionId?: string;
  readonly selectorTargetId?: string;
  readonly originatingField?: string;
  readonly usageContext?: string;
  readonly returnedAsset?: AssetSelectorAssetReference;
  readonly issues: ReadonlyArray<StudioReturnPayloadResolutionIssue>;
}

function isCanonicalAssetIdentity(value?: string): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.startsWith("asset:");
}

function resolveSelectorSessionId(
  payload: InlineAssetReturnPayload,
  handoff?: StudioLaunchHandoffContract,
): string | undefined {
  return payload.returnContextId?.trim()
    || handoff?.target.selector.selectorSessionId?.trim()
    || handoff?.returnContract.target.contextId?.trim()
    || undefined;
}

export class StudioReturnPayloadResolver {
  private readonly inlineCreationService: Pick<InlineAssetCreationService, "parseInlineReturnFromSearch" | "parseStudioHandoffFromSearch">;

  public constructor(
    inlineCreationService: Pick<InlineAssetCreationService, "parseInlineReturnFromSearch" | "parseStudioHandoffFromSearch">
    = new InlineAssetCreationService(),
  ) {
    this.inlineCreationService = inlineCreationService;
  }

  public resolveFromSearch(search: string): StudioReturnPayloadResolution {
    const payload = this.inlineCreationService.parseInlineReturnFromSearch(search);
    if (!payload) {
      return Object.freeze({
        handled: false,
        kind: StudioReturnPayloadResolutionKinds.none,
        issues: Object.freeze([]),
      });
    }

    const handoff = this.inlineCreationService.parseStudioHandoffFromSearch(search);
    const selectorSessionId = resolveSelectorSessionId(payload, handoff);
    const selectorTargetId = handoff?.target.selector.selectorTargetId;
    const originatingField = handoff?.target.selector.originatingField;
    const usageContext = handoff?.target.selector.usageContext;

    if (payload.status === InlineAssetReturnStatuses.cancelled) {
      return Object.freeze({
        handled: true,
        kind: StudioReturnPayloadResolutionKinds.cancelled,
        payload,
        handoff,
        selectorSessionId,
        selectorTargetId,
        originatingField,
        usageContext,
        issues: Object.freeze([]),
      });
    }

    if (payload.status === InlineAssetReturnStatuses.noSelection) {
      return Object.freeze({
        handled: true,
        kind: StudioReturnPayloadResolutionKinds.noSelection,
        payload,
        handoff,
        selectorSessionId,
        selectorTargetId,
        originatingField,
        usageContext,
        issues: Object.freeze([]),
      });
    }

    const issues: StudioReturnPayloadResolutionIssue[] = [];
    if (!isCanonicalAssetIdentity(payload.assetId)) {
      issues.push(Object.freeze({
        message: "Returned selector payload must include canonical assetId.",
        path: "result.assets[0].assetId",
      }));
    }
    if (!payload.assetType?.trim()) {
      issues.push(Object.freeze({
        message: "Returned selector payload must include assetType.",
        path: "result.assets[0].assetType",
      }));
    }
    if (payload.versionId && !isCanonicalAssetIdentity(payload.versionId)) {
      issues.push(Object.freeze({
        message: "Returned selector payload versionId must use canonical 'asset:' identity.",
        path: "result.assets[0].versionId",
      }));
    }

    if (issues.length > 0) {
      return Object.freeze({
        handled: true,
        kind: StudioReturnPayloadResolutionKinds.invalid,
        payload,
        handoff,
        selectorSessionId,
        selectorTargetId,
        originatingField,
        usageContext,
        issues: Object.freeze(issues),
      });
    }

    return Object.freeze({
      handled: true,
      kind: StudioReturnPayloadResolutionKinds.created,
      payload,
      handoff,
      selectorSessionId,
      selectorTargetId,
      originatingField,
      usageContext,
      returnedAsset: Object.freeze({
        assetId: payload.assetId as string,
        versionId: payload.versionId,
        assetType: payload.assetType as AssetSelectorAssetReference["assetType"],
        displayName: payload.displayName,
      }),
      issues: Object.freeze([]),
    });
  }
}
