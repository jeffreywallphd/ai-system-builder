import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import type { RegistryAsset } from "@domain/asset-registry/RegistryAsset";
import type { PersistedWorkflowSummary } from "@domain/workflow-studio/WorkflowPersistenceDomain";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "@domain/taxonomy/CompositionTaxonomy";
import type {
  CompositionTaxonomyDescriptor,
  TaxonomyBehaviorKind,
  TaxonomySemanticRole,
  TaxonomyStructuralKind,
} from "@domain/taxonomy/CompositionTaxonomy";
import { CrossStudioRegistryQueryService } from "./CrossStudioRegistryQueryService";

export const ExploreAssetKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
  unknown: "unknown",
});

export type ExploreAssetKind = typeof ExploreAssetKinds[keyof typeof ExploreAssetKinds];

export interface ExploreAssetId {
  readonly assetId: string;
  readonly versionId?: string;
}

export interface ExploreAssetSummary {
  readonly id: ExploreAssetId;
  readonly displayName: string;
  readonly assetKind: ExploreAssetKind;
  readonly primaryLabel: string;
  readonly status: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly contract?: Pick<AssetContractDescriptor, "execution" | "parameters">;
  readonly metadata: {
    readonly semanticRole?: TaxonomySemanticRole;
    readonly behaviorKind?: TaxonomyBehaviorKind;
    readonly summary?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly sourceType?: string;
    readonly sourceLabel?: string;
    readonly creatorId?: string;
    readonly dependencyCount: number;
    readonly versionCount: number;
    readonly persistenceRevision?: number;
    readonly workflowRevision?: number;
    readonly lastModifiedAt?: string;
    readonly duplicatedFromWorkflowId?: string;
  };
}

export interface ExploreAsset {
  readonly summary: ExploreAssetSummary;
  readonly registryAsset: RegistryAsset;
}

export interface UnifiedExploreAssetLibrary {
  readonly assets: ReadonlyArray<ExploreAssetSummary>;
  readonly totalCount: number;
  readonly availableKinds: ReadonlyArray<ExploreAssetKind>;
}

export interface ExploreFilterSet {
  readonly kinds?: ReadonlyArray<ExploreAssetKind>;
  readonly semanticRoles?: ReadonlyArray<TaxonomySemanticRole>;
  readonly behaviorKinds?: ReadonlyArray<TaxonomyBehaviorKind>;
  readonly sourceTypes?: ReadonlyArray<string>;
  readonly statuses?: ReadonlyArray<string>;
}

export interface ExploreSearchQuery {
  readonly keyword?: string;
  readonly filters?: ExploreFilterSet;
  readonly limit?: number;
}

export interface ExploreFacetOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface ExploreFacet {
  readonly key: "kind" | "semanticRole" | "behaviorKind" | "sourceType" | "status";
  readonly label: string;
  readonly visibility: "primary" | "secondary";
  readonly options: ReadonlyArray<ExploreFacetOption>;
}

