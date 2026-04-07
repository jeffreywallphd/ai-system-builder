import type { StudioHandoffContract } from "@domain/studio-handoff/StudioHandoffContract";
import type { CompositionTaxonomyDescriptor, TaxonomySemanticRole } from "@domain/taxonomy/CompositionTaxonomy";

export const StudioEntryModes = Object.freeze({
  blank: "blank",
  new: "new",
  asset: "asset",
  handoff: "handoff",
  intent: "intent",
});

export type StudioEntryMode = typeof StudioEntryModes[keyof typeof StudioEntryModes];

export const StudioInitializationSources = Object.freeze({
  blank: "blank",
  asset: "asset",
  handoff: "handoff",
  intent: "intent",
  route: "route",
});

export type StudioInitializationSource =
  typeof StudioInitializationSources[keyof typeof StudioInitializationSources];

export interface StudioEntryAssetContext {
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
}

export interface StudioInitializationPrefill {
  readonly values: Readonly<Record<string, unknown>>;
}

export interface StudioInitializationContext {
  readonly source: StudioInitializationSource;
  readonly authoritativeAsset?: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
  };
  readonly handoff?: {
    readonly handoff: StudioHandoffContract;
  };
  readonly intent?: {
    readonly key: string;
    readonly label?: string;
    readonly metadata?: Readonly<Record<string, string>>;
  };
  readonly prefill?: StudioInitializationPrefill;
}

export interface ContextualStudioInitialization {
  readonly mode: StudioEntryMode;
  readonly context: StudioInitializationContext;
}

export interface StudioEntryContext {
  readonly source: "navigation" | "registry" | "system-studio" | "intent" | "unknown";
  readonly registryContext?: string;
  readonly selectedComponent?: string;
  readonly parentAssetId?: string;
  readonly parentVersionId?: string;
}

export interface StudioEntryRequest {
  readonly requestedStudioType?: string;
  readonly requestedRole?: TaxonomySemanticRole;
  readonly mode?: StudioEntryMode;
  readonly entryContext?: StudioEntryContext;
  readonly asset?: StudioEntryAssetContext;
  readonly handoff?: StudioHandoffContract;
  readonly intent?: StudioInitializationContext["intent"];
  readonly prefill?: StudioInitializationPrefill;
}

export interface StudioEntryPoint {
  readonly studioType: string;
  readonly routePath: string;
}

export interface StudioInitializationPayload {
  readonly studioType: string;
  readonly initialization: ContextualStudioInitialization;
}

export interface StudioEntryResolution {
  readonly entryPoint: StudioEntryPoint;
  readonly mode: StudioEntryMode;
  readonly initializationPayload: StudioInitializationPayload;
}

