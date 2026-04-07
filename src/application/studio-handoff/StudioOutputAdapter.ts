import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "@domain/taxonomy/CompositionTaxonomy";
import { HandoffBoundedCache } from "./HandoffBoundedCache";

export const AdaptedStudioOutputKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
});

export type AdaptedStudioOutputKind = typeof AdaptedStudioOutputKinds[keyof typeof AdaptedStudioOutputKinds];

export interface StudioOutputSourceReference {
  readonly assetId: string;
  readonly versionId: string;
  readonly relation?: string;
  readonly studioId?: string;
  readonly studioType?: string;
}

export interface StudioProducedOutput {
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly authoritativeAsset: {
    readonly assetId: string;
    readonly versionId: string;
    readonly pinnedVersion: {
      readonly assetId: string;
      readonly versionId: string;
    };
    readonly taxonomy: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
  };
  readonly sourceReferences?: ReadonlyArray<StudioOutputSourceReference>;
  readonly handoffHints?: Readonly<Record<string, unknown>>;
  readonly provenance?: {
    readonly correlationId?: string;
    readonly labels?: ReadonlyArray<string>;
    readonly emittedAt?: string;
  };
  readonly studioSpecific?: Readonly<Record<string, unknown>>;
}

export interface AdaptedStudioOutput {
  readonly kind: AdaptedStudioOutputKind;
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly authoritativeAsset: {
    readonly assetId: string;
    readonly versionId: string;
    readonly taxonomy: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
  };
  readonly sourceReferences: ReadonlyArray<StudioOutputSourceReference>;
  readonly handoffMetadata: {
    readonly hints: Readonly<Record<string, unknown>>;
    readonly provenance?: {
      readonly correlationId?: string;
      readonly labels: ReadonlyArray<string>;
      readonly emittedAt?: string;
    };
  };
  readonly studioSpecific: Readonly<Record<string, unknown>>;
}

export interface StudioOutputAdapter<TAdapted extends AdaptedStudioOutput = AdaptedStudioOutput> {
  readonly id: string;
  readonly kind: AdaptedStudioOutputKind;
  canAdapt(sourceStudioType: string): boolean;
  adapt(input: StudioProducedOutput): TAdapted;
}

export interface StudioOutputAdaptationIssue {
  readonly code: "source-output-invalid" | "adapter-not-found";
  readonly message: string;
  readonly path?: string;
}

export interface StudioOutputAdaptationResult {
  readonly ok: boolean;
  readonly adapted?: AdaptedStudioOutput;
  readonly issues: ReadonlyArray<StudioOutputAdaptationIssue>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function freezeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(record ?? {}) });
}

function normalizeSourceReference(reference: StudioOutputSourceReference): StudioOutputSourceReference {
  return Object.freeze({
    assetId: normalizeRequired(reference.assetId, "Studio output source reference asset id"),
    versionId: normalizeRequired(reference.versionId, "Studio output source reference version id"),
    relation: reference.relation?.trim() || undefined,
    studioId: reference.studioId?.trim() || undefined,
    studioType: reference.studioType?.trim() || undefined,
  });
}

function createBaseAdaptedOutput(kind: AdaptedStudioOutputKind, input: StudioProducedOutput): Omit<AdaptedStudioOutput, "studioSpecific"> {
  return Object.freeze({
    kind,
    sourceStudioType: normalizeRequired(input.sourceStudioType, "Studio output source studio type"),
    sourceStudioId: normalizeRequired(input.sourceStudioId, "Studio output source studio id"),
    authoritativeAsset: Object.freeze({
      assetId: normalizeRequired(input.authoritativeAsset.assetId, "Studio output authoritative asset id"),
      versionId: normalizeRequired(input.authoritativeAsset.versionId, "Studio output authoritative asset version id"),
      pinnedVersion: Object.freeze({
        assetId: normalizeRequired(input.authoritativeAsset.assetId, "Studio output authoritative asset id"),
        versionId: normalizeRequired(input.authoritativeAsset.versionId, "Studio output authoritative asset version id"),
      }),
      taxonomy: input.authoritativeAsset.taxonomy,
      contract: input.authoritativeAsset.contract,
    }),
    sourceReferences: Object.freeze((input.sourceReferences ?? [
      {
        assetId: input.authoritativeAsset.assetId,
        versionId: input.authoritativeAsset.versionId,
        relation: "source-output",
        studioId: input.sourceStudioId,
        studioType: input.sourceStudioType,
      },
    ]).map((entry) => normalizeSourceReference(entry))),
    handoffMetadata: Object.freeze({
      hints: freezeRecord(input.handoffHints),
      provenance: input.provenance
        ? Object.freeze({
          correlationId: input.provenance.correlationId?.trim() || undefined,
          labels: Object.freeze([...(input.provenance.labels ?? []).map((entry) => entry.trim()).filter(Boolean)]),
          emittedAt: input.provenance.emittedAt?.trim() || undefined,
        })
        : undefined,
    }),
  });
}

abstract class BaseStudioOutputAdapter implements StudioOutputAdapter {
  public abstract readonly id: string;
  public abstract readonly kind: AdaptedStudioOutputKind;

  protected constructor(private readonly supportedStudioTypes: ReadonlyArray<string>) {}

  public canAdapt(sourceStudioType: string): boolean {
    return this.supportedStudioTypes.includes(sourceStudioType);
  }