export interface ExploreSearchResult {
  readonly query: ExploreSearchQuery;
  readonly assets: ReadonlyArray<ExploreAssetSummary>;
  readonly totalCount: number;
  readonly facets: ReadonlyArray<ExploreFacet>;
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function dedupeStrings(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined {
  if (!values?.length) {
    return undefined;
  }

  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

function normalizedQuery(input: ExploreSearchQuery): ExploreSearchQuery {
  return Object.freeze({
    keyword: input.keyword?.trim(),
    limit: typeof input.limit === "number" && input.limit > 0 ? input.limit : undefined,
    filters: input.filters
      ? Object.freeze({
        kinds: dedupeStrings(input.filters.kinds) as ReadonlyArray<ExploreAssetKind> | undefined,
        semanticRoles: dedupeStrings(input.filters.semanticRoles) as ReadonlyArray<TaxonomySemanticRole> | undefined,
        behaviorKinds: dedupeStrings(input.filters.behaviorKinds) as ReadonlyArray<TaxonomyBehaviorKind> | undefined,
        sourceTypes: dedupeStrings(input.filters.sourceTypes),
        statuses: dedupeStrings(input.filters.statuses),
      })
      : undefined,
  });
}

function matchesKeyword(asset: ExploreAssetSummary, keyword?: string): boolean {
  const normalized = normalizeText(keyword);
  if (!normalized) {
    return true;
  }

  const searchable = [
    asset.id.assetId,
    asset.id.versionId,
    asset.displayName,
    asset.primaryLabel,
    asset.taxonomy?.structuralKind,
    asset.taxonomy?.semanticRole,
    asset.taxonomy?.behaviorKind,
    asset.metadata.sourceType,
    asset.metadata.sourceLabel,
    asset.metadata.creatorId,
    asset.metadata.summary,
    ...(asset.metadata.tags ?? []),
    asset.status,
    ...(asset.contract?.parameters ?? []).map((entry) => entry.id),
  ].map((entry) => normalizeText(entry));

  return searchable.some((entry) => entry.includes(normalized));
}

function matchesFilters(asset: ExploreAssetSummary, filters?: ExploreFilterSet): boolean {
  if (!filters) {
    return true;
  }

  if (filters.kinds?.length && !filters.kinds.includes(asset.assetKind)) {
    return false;
  }

  if (filters.semanticRoles?.length) {
    const role = asset.taxonomy?.semanticRole;
    if (!role || !filters.semanticRoles.includes(role)) {
      return false;
    }
  }

  if (filters.behaviorKinds?.length) {
    const behavior = asset.taxonomy?.behaviorKind;
    if (!behavior || !filters.behaviorKinds.includes(behavior)) {
      return false;
    }
  }

  if (filters.sourceTypes?.length) {
    const sourceType = asset.metadata.sourceType;
    if (!sourceType || !filters.sourceTypes.includes(sourceType)) {
      return false;
    }
  }

  if (filters.statuses?.length && !filters.statuses.includes(asset.status)) {
    return false;
  }

  return true;
}

function countFacetValues(values: ReadonlyArray<string | undefined>): ReadonlyArray<ExploreFacetOption> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Object.freeze([...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => Object.freeze({ value, label: value, count })));
}

function structuralKindToExploreKind(kind?: TaxonomyStructuralKind): ExploreAssetKind {
  if (kind === "atomic") {
    return ExploreAssetKinds.atomic;
  }
  if (kind === "composite") {
    return ExploreAssetKinds.composite;
  }
  if (kind === "system") {
    return ExploreAssetKinds.system;
  }
  return ExploreAssetKinds.unknown;
}

export class ExploreAssetQueryService {
  constructor(
    private readonly crossStudioRegistryQueryService: Pick<CrossStudioRegistryQueryService, "listAllAssets">,
    private readonly workflowPersistenceService?: {
      listPersistedWorkflows(): Promise<ReadonlyArray<PersistedWorkflowSummary>>;
    },
  ) {}

  public async listLibrary(limit?: number): Promise<UnifiedExploreAssetLibrary> {
    const assets = await this.crossStudioRegistryQueryService.listAllAssets(limit);
    const persistedWorkflows = await this.listPersistedWorkflowsSafely();
    const mapped = this.toExploreAssets(assets, persistedWorkflows);
    const availableKinds = Object.freeze([...new Set(mapped.map((entry) => entry.assetKind))].sort());

    return Object.freeze({
      assets: limit && limit > 0 ? mapped.slice(0, limit) : mapped,
      totalCount: mapped.length,
      availableKinds,
    });
  }

  public async search(query: ExploreSearchQuery = {}): Promise<ExploreSearchResult> {
    const normalized = normalizedQuery(query);
    const library = await this.listLibrary();
    const filtered = library.assets
      .filter((asset) => matchesFilters(asset, normalized.filters))
      .filter((asset) => matchesKeyword(asset, normalized.keyword));

    const sorted = Object.freeze([...filtered].sort((a, b) =>
      a.displayName.localeCompare(b.displayName) || a.id.assetId.localeCompare(b.id.assetId)));
    const limited = normalized.limit && normalized.limit > 0 ? Object.freeze(sorted.slice(0, normalized.limit)) : sorted;

    return Object.freeze({
      query: normalized,
      assets: limited,
      totalCount: sorted.length,
      facets: this.buildFacets(sorted),
    });
  }

  private async listPersistedWorkflowsSafely(): Promise<ReadonlyArray<PersistedWorkflowSummary>> {
    if (!this.workflowPersistenceService) {
      return Object.freeze([]);
    }

    try {
      return await this.workflowPersistenceService.listPersistedWorkflows();
    } catch {
      return Object.freeze([]);
    }
  }

  private toExploreAssets(
    assets: ReadonlyArray<RegistryAsset>,
    persistedWorkflows: ReadonlyArray<PersistedWorkflowSummary>,
  ): ReadonlyArray<ExploreAssetSummary> {
    const registrySummaries = assets.map((asset) => this.toExploreAssetSummary(asset));
    const byAssetId = new Map<string, ExploreAssetSummary>();
    for (const summary of registrySummaries) {
      byAssetId.set(summary.id.assetId, summary);
    }
    for (const persisted of persistedWorkflows) {
      if (byAssetId.has(persisted.id)) {
        continue;
      }
      byAssetId.set(persisted.id, this.toPersistedWorkflowSummary(persisted));
    }
    return Object.freeze([...byAssetId.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName) || a.id.assetId.localeCompare(b.id.assetId)));
  }

  private toExploreAssetSummary(asset: RegistryAsset): ExploreAssetSummary {
    const taxonomy = asset.taxonomy;
    const semanticRole = taxonomy?.semanticRole;

    return Object.freeze({
      id: Object.freeze({
        assetId: asset.assetId,
        versionId: asset.versionId,
      }),
      displayName: asset.name,
      assetKind: structuralKindToExploreKind(taxonomy?.structuralKind),
      primaryLabel: semanticRole ? semanticRole.replaceAll("-", " ") : "Asset",
      status: asset.status,
      taxonomy,
      contract: asset.contract
        ? Object.freeze({
          execution: asset.contract.execution,
          parameters: Object.freeze(asset.contract.parameters.map((entry) => Object.freeze({ ...entry }))),
        })
        : undefined,
      metadata: Object.freeze({
        semanticRole,
        behaviorKind: taxonomy?.behaviorKind,
        summary: undefined,
        tags: undefined,
        sourceType: asset.provenance.sourceType,
        sourceLabel: asset.provenance.sourceLabel,
        creatorId: asset.provenance.creatorId,
        dependencyCount: asset.dependencies.filter((entry) => entry.direction === "upstream").length,
        versionCount: Math.max(asset.versionHistory.length, asset.versionId ? 1 : 0),
      }),
    });
  }

  private toPersistedWorkflowSummary(summary: PersistedWorkflowSummary): ExploreAssetSummary {
    const taxonomy: CompositionTaxonomyDescriptor = Object.freeze({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });

    return Object.freeze({
      id: Object.freeze({
        assetId: summary.id,
        versionId: summary.revision.versionLabel,
      }),
      displayName: summary.name,
      assetKind: ExploreAssetKinds.composite,
      primaryLabel: "workflow",
      status: summary.status,
      taxonomy,
      metadata: Object.freeze({
        semanticRole: taxonomy.semanticRole,
        behaviorKind: taxonomy.behaviorKind,
        summary: summary.metadata.summary,
        tags: summary.metadata.tags,
        sourceType: "workflow-persistence",
        sourceLabel: summary.ownershipContext?.studioId ?? "workflow-studio",
        creatorId: summary.ownershipContext?.ownerId,
        dependencyCount: 0,
        versionCount: Math.max(summary.revision.persistenceRevision, 1),
        persistenceRevision: summary.revision.persistenceRevision,
        workflowRevision: summary.revision.workflowRevision,
        lastModifiedAt: summary.timestamps.updatedAt,
        duplicatedFromWorkflowId: summary.revision.duplicatedFromWorkflowId,
      }),
    });
  }

  private buildFacets(filteredAssets: ReadonlyArray<ExploreAssetSummary>): ReadonlyArray<ExploreFacet> {
    return Object.freeze([
      Object.freeze({
        key: "kind" as const,
        label: "Asset kind",
        visibility: "primary" as const,
        options: countFacetValues(filteredAssets.map((asset) => asset.assetKind)),
      }),
      Object.freeze({
        key: "sourceType" as const,
        label: "Source",
        visibility: "primary" as const,
        options: countFacetValues(filteredAssets.map((asset) => asset.metadata.sourceType)),
      }),
      Object.freeze({
        key: "status" as const,
        label: "Status",
        visibility: "primary" as const,
        options: countFacetValues(filteredAssets.map((asset) => asset.status)),
      }),
      Object.freeze({
        key: "semanticRole" as const,
        label: "Taxonomy role",
        visibility: "secondary" as const,
        options: countFacetValues(filteredAssets.map((asset) => asset.taxonomy?.semanticRole)),
      }),
      Object.freeze({
        key: "behaviorKind" as const,
        label: "Taxonomy behavior",
        visibility: "secondary" as const,
        options: countFacetValues(filteredAssets.map((asset) => asset.taxonomy?.behaviorKind)),
      }),
    ]);
  }
}

