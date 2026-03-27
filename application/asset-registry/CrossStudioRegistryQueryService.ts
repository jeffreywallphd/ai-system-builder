import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import type {
  CompositionTaxonomyDescriptor,
  TaxonomyBehaviorKind,
  TaxonomySemanticRole,
  TaxonomyStructuralKind,
} from "../../domain/taxonomy/CompositionTaxonomy";
import type { RegistryAsset } from "../../domain/asset-registry/RegistryAsset";
import type { RegistryFilterParams } from "./RegistryQueryService";
import { RegistryQueryService } from "./RegistryQueryService";

export interface CrossStudioTaxonomyQuery {
  readonly structuralKinds?: ReadonlyArray<TaxonomyStructuralKind>;
  readonly semanticRoles?: ReadonlyArray<TaxonomySemanticRole>;
  readonly behaviorKinds?: ReadonlyArray<TaxonomyBehaviorKind>;
  readonly limit?: number;
}

export interface CrossStudioContractFacetQuery extends CrossStudioTaxonomyQuery {
  readonly parameterIds?: ReadonlyArray<string>;
  readonly invocationModes?: ReadonlyArray<NonNullable<AssetContractDescriptor["execution"]>["invocationMode"]>;
  readonly sideEffects?: ReadonlyArray<NonNullable<AssetContractDescriptor["execution"]>["sideEffects"]>;
}

export interface CrossStudioProvenanceFacetQuery extends CrossStudioTaxonomyQuery {
  readonly sourceTypes?: ReadonlyArray<string>;
  readonly creatorIds?: ReadonlyArray<string>;
}

export interface CrossStudioDependencyQuery extends CrossStudioTaxonomyQuery {
  readonly dependsOnAssetIds?: ReadonlyArray<string>;
  readonly dependsOnVersionIds?: ReadonlyArray<string>;
}

function toRegistryFilters(params: CrossStudioTaxonomyQuery = {}): RegistryFilterParams {
  return Object.freeze({
    structuralKinds: params.structuralKinds,
    semanticRoles: params.semanticRoles,
    behaviorKinds: params.behaviorKinds,
    limit: params.limit,
  });
}

export class CrossStudioRegistryQueryService {
  constructor(private readonly registryQueryService: RegistryQueryService) {}

  public async listAllAssets(limit?: number): Promise<ReadonlyArray<RegistryAsset>> {
    return this.registryQueryService.queryRegistry({ limit });
  }

  public async listByTaxonomy(params: CrossStudioTaxonomyQuery = {}): Promise<ReadonlyArray<RegistryAsset>> {
    return this.registryQueryService.queryRegistry(toRegistryFilters(params));
  }

  public async listByContractFacets(params: CrossStudioContractFacetQuery = {}): Promise<ReadonlyArray<RegistryAsset>> {
    return this.registryQueryService.queryRegistry({
      ...toRegistryFilters(params),
      contractParameterIds: params.parameterIds,
      contractInvocationModes: params.invocationModes,
      contractSideEffects: params.sideEffects,
    });
  }

  public async listByProvenanceFacets(params: CrossStudioProvenanceFacetQuery = {}): Promise<ReadonlyArray<RegistryAsset>> {
    return this.registryQueryService.queryRegistry({
      ...toRegistryFilters(params),
      provenanceSourceTypes: params.sourceTypes,
      provenanceCreatorIds: params.creatorIds,
    });
  }

  public async listByDependencyRelationship(params: CrossStudioDependencyQuery): Promise<ReadonlyArray<RegistryAsset>> {
    return this.registryQueryService.queryRegistry({
      ...toRegistryFilters(params),
      dependsOnAssetIds: params.dependsOnAssetIds,
      dependsOnVersionIds: params.dependsOnVersionIds,
    });
  }

  public async getAssetByAssetId(assetId: string): Promise<RegistryAsset | undefined> {
    const normalized = assetId.trim();
    if (!normalized) {
      return undefined;
    }

    const assets = await this.registryQueryService.queryRegistry();
    return assets.find((asset) => asset.assetId === normalized);
  }

  public async getAssetByVersionId(versionId: string): Promise<RegistryAsset | undefined> {
    const normalized = versionId.trim();
    if (!normalized) {
      return undefined;
    }

    const assets = await this.registryQueryService.queryRegistry();
    return assets.find((asset) => asset.versionId === normalized);
  }

  public async listCrossStudioAssetKinds(): Promise<ReadonlyArray<CompositionTaxonomyDescriptor>> {
    const assets = await this.registryQueryService.queryRegistry();
    const deduped = new Map<string, CompositionTaxonomyDescriptor>();
    for (const asset of assets) {
      if (!asset.taxonomy) {
        continue;
      }

      const key = `${asset.taxonomy.structuralKind}:${asset.taxonomy.semanticRole}:${asset.taxonomy.behaviorKind}`;
      deduped.set(key, asset.taxonomy);
    }

    return Object.freeze([...deduped.values()]);
  }
}
