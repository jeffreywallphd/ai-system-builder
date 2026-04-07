import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import { StudioEntryModes, type StudioEntryRequest, type StudioEntryResolution } from "../../application/studio-entry/StudioEntryContracts";
import { StudioEntryResolver } from "./StudioRouteMapping";
import {
  parseStudioLaunchHandoffContract,
  serializeStudioLaunchHandoffContract,
  StudioLaunchHandoffQueryParam,
  type StudioLaunchHandoffContract,
} from "./StudioHandoffContract";

export const InlineAssetCreationModes = Object.freeze({
  inlineContext: "inline-context",
  embedded: "embedded",
  systemIntake: "system-intake",
});

export type InlineAssetCreationMode = typeof InlineAssetCreationModes[keyof typeof InlineAssetCreationModes];

export interface InlineAssetCreationReturnTarget {
  readonly routePath: string;
  readonly contextId?: string;
  readonly parentAssetId?: string;
  readonly parentVersionId?: string;
  readonly selectedComponent?: string;
}

export interface InlineAssetCreationContext {
  readonly source: "registry" | "studio-shell" | "system-studio" | "unknown";
  readonly sourceIntentKey?: string;
  readonly sourceIntentLabel?: string;
  readonly sourceMetadata?: Readonly<Record<string, string>>;
  readonly prefill?: Readonly<Record<string, unknown>>;
}

export interface InlineAssetCreationRequest {
  readonly requestedRole?: TaxonomySemanticRole;
  readonly requestedStudioType?: string;
  readonly mode?: InlineAssetCreationMode;
  readonly context: InlineAssetCreationContext;
  readonly returnTarget?: InlineAssetCreationReturnTarget;
  readonly selectorLaunch?: InlineAssetSelectorLaunchContext;
  readonly studioHandoff?: StudioLaunchHandoffContract;
}

export interface InlineAssetCreationResult {
  readonly mode: InlineAssetCreationMode;
  readonly launchPath: string;
  readonly returnTarget?: InlineAssetCreationReturnTarget;
  readonly selectorLaunch?: InlineAssetSelectorLaunchContext;
  readonly studioHandoff?: StudioLaunchHandoffContract;
  readonly studioEntry: StudioEntryResolution;
}

export const InlineAssetReturnStatuses = Object.freeze({
  created: "created",
  cancelled: "cancelled",
  noSelection: "no-selection",
  abandoned: "abandoned",
});

export type InlineAssetReturnStatus = typeof InlineAssetReturnStatuses[keyof typeof InlineAssetReturnStatuses];

export interface InlineAssetReturnPayload {
  readonly status: InlineAssetReturnStatus;
  readonly assetId?: string;
  readonly versionId?: string;
  readonly assetType?: TaxonomySemanticRole;
  readonly displayName?: string;
  readonly sourceStudioType?: string;
  readonly sourceStudioId?: string;
  readonly returnContextId?: string;
  readonly handoffId?: string;
}

export interface InlineAssetSelectorLaunchContext {
  readonly selectorSessionId: string;
  readonly assetType: TaxonomySemanticRole;
  readonly returnRoutePath?: string;
}

function toEntryContextSource(source: InlineAssetCreationContext["source"]): "navigation" | "registry" | "system-studio" | "intent" | "unknown" {
  if (source === "registry") {
    return "registry";
  }
  if (source === "system-studio") {
    return "system-studio";
  }
  if (source === "studio-shell") {
    return "intent";
  }
  return "unknown";
}

function appendReturnTarget(path: string, request: InlineAssetCreationRequest): string {
  const [routeAndSearch, hash] = path.split("#");
  const [routePath, search] = routeAndSearch.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set("inlineCreate", "1");
  params.set("inlineMode", request.mode ?? InlineAssetCreationModes.inlineContext);
  params.set("inlineOrigin", request.context.source);

  if (request.returnTarget) {
    params.set("returnTo", request.returnTarget.routePath);
    if (request.returnTarget.contextId) {
      params.set("returnContextId", request.returnTarget.contextId);
    }
    if (request.returnTarget.parentAssetId) {
      params.set("parentAssetId", request.returnTarget.parentAssetId);
    }
    if (request.returnTarget.parentVersionId) {
      params.set("parentVersionId", request.returnTarget.parentVersionId);
    }
    if (request.returnTarget.selectedComponent) {
      params.set("selectedComponent", request.returnTarget.selectedComponent);
    }
  }

  if (request.selectorLaunch) {
    params.set("selectorLaunch", "1");
    params.set("selectorSessionId", request.selectorLaunch.selectorSessionId);
    params.set("selectorAssetType", request.selectorLaunch.assetType);
    if (request.selectorLaunch.returnRoutePath?.trim()) {
      params.set("selectorReturnTo", request.selectorLaunch.returnRoutePath.trim());
    }
  }

  if (request.studioHandoff) {
    params.set(StudioLaunchHandoffQueryParam, serializeStudioLaunchHandoffContract(request.studioHandoff));
  }

  const query = params.toString();
  const encodedHash = hash ? `#${hash}` : "";
  return query.length > 0 ? `${routePath}?${query}${encodedHash}` : `${routePath}${encodedHash}`;
}

