import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import type { AssetLineageEdge } from "../../domain/assets/AssetLineageEdge";
import {
  createRegistryAsset,
  type RegistryAsset,
  type RegistryAssetValidationInsights,
  type RegistryAssetValidationIssue,
  type RegistryDependencyReference,
} from "../../domain/asset-registry/RegistryAsset";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import { evaluateStudioDraftConsistency } from "../studio-shell/AtomicStudioAssetEnforcement";
import { buildStudioShellValidationIssues } from "../studio-shell/StudioShellValidation";
import { AssetDraftLifecycleStatuses, type AssetDraft } from "../../domain/studio-shell/StudioShellDomain";
import { TaxonomySemanticRoles, TaxonomyStructuralKinds, type TaxonomyBehaviorKind, type TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";

export interface RegistryFilterParams {
  readonly structuralKinds?: ReadonlyArray<CompositionTaxonomyDescriptor["structuralKind"]>;
  readonly semanticRoles?: ReadonlyArray<CompositionTaxonomyDescriptor["semanticRole"]>;
  readonly behaviorKinds?: ReadonlyArray<CompositionTaxonomyDescriptor["behaviorKind"]>;
  readonly contractParameterIds?: ReadonlyArray<string>;
  readonly contractInvocationModes?: ReadonlyArray<NonNullable<AssetContractDescriptor["execution"]>["invocationMode"]>;
  readonly contractSideEffects?: ReadonlyArray<NonNullable<AssetContractDescriptor["execution"]>["sideEffects"]>;
  readonly provenanceSourceTypes?: ReadonlyArray<string>;
  readonly provenanceCreatorIds?: ReadonlyArray<string>;
  readonly dependsOnAssetIds?: ReadonlyArray<string>;
  readonly dependsOnVersionIds?: ReadonlyArray<string>;
  readonly keyword?: string;
  readonly limit?: number;
}

function normalizeSet(values?: ReadonlyArray<string>): ReadonlySet<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return new Set(values.map((entry) => entry.trim()).filter(Boolean));
}

export class RegistryQueryService {
  private readonly taxonomyClassifier: CompositionTaxonomyClassifier;

  constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly contractResolver: Pick<IAssetContractResolver, "resolveCanonicalEntityContract" | "resolveContractForTaxonomy">,
    private readonly queryRepository?: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities">,
    taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
  ) {
    this.taxonomyClassifier = taxonomyClassifier;
  }

  public async queryRegistry(params: RegistryFilterParams = {}): Promise<ReadonlyArray<RegistryAsset>> {
    const assets = await (this.queryRepository
      ? this.queryRepository.listAssetsByCriteria({
        structuralKinds: params.structuralKinds,
        semanticRoles: params.semanticRoles,
        behaviorKinds: params.behaviorKinds,
      })
      : this.assetRepository.list());

    const identityRecords = this.queryRepository
      ? await this.queryRepository.listCanonicalIdentities()
      : [];
    const identitiesByAssetId = new Map<string, ReadonlyArray<typeof identityRecords[number]>>();
    for (const identity of identityRecords) {
      const entries = identitiesByAssetId.get(identity.assetId) ?? [];
      identitiesByAssetId.set(identity.assetId, Object.freeze([...entries, identity]));
    }

    const projected = await Promise.all(assets.map(async (asset) => {
      const identities = identitiesByAssetId.get(asset.id) ?? Object.freeze([]);
      const latestIdentity = identities[0];
      const latestVersion = this.queryRepository
        ? await this.queryRepository.getLatestVersionForAsset(asset.id)
        : (await this.versionRepository.listVersionsByAssetId(asset.id))[0];

      const taxonomy = latestIdentity?.taxonomy ?? this.taxonomyClassifier.classifyAsset(asset);
      const contract = await this.resolveContractProjection(taxonomy, latestIdentity);
      const dependencies = await this.buildDependencyReferences(latestVersion?.versionId);
      const provenance = this.readProvenance(latestVersion?.metadata, asset, dependencies);
      const validation = await this.buildValidationInsights({
        assetId: asset.id,
        versionId: latestVersion?.versionId,
        taxonomy,
        contract,
        dependencies,
        provenance,
      });

      return createRegistryAsset({
        assetId: asset.id,
        versionId: latestVersion?.versionId,
        name: asset.name,
        kind: asset.kind,
        status: asset.status,
        taxonomy,
        contract,
        provenance,
        dependencies,
        versionHistory: await this.buildVersionHistory(asset.id),
        lineage: await this.buildLineageContext(latestVersion?.versionId, assets),
        validation,
      });
    }));

    const filtered = projected.filter((entry) => this.matchesFilters(entry, params) && this.matchesSearch(entry, params.keyword));
    if (params.limit && params.limit > 0) {
      return Object.freeze(filtered.slice(0, params.limit));
    }

    return Object.freeze(filtered);
  }

  public async getAssetDetailByAssetId(assetId: string): Promise<RegistryAsset | undefined> {
    const normalized = assetId.trim();
    if (!normalized) {
      return undefined;
    }

    const assets = await this.queryRegistry();
    return assets.find((asset) => asset.assetId === normalized);
  }

  public async getAssetDetailByVersionId(versionId: string): Promise<RegistryAsset | undefined> {
    const normalized = versionId.trim();
    if (!normalized) {
      return undefined;
    }

    const assets = await this.queryRegistry();
    return assets.find((asset) => asset.versionId === normalized || asset.versionHistory.some((entry) => entry.versionId === normalized));
  }

  private async buildValidationInsights(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
    readonly dependencies: ReadonlyArray<RegistryDependencyReference>;
    readonly provenance: RegistryAsset["provenance"];
  }): Promise<RegistryAssetValidationInsights> {
    const syntheticDraft = this.createSyntheticDraft(input);
    const studioShellIssues = await buildStudioShellValidationIssues({
      draft: syntheticDraft,
      knownVersionIds: input.versionId ? [input.versionId] : [],
      versionExists: async (versionId) => Boolean(await this.versionRepository.getByVersionId(versionId)),
      resolveDependencyVersion: async (versionId) => {
        const version = await this.versionRepository.getByVersionId(versionId);
        if (!version) {
          return undefined;
        }
        const sourceAsset = await this.assetRepository.getById(version.assetId.value);
        return {
          assetId: version.assetId.value,
          taxonomy: sourceAsset ? this.taxonomyClassifier.classifyAsset(sourceAsset) : undefined,
        };
      },
    });

    const expectation = input.taxonomy ? studioExpectationBySemanticRole[input.taxonomy.semanticRole] : undefined;
    const enforcementIssues = expectation
      ? evaluateStudioDraftConsistency({
        draft: syntheticDraft,
        expectation: {
          studioType: expectation.studioType,
          structuralKind: expectation.structuralKind,
          semanticRole: expectation.semanticRole,
          allowedBehaviorKinds: expectation.allowedBehaviorKinds,
        },
        contractResolver: this.contractResolver,
      })
      : [];

    const issues: RegistryAssetValidationIssue[] = [
      ...studioShellIssues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        section: issue.section,
        message: issue.message,
        path: issue.path,
      })),
      ...enforcementIssues.map((issue) => ({
        code: issue.code,
        severity: "error" as const,
        section: issue.code === "taxonomy-behavior-kind-mismatch" ? "behavior" as const : "contract" as const,
        message: issue.message,
      })),
    ];

    const deduped = new Map<string, RegistryAssetValidationIssue>();
    for (const issue of issues) {
      const key = `${issue.code}:${issue.severity}:${issue.section}:${issue.path ?? ""}:${issue.message}`;
      deduped.set(key, Object.freeze(issue));
    }

    const projected = Object.freeze([...deduped.values()]);
    const warningCount = projected.filter((issue) => issue.severity === "warning").length;
    const errorCount = projected.length - warningCount;
    const incompatibleDependencyCount = projected.filter((issue) => (
      issue.code === "composite-dependency-semantic-role-disallowed"
      || issue.code === "dependency-asset-version-mismatch"
      || issue.code === "dependency-version-not-found"
    )).length;
    const behaviorMismatchCount = projected.filter((issue) => issue.code === "taxonomy-behavior-kind-mismatch").length;

    return Object.freeze({
      status: errorCount > 0 ? "invalid" : warningCount > 0 ? "warning" : "valid",
      issueCount: projected.length,
      warningCount,
      errorCount,
      incompatibleDependencyCount,
      behaviorMismatchCount,
      issues: projected,
    });
  }

  private createSyntheticDraft(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
    readonly dependencies: ReadonlyArray<RegistryDependencyReference>;
    readonly provenance: RegistryAsset["provenance"];
  }): AssetDraft {
    const versionScopedDependencies = input.dependencies
      .filter((entry) => entry.direction === "upstream")
      .map((entry) => ({
        assetId: entry.assetId,
        versionId: entry.versionId,
      }));

    return Object.freeze({
      id: `${input.assetId}::registry`,
      assetId: input.assetId,
      studioId: "registry-projection",
      sessionId: "registry-read-session",
      content: "",
      metadata: {
        title: input.assetId,
        tags: [],
        taxonomy: input.taxonomy,
        contract: input.contract,
        provenance: {
          creatorId: input.provenance.creatorId,
          sourceType: input.provenance.sourceType,
          sourceLabel: input.provenance.sourceLabel,
          derivationContext: input.provenance.derivationContext,
          upstreamAssets: input.provenance.upstreamAssets,
        },
      },
      dependencies: versionScopedDependencies,
      lifecycleStatus: AssetDraftLifecycleStatuses.published,
      revision: 1,
      publishedVersionIds: input.versionId ? [input.versionId] : [],
      lastPublishedVersionId: input.versionId,
      createdAt: (input.provenance.createdAt ?? new Date()).toISOString(),
      updatedAt: (input.provenance.updatedAt ?? new Date()).toISOString(),
    });
  }

  private async resolveContractProjection(
    taxonomy: CompositionTaxonomyDescriptor | undefined,
    identity?: {
      readonly entityType: "workflow-definition" | "installed-model" | "dataset-version" | "base-model" | "execution-artifact";
      readonly entityId: string;
    },
  ): Promise<AssetContractDescriptor | undefined> {
    if (identity) {
      const resolved = await this.contractResolver.resolveCanonicalEntityContract(identity.entityType, identity.entityId);
      if (resolved) {
        return resolved;
      }
    }

    return taxonomy ? this.contractResolver.resolveContractForTaxonomy(taxonomy) : undefined;
  }

  private async buildDependencyReferences(versionId?: string): Promise<ReadonlyArray<RegistryDependencyReference>> {
    if (!versionId) {
      return Object.freeze([]);
    }

    const version = await this.versionRepository.getByVersionId(versionId);
    if (!version) {
      return Object.freeze([]);
    }

    const edges = await this.lineageRepository.listEdgesByVersionId(versionId, "both");
    const resolved = new Map<string, RegistryDependencyReference>();

    for (const upstreamVersionId of version.upstreamVersionIds) {
      const upstreamVersion = await this.versionRepository.getByVersionId(upstreamVersionId);
      if (!upstreamVersion) {
        continue;
      }
      const dependency: RegistryDependencyReference = {
        direction: "upstream",
        assetId: upstreamVersion.assetId.value,
        versionId: upstreamVersion.versionId,
        source: "version-upstream",
      };
      resolved.set(`${dependency.direction}:${dependency.versionId}:${dependency.source}`, Object.freeze(dependency));
    }

    for (const edge of edges) {
      const edgeDependency = await this.toDependency(edge, versionId);
      resolved.set(`${edgeDependency.direction}:${edgeDependency.versionId}:${edgeDependency.source}:${edgeDependency.relationshipType ?? ""}`, edgeDependency);
    }

    const metadataDependencies = this.readDraftDependencyMetadata(version.metadata);
    for (const dependency of metadataDependencies) {
      resolved.set(`${dependency.direction}:${dependency.versionId}:${dependency.source}`, dependency);
    }

    return Object.freeze([...resolved.values()]);
  }

  private async toDependency(edge: AssetLineageEdge, versionId: string): Promise<RegistryDependencyReference> {
    const isUpstream = edge.toVersionId === versionId;
    const dependencyVersionId = isUpstream ? edge.fromVersionId : edge.toVersionId;
    const dependencyVersion = await this.versionRepository.getByVersionId(dependencyVersionId);

    return Object.freeze({
      direction: isUpstream ? "upstream" : "downstream",
      assetId: dependencyVersion?.assetId.value ?? dependencyVersionId,
      versionId: dependencyVersionId,
      relationshipType: edge.type,
      source: "lineage-edge",
    });
  }

  private readDraftDependencyMetadata(metadata: Readonly<Record<string, unknown>> | undefined): ReadonlyArray<RegistryDependencyReference> {
    if (!metadata || typeof metadata !== "object") {
      return Object.freeze([]);
    }

    const dependencies = (metadata as { readonly dependencies?: unknown }).dependencies;
    if (!Array.isArray(dependencies)) {
      return Object.freeze([]);
    }

    const projected: RegistryDependencyReference[] = [];
    for (const entry of dependencies) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const dependency = entry as { readonly assetId?: string; readonly versionId?: string };
      const assetId = dependency.assetId?.trim();
      const versionId = dependency.versionId?.trim();
      if (!assetId || !versionId) {
        continue;
      }

      projected.push(Object.freeze({
        direction: "upstream",
        assetId,
        versionId,
        source: "draft-dependency",
      }));
    }

    return Object.freeze(projected);
  }

  private readProvenance(
    versionMetadata: Readonly<Record<string, unknown>> | undefined,
    asset: { readonly source: { readonly type: string; readonly provider?: string }; readonly audit?: { readonly createdAt?: Date; readonly updatedAt?: Date } },
    dependencies: ReadonlyArray<RegistryDependencyReference>,
  ) {
    const nestedMetadata = (versionMetadata as { readonly metadata?: unknown } | undefined)?.metadata;
    const provenance = nestedMetadata && typeof nestedMetadata === "object"
      ? (nestedMetadata as { readonly provenance?: unknown }).provenance
      : undefined;

    const provenanceObject = provenance && typeof provenance === "object"
      ? provenance as {
        readonly creatorId?: string;
        readonly sourceType?: string;
        readonly sourceLabel?: string;
        readonly derivationContext?: string;
        readonly upstreamAssets?: ReadonlyArray<{ readonly assetId?: string; readonly versionId?: string; readonly relationship?: string }>;
      }
      : undefined;

    return Object.freeze({
      creatorId: provenanceObject?.creatorId?.trim() || undefined,
      sourceType: (provenanceObject?.sourceType ?? asset.source.type) as RegistryAsset["provenance"]["sourceType"],
      sourceLabel: provenanceObject?.sourceLabel?.trim() || asset.source.provider,
      derivationContext: provenanceObject?.derivationContext?.trim() || undefined,
      upstreamAssets: Object.freeze((provenanceObject?.upstreamAssets ?? [])
        .map((entry) => ({
          assetId: entry.assetId?.trim() ?? "",
          versionId: entry.versionId?.trim() || undefined,
          relationship: entry.relationship as RegistryAsset["provenance"]["upstreamAssets"][number]["relationship"],
        }))
        .filter((entry) => !!entry.assetId)),
      directUpstreamVersionIds: Object.freeze(
        [...new Set(dependencies.filter((entry) => entry.direction === "upstream").map((entry) => entry.versionId))],
      ),
      directDownstreamVersionIds: Object.freeze(
        [...new Set(dependencies.filter((entry) => entry.direction === "downstream").map((entry) => entry.versionId))],
      ),
      createdAt: asset.audit?.createdAt,
      updatedAt: asset.audit?.updatedAt,
    });
  }

  private async buildVersionHistory(assetId: string): Promise<RegistryAsset["versionHistory"]> {
    const versions = await this.versionRepository.listVersionsByAssetId(assetId);
    const ordered = [...versions].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const history: RegistryAsset["versionHistory"] = ordered.map((version, index) => {
      const previous = ordered[index - 1];
      const previousUpstream = new Set(previous?.upstreamVersionIds ?? []);
      const currentUpstream = new Set(version.upstreamVersionIds);
      return Object.freeze({
        versionId: version.versionId,
        versionLabel: version.versionLabel,
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        upstreamVersionIds: Object.freeze([...currentUpstream]),
        upstreamAdded: Object.freeze([...currentUpstream].filter((id) => !previousUpstream.has(id))),
        upstreamRemoved: Object.freeze([...previousUpstream].filter((id) => !currentUpstream.has(id))),
      });
    });
    return Object.freeze(history);
  }

  private async buildLineageContext(
    rootVersionId: string | undefined,
    assets: ReadonlyArray<{ readonly id: string; readonly name: string }>,
    maxDepth = 3,
  ): Promise<RegistryAsset["lineage"]> {
    if (!rootVersionId) {
      return Object.freeze({ rootVersionId: undefined, upstream: Object.freeze([]), downstream: Object.freeze([]) });
    }

    const assetNameById = new Map(assets.map((asset) => [asset.id, asset.name]));
    const upstream = await this.collectLineage(rootVersionId, "upstream", assetNameById, maxDepth);
    const downstream = await this.collectLineage(rootVersionId, "downstream", assetNameById, maxDepth);
    return Object.freeze({
      rootVersionId,
      upstream,
      downstream,
    });
  }

  private async collectLineage(
    rootVersionId: string,
    direction: "upstream" | "downstream",
    assetNameById: ReadonlyMap<string, string>,
    maxDepth: number,
  ): Promise<ReadonlyArray<RegistryAsset["lineage"]["upstream"][number]>> {
    const queue: Array<{ versionId: string; depth: number }> = [{ versionId: rootVersionId, depth: 0 }];
    const visited = new Set<string>([rootVersionId]);
    const discovered: Array<RegistryAsset["lineage"]["upstream"][number]> = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.depth >= maxDepth) {
        continue;
      }

      const edges = await this.lineageRepository.listEdgesByVersionId(current.versionId, direction);
      for (const edge of edges) {
        const adjacentVersionId = direction === "upstream" ? edge.fromVersionId : edge.toVersionId;
        if (visited.has(adjacentVersionId)) {
          continue;
        }

        visited.add(adjacentVersionId);
        queue.push({ versionId: adjacentVersionId, depth: current.depth + 1 });
        const version = await this.versionRepository.getByVersionId(adjacentVersionId);
        discovered.push(Object.freeze({
          assetId: version?.assetId.value ?? adjacentVersionId,
          versionId: adjacentVersionId,
          name: version ? assetNameById.get(version.assetId.value) : undefined,
          depth: current.depth + 1,
        }));
      }
    }

    return Object.freeze(discovered);
  }

  private matchesFilters(asset: RegistryAsset, params: RegistryFilterParams): boolean {
    if (params.structuralKinds?.length && (!asset.taxonomy || !params.structuralKinds.includes(asset.taxonomy.structuralKind))) {
      return false;
    }
    if (params.semanticRoles?.length && (!asset.taxonomy || !params.semanticRoles.includes(asset.taxonomy.semanticRole))) {
      return false;
    }
    if (params.behaviorKinds?.length && (!asset.taxonomy || !params.behaviorKinds.includes(asset.taxonomy.behaviorKind))) {
      return false;
    }

    const parameterIdSet = normalizeSet(params.contractParameterIds);
    if (parameterIdSet) {
      const ids = new Set((asset.contract?.parameters ?? []).map((parameter) => parameter.id));
      for (const parameterId of parameterIdSet) {
        if (!ids.has(parameterId)) {
          return false;
        }
      }
    }

    if (params.contractInvocationModes?.length) {
      const mode = asset.contract?.execution?.invocationMode;
      if (!mode || !params.contractInvocationModes.includes(mode)) {
        return false;
      }
    }

    if (params.contractSideEffects?.length) {
      const sideEffects = asset.contract?.execution?.sideEffects;
      if (!sideEffects || !params.contractSideEffects.includes(sideEffects)) {
        return false;
      }
    }

    const sourceTypeFilter = normalizeSet(params.provenanceSourceTypes);
    if (sourceTypeFilter && (!asset.provenance.sourceType || !sourceTypeFilter.has(asset.provenance.sourceType))) {
      return false;
    }

    const creatorFilter = normalizeSet(params.provenanceCreatorIds);
    if (creatorFilter && (!asset.provenance.creatorId || !creatorFilter.has(asset.provenance.creatorId))) {
      return false;
    }

    const dependsOnAssetFilter = normalizeSet(params.dependsOnAssetIds);
    if (dependsOnAssetFilter) {
      const seen = new Set(asset.dependencies.map((dependency) => dependency.assetId));
      for (const dependencyAssetId of dependsOnAssetFilter) {
        if (!seen.has(dependencyAssetId)) {
          return false;
        }
      }
    }

    const dependsOnVersionFilter = normalizeSet(params.dependsOnVersionIds);
    if (dependsOnVersionFilter) {
      const seen = new Set(asset.dependencies.map((dependency) => dependency.versionId));
      for (const dependencyVersionId of dependsOnVersionFilter) {
        if (!seen.has(dependencyVersionId)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesSearch(asset: RegistryAsset, keyword?: string): boolean {
    const normalized = keyword?.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    const haystack = [
      asset.name,
      asset.assetId,
      asset.kind,
      asset.status,
      asset.taxonomy?.semanticRole,
      asset.taxonomy?.structuralKind,
      asset.taxonomy?.behaviorKind,
      asset.provenance.creatorId,
      asset.provenance.sourceType,
      asset.provenance.sourceLabel,
      asset.provenance.derivationContext,
      ...asset.provenance.upstreamAssets.flatMap((entry) => [entry.assetId, entry.versionId, entry.relationship]),
      ...asset.contract?.parameters.map((parameter) => parameter.id) ?? [],
      asset.contract?.execution?.invocationMode,
      asset.contract?.execution?.sideEffects,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.toLowerCase());

    return haystack.some((value) => value.includes(normalized));
  }
}

const studioExpectationBySemanticRole: Readonly<
  Partial<Record<TaxonomySemanticRole, {
    readonly studioType: string;
    readonly structuralKind: CompositionTaxonomyDescriptor["structuralKind"];
    readonly semanticRole: TaxonomySemanticRole;
    readonly allowedBehaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
  }>>
> = Object.freeze({
  [TaxonomySemanticRoles.model]: Object.freeze({
    studioType: "model-studio",
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.model,
    allowedBehaviorKinds: Object.freeze(["none"]),
  }),
  [TaxonomySemanticRoles.dataset]: Object.freeze({
    studioType: "dataset-studio",
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.dataset,
    allowedBehaviorKinds: Object.freeze(["none"]),
  }),
  [TaxonomySemanticRoles.tool]: Object.freeze({
    studioType: "tool-studio",
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.tool,
    allowedBehaviorKinds: Object.freeze(["conditional", "deterministic"]),
  }),
  [TaxonomySemanticRoles.promptTemplate]: Object.freeze({
    studioType: "prompt-template-studio",
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.promptTemplate,
    allowedBehaviorKinds: Object.freeze(["none"]),
  }),
  [TaxonomySemanticRoles.embeddingIndex]: Object.freeze({
    studioType: "embedding-index-studio",
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.embeddingIndex,
    allowedBehaviorKinds: Object.freeze(["none"]),
  }),
  [TaxonomySemanticRoles.configProfile]: Object.freeze({
    studioType: "config-profile-studio",
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.configProfile,
    allowedBehaviorKinds: Object.freeze(["none"]),
  }),
  [TaxonomySemanticRoles.workflow]: Object.freeze({
    studioType: "workflow-studio",
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.workflow,
    allowedBehaviorKinds: Object.freeze(["deterministic", "conditional", "iterative"]),
  }),
  [TaxonomySemanticRoles.contextBundle]: Object.freeze({
    studioType: "context-bundle-studio",
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.contextBundle,
    allowedBehaviorKinds: Object.freeze(["none", "deterministic"]),
  }),
  [TaxonomySemanticRoles.datasetPipeline]: Object.freeze({
    studioType: "dataset-pipeline-studio",
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.datasetPipeline,
    allowedBehaviorKinds: Object.freeze(["deterministic", "iterative"]),
  }),
  [TaxonomySemanticRoles.trainingRecipe]: Object.freeze({
    studioType: "training-recipe-studio",
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.trainingRecipe,
    allowedBehaviorKinds: Object.freeze(["deterministic"]),
  }),
  [TaxonomySemanticRoles.toolChain]: Object.freeze({
    studioType: "tool-chain-studio",
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.toolChain,
    allowedBehaviorKinds: Object.freeze(["deterministic"]),
  }),
});
