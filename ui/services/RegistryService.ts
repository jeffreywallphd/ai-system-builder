import type { RegistryDependencyGraph, RegistryDependencyTraversal } from "../../application/asset-registry/RegistryDependencyGraphService";
import type { RegistryFilterParams } from "../../application/asset-registry/RegistryQueryService";
import type { ExploreSearchQuery, ExploreSearchResult, UnifiedExploreAssetLibrary } from "../../application/asset-registry/ExploreAssetQueryService";
import type { RegistryDependencyEndpointQuery, RegistryTraversalEndpointQuery, RegistryApiResponse, RegistryAssetDetailQuery, RegistrySearchQuery } from "../../infrastructure/api/registry/RegistryBackendApi";
import type { RegistryAsset } from "../../domain/asset-registry/RegistryAsset";
import { resolveDesktopRegistryBridge } from "../composition/DesktopRegistryBridgeAdapter";

export class RegistryService {
  private requireBridge() {
    const bridge = resolveDesktopRegistryBridge();
    if (!bridge) {
      throw new Error("Desktop registry bridge is unavailable in this runtime.");
    }
    return bridge;
  }

  public async listAssets(limit?: number): Promise<RegistryApiResponse<ReadonlyArray<RegistryAsset>>> {
    const raw = await this.requireBridge().listAssets(limit);
    return JSON.parse(raw) as RegistryApiResponse<ReadonlyArray<RegistryAsset>>;
  }

  public async filterAssets(filters: RegistryFilterParams): Promise<RegistryApiResponse<ReadonlyArray<RegistryAsset>>> {
    const raw = await this.requireBridge().filterAssets(JSON.stringify(filters));
    return JSON.parse(raw) as RegistryApiResponse<ReadonlyArray<RegistryAsset>>;
  }

  public async searchAssets(query: RegistrySearchQuery): Promise<RegistryApiResponse<ReadonlyArray<RegistryAsset>>> {
    const raw = await this.requireBridge().searchAssets(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<ReadonlyArray<RegistryAsset>>;
  }

  public async listExploreAssets(limit?: number): Promise<RegistryApiResponse<UnifiedExploreAssetLibrary>> {
    const raw = await this.requireBridge().listExploreAssets(limit);
    return JSON.parse(raw) as RegistryApiResponse<UnifiedExploreAssetLibrary>;
  }

  public async searchExploreAssets(query: ExploreSearchQuery): Promise<RegistryApiResponse<ExploreSearchResult>> {
    const raw = await this.requireBridge().searchExploreAssets(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<ExploreSearchResult>;
  }

  public async getAssetDetail(query: RegistryAssetDetailQuery): Promise<RegistryApiResponse<RegistryAsset>> {
    const raw = await this.requireBridge().getAssetDetail(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<RegistryAsset>;
  }

  public async getDependencies(query: RegistryDependencyEndpointQuery): Promise<RegistryApiResponse<RegistryDependencyGraph>> {
    const raw = await this.requireBridge().getDependencies(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<RegistryDependencyGraph>;
  }

  public async getDependents(query: RegistryDependencyEndpointQuery): Promise<RegistryApiResponse<RegistryDependencyGraph>> {
    const raw = await this.requireBridge().getDependents(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<RegistryDependencyGraph>;
  }

  public async traverseUpstream(query: RegistryTraversalEndpointQuery): Promise<RegistryApiResponse<RegistryDependencyTraversal>> {
    const raw = await this.requireBridge().traverseUpstream(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<RegistryDependencyTraversal>;
  }

  public async traverseDownstream(query: RegistryTraversalEndpointQuery): Promise<RegistryApiResponse<RegistryDependencyTraversal>> {
    const raw = await this.requireBridge().traverseDownstream(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<RegistryDependencyTraversal>;
  }
}