function parseInlineReturnStatus(value?: string | null): InlineAssetReturnStatus | undefined {
  if (
    value === InlineAssetReturnStatuses.created
    || value === InlineAssetReturnStatuses.cancelled
    || value === InlineAssetReturnStatuses.noSelection
    || value === InlineAssetReturnStatuses.abandoned
  ) {
    return value;
  }
  return undefined;
}

export class InlineAssetCreationService {
  private readonly entryResolver = new StudioEntryResolver();

  public launch(request: InlineAssetCreationRequest): InlineAssetCreationResult | undefined {
    const entryRequest: StudioEntryRequest = {
      requestedRole: request.requestedRole,
      requestedStudioType: request.requestedStudioType,
      mode: StudioEntryModes.new,
      intent: request.context.sourceIntentKey
        ? {
          key: request.context.sourceIntentKey,
          label: request.context.sourceIntentLabel,
          metadata: request.context.sourceMetadata,
        }
        : undefined,
      prefill: request.context.prefill ? { values: request.context.prefill } : undefined,
      entryContext: {
        source: toEntryContextSource(request.context.source),
        parentAssetId: request.returnTarget?.parentAssetId,
        parentVersionId: request.returnTarget?.parentVersionId,
        selectedComponent: request.returnTarget?.selectedComponent,
      },
    };

    const studioEntry = this.entryResolver.resolve(entryRequest);
    if (!studioEntry) {
      return undefined;
    }

    const launchPath = appendReturnTarget(`${studioEntry.entryPoint.routePath}?entryMode=${studioEntry.mode}`, request);
    return Object.freeze({
      mode: request.mode ?? InlineAssetCreationModes.inlineContext,
      launchPath,
      returnTarget: request.returnTarget,
      selectorLaunch: request.selectorLaunch,
      studioHandoff: request.studioHandoff,
      studioEntry,
    });
  }

  public parseReturnTargetFromSearch(search: string): InlineAssetCreationReturnTarget | undefined {
    const params = new URLSearchParams(search);
    const returnTo = params.get("returnTo")?.trim();
    if (!returnTo) {
      const handoff = this.parseStudioHandoffFromSearch(search);
      if (!handoff) {
        return undefined;
      }
      return Object.freeze({
        routePath: handoff.returnContract.target.routePath,
        contextId: handoff.returnContract.target.contextId,
      });
    }

    return Object.freeze({
      routePath: returnTo,
      contextId: params.get("returnContextId")?.trim() || undefined,
      parentAssetId: params.get("parentAssetId")?.trim() || undefined,
      parentVersionId: params.get("parentVersionId")?.trim() || undefined,
      selectedComponent: params.get("selectedComponent")?.trim() || undefined,
    });
  }

