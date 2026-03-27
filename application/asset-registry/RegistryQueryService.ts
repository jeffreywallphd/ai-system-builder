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
  type RegistryDependencyReference,
} from "../../domain/asset-registry/RegistryAsset";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";

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
      });
    }));

    const filtered = projected.filter((entry) => this.matchesFilters(entry, params));
    if (params.limit && params.limit > 0) {
      return Object.freeze(filtered.slice(0, params.limit));
    }

    return Object.freeze(filtered);
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
}
