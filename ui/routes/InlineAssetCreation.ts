import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import { StudioEntryModes, type StudioEntryRequest, type StudioEntryResolution } from "../../application/studio-entry/StudioEntryContracts";
import { StudioEntryResolver } from "./StudioRouteMapping";

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
}

export interface InlineAssetCreationResult {
  readonly mode: InlineAssetCreationMode;
  readonly launchPath: string;
  readonly returnTarget?: InlineAssetCreationReturnTarget;
  readonly studioEntry: StudioEntryResolution;
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
  const [routePath, search] = path.split("?");
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

  return `${routePath}?${params.toString()}`;
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
      studioEntry,
    });
  }

  public parseReturnTargetFromSearch(search: string): InlineAssetCreationReturnTarget | undefined {
    const params = new URLSearchParams(search);
    const returnTo = params.get("returnTo")?.trim();
    if (!returnTo) {
      return undefined;
    }

    return Object.freeze({
      routePath: returnTo,
      contextId: params.get("returnContextId")?.trim() || undefined,
      parentAssetId: params.get("parentAssetId")?.trim() || undefined,
      parentVersionId: params.get("parentVersionId")?.trim() || undefined,
      selectedComponent: params.get("selectedComponent")?.trim() || undefined,
    });
  }
}