  public buildReturnPath(input: {
    readonly returnTarget: InlineAssetCreationReturnTarget;
    readonly payload: InlineAssetReturnPayload;
  }): string {
    const [routeAndSearch, hash] = input.returnTarget.routePath.split("#");
    const [routePath, existingSearch] = routeAndSearch.split("?");
    const params = new URLSearchParams(existingSearch ?? "");
    params.set("inlineReturn", "1");
    params.set("inlineStatus", input.payload.status);
    if (input.payload.assetId?.trim()) {
      params.set("inlineAssetId", input.payload.assetId.trim());
    } else {
      params.delete("inlineAssetId");
    }
    if (input.payload.versionId?.trim()) {
      params.set("inlineVersionId", input.payload.versionId.trim());
    } else {
      params.delete("inlineVersionId");
    }
    if (input.payload.assetType?.trim()) {
      params.set("inlineAssetType", input.payload.assetType.trim());
    } else {
      params.delete("inlineAssetType");
    }
    if (input.payload.displayName?.trim()) {
      params.set("inlineDisplayName", input.payload.displayName.trim());
    } else {
      params.delete("inlineDisplayName");
    }
    if (input.payload.sourceStudioType?.trim()) {
      params.set("inlineSourceStudioType", input.payload.sourceStudioType.trim());
    } else {
      params.delete("inlineSourceStudioType");
    }
    if (input.payload.sourceStudioId?.trim()) {
      params.set("inlineSourceStudioId", input.payload.sourceStudioId.trim());
    } else {
      params.delete("inlineSourceStudioId");
    }
    const returnContextId = input.payload.returnContextId?.trim() || input.returnTarget.contextId?.trim();
    if (returnContextId) {
      params.set("returnContextId", returnContextId);
    }
    if (input.payload.handoffId?.trim()) {
      params.set("inlineHandoffId", input.payload.handoffId.trim());
    } else {
      params.delete("inlineHandoffId");
    }
    if (input.returnTarget.parentAssetId?.trim()) {
      params.set("parentAssetId", input.returnTarget.parentAssetId.trim());
    }
    if (input.returnTarget.parentVersionId?.trim()) {
      params.set("parentVersionId", input.returnTarget.parentVersionId.trim());
    }
    if (input.returnTarget.selectedComponent?.trim()) {
      params.set("selectedComponent", input.returnTarget.selectedComponent.trim());
    }

    const query = params.toString();
    const encodedHash = hash ? `#${hash}` : "";
    return query.length > 0 ? `${routePath}?${query}${encodedHash}` : `${routePath}${encodedHash}`;
  }

  public parseInlineReturnFromSearch(search: string): InlineAssetReturnPayload | undefined {
    const params = new URLSearchParams(search);
    if (params.get("inlineReturn")?.trim() !== "1") {
      return undefined;
    }

    const status = parseInlineReturnStatus(params.get("inlineStatus"));
    if (!status) {
      return undefined;
    }

    return Object.freeze({
      status,
      assetId: params.get("inlineAssetId")?.trim() || undefined,
      versionId: params.get("inlineVersionId")?.trim() || undefined,
      assetType: (params.get("inlineAssetType")?.trim() || undefined) as TaxonomySemanticRole | undefined,
      displayName: params.get("inlineDisplayName")?.trim() || undefined,
      sourceStudioType: params.get("inlineSourceStudioType")?.trim() || undefined,
      sourceStudioId: params.get("inlineSourceStudioId")?.trim() || undefined,
      returnContextId: params.get("returnContextId")?.trim() || undefined,
      handoffId: params.get("inlineHandoffId")?.trim() || undefined,
    });
  }

  public parseSelectorLaunchFromSearch(search: string): InlineAssetSelectorLaunchContext | undefined {
    const params = new URLSearchParams(search);
    if (params.get("selectorLaunch")?.trim() !== "1") {
      return undefined;
    }

    const selectorSessionId = params.get("selectorSessionId")?.trim();
    const assetType = params.get("selectorAssetType")?.trim();
    if (!selectorSessionId || !assetType) {
      const handoff = this.parseStudioHandoffFromSearch(search);
      if (!handoff) {
        return undefined;
      }
      return Object.freeze({
        selectorSessionId: handoff.target.selector.selectorSessionId,
        assetType: handoff.target.selector.assetType,
        returnRoutePath: handoff.returnContract.target.routePath,
      });
    }

    return Object.freeze({
      selectorSessionId,
      assetType: assetType as TaxonomySemanticRole,
      returnRoutePath: params.get("selectorReturnTo")?.trim() || undefined,
    });
  }

  public parseStudioHandoffFromSearch(search: string): StudioLaunchHandoffContract | undefined {
    const params = new URLSearchParams(search);
    const encoded = params.get(StudioLaunchHandoffQueryParam)?.trim();
    if (!encoded) {
      return undefined;
    }

    return parseStudioLaunchHandoffContract(encoded);
  }

  public stripInlineReturnFromSearch(search: string): string {
    const params = new URLSearchParams(search);
    params.delete("inlineReturn");
    params.delete("inlineStatus");
    params.delete("inlineAssetId");
    params.delete("inlineVersionId");
    params.delete("inlineAssetType");
    params.delete("inlineDisplayName");
    params.delete("inlineSourceStudioType");
    params.delete("inlineSourceStudioId");
    params.delete("inlineHandoffId");
    const next = params.toString();
    return next ? `?${next}` : "";
  }
}