  public abstract adapt(input: StudioProducedOutput): AdaptedStudioOutput;
}

export class AtomicStudioOutputAdapter extends BaseStudioOutputAdapter {
  public readonly id = "studio-output-adapter:atomic";
  public readonly kind = AdaptedStudioOutputKinds.atomic;

  public constructor(supportedStudioTypes: ReadonlyArray<string>) {
    super(supportedStudioTypes);
  }

  public adapt(input: StudioProducedOutput): AdaptedStudioOutput {
    const base = createBaseAdaptedOutput(this.kind, input);
    return Object.freeze({
      ...base,
      studioSpecific: Object.freeze({
        emitsAtomicAsset: true,
        ...freezeRecord(input.studioSpecific),
      }),
    });
  }
}

export class CompositeStudioOutputAdapter extends BaseStudioOutputAdapter {
  public readonly id = "studio-output-adapter:composite";
  public readonly kind = AdaptedStudioOutputKinds.composite;

  public constructor(supportedStudioTypes: ReadonlyArray<string>) {
    super(supportedStudioTypes);
  }

  public adapt(input: StudioProducedOutput): AdaptedStudioOutput {
    const base = createBaseAdaptedOutput(this.kind, input);
    return Object.freeze({
      ...base,
      studioSpecific: Object.freeze({
        emitsCompositeAsset: true,
        dependencyCandidates: Object.freeze(base.sourceReferences.map((entry) => Object.freeze({
          assetId: entry.assetId,
          versionId: entry.versionId,
          relation: entry.relation ?? "dependency",
        }))),
        ...freezeRecord(input.studioSpecific),
      }),
    });
  }
}

export class SystemStudioOutputAdapter extends BaseStudioOutputAdapter {
  public readonly id = "studio-output-adapter:system";
  public readonly kind = AdaptedStudioOutputKinds.system;

  public constructor(supportedStudioTypes: ReadonlyArray<string>) {
    super(supportedStudioTypes);
  }

  public adapt(input: StudioProducedOutput): AdaptedStudioOutput {
    const base = createBaseAdaptedOutput(this.kind, input);
    return Object.freeze({
      ...base,
      studioSpecific: Object.freeze({
        emitsSystemAsset: true,
        supportsSystemOfSystems: true,
        nestedSystemReferences: Object.freeze(base.sourceReferences
          .filter((entry) => entry.relation?.includes("system") ?? false)
          .map((entry) => Object.freeze({
            assetId: entry.assetId,
            versionId: entry.versionId,
          }))),
        ...freezeRecord(input.studioSpecific),
      }),
    });
  }
}

export class StudioOutputAdapterRegistry {
  private readonly adapters = new Map<string, StudioOutputAdapter>();

  public register(adapter: StudioOutputAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Studio output adapter '${adapter.id}' is already registered.`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  public findForSourceStudio(studioType: string): StudioOutputAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canAdapt(studioType)) {
        return adapter;
      }
    }
    return undefined;
  }
}

export class StudioOutputAdapterLayer {
  private readonly adaptationCache = new HandoffBoundedCache<string, StudioOutputAdaptationResult>({ maxEntries: 256 });

  public constructor(private readonly adapterRegistry: StudioOutputAdapterRegistry) {}

  public adapt(input: StudioProducedOutput): StudioOutputAdaptationResult {
    const cacheKey = this.createAdaptationCacheKey(input);
    const cached = this.adaptationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      normalizeRequired(input.sourceStudioType, "Studio output source studio type");
      normalizeRequired(input.sourceStudioId, "Studio output source studio id");
      normalizeRequired(input.authoritativeAsset.assetId, "Studio output authoritative asset id");
      normalizeRequired(input.authoritativeAsset.versionId, "Studio output authoritative asset version id");
    } catch (error) {
      return this.adaptationCache.set(cacheKey, Object.freeze({
        ok: false,
        issues: Object.freeze([{
          code: "source-output-invalid",
          message: error instanceof Error ? error.message : "Studio output is invalid.",
          path: "sourceOutput",
        }]),
      }));
    }

    const adapter = this.adapterRegistry.findForSourceStudio(input.sourceStudioType);
    if (!adapter) {
      return this.adaptationCache.set(cacheKey, Object.freeze({
        ok: false,
        issues: Object.freeze([{
          code: "adapter-not-found",
          message: `No studio output adapter is registered for source studio type '${input.sourceStudioType}'.`,
          path: "sourceStudioType",
        }]),
      }));
    }

    const adapted = adapter.adapt(input);
    return this.adaptationCache.set(cacheKey, Object.freeze({
      ok: true,
      adapted,
      issues: Object.freeze([]),
    }));
  }

  private createAdaptationCacheKey(input: StudioProducedOutput): string {
    const sourceRefs = (input.sourceReferences ?? [])
      .map((entry) => `${entry.assetId}:${entry.versionId}:${entry.relation ?? "none"}`)
      .join("|");
    return [
      (input.sourceStudioType ?? "").trim(),
      (input.sourceStudioId ?? "").trim(),
      (input.authoritativeAsset.assetId ?? "").trim(),
      (input.authoritativeAsset.versionId ?? "").trim(),
      sourceRefs,
      Object.keys(input.handoffHints ?? {}).sort().join(","),
    ].join("::");
  }
}

