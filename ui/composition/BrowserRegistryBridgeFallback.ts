import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { AssetVersion } from "../../src/domain/assets/AssetVersion";
import type { AssetLineageEdge } from "../../src/domain/assets/AssetLineageEdge";
import type { DesktopRegistryBridge } from "../../electron/shared/DesktopContracts";
import type { IAssetRecordRepository } from "../../application/ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../application/ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../../application/ports/interfaces/IAssetLineageRepository";
import { ListPersistedWorkflowsUseCase } from "../../application/workflow-persistence/ListPersistedWorkflowsUseCase";
import { CompositionAssetContractResolver } from "../../application/contracts/CompositionAssetContractResolver";
import { CrossStudioRegistryQueryService } from "../../application/asset-registry/CrossStudioRegistryQueryService";
import { RegistryQueryService } from "../../application/asset-registry/RegistryQueryService";
import { RegistryDependencyGraphService } from "../../application/asset-registry/RegistryDependencyGraphService";
import { RegistryBackendApi } from "../../infrastructure/api/registry/RegistryBackendApi";
import { resolveBrowserWorkflowPersistenceRepository } from "./BrowserFallbackRepositories";

class EmptyAssetRecordRepository implements IAssetRecordRepository {
  public async save(_asset: IAsset): Promise<void> {}

  public async getById(_assetId: string): Promise<IAsset | undefined> {
    return undefined;
  }

  public async list(): Promise<ReadonlyArray<IAsset>> {
    return Object.freeze([]);
  }

  public async exists(_assetId: string): Promise<boolean> {
    return false;
  }
}

class EmptyAssetVersionRepository implements IAssetVersionRepository {
  public async saveVersion(_version: AssetVersion): Promise<void> {}

  public async getByVersionId(_versionId: string): Promise<AssetVersion | undefined> {
    return undefined;
  }

  public async listVersionsByAssetId(_assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return Object.freeze([]);
  }
}

class EmptyAssetLineageRepository implements IAssetLineageRepository {
  public async saveEdge(_edge: AssetLineageEdge): Promise<void> {}

  public async listEdgesByVersionId(
    _versionId: string,
    _direction?: "upstream" | "downstream" | "both",
  ): Promise<ReadonlyArray<AssetLineageEdge>> {
    return Object.freeze([]);
  }
}

let fallbackBridge: DesktopRegistryBridge | undefined;

export function resolveBrowserRegistryBridgeFallback(): DesktopRegistryBridge {
  if (fallbackBridge) {
    return fallbackBridge;
  }

  const records = new EmptyAssetRecordRepository();
  const versions = new EmptyAssetVersionRepository();
  const lineages = new EmptyAssetLineageRepository();
  const registryQueryService = new RegistryQueryService(
    records,
    versions,
    lineages,
    new CompositionAssetContractResolver(),
  );
  const backendApi = new RegistryBackendApi(
    new CrossStudioRegistryQueryService(registryQueryService),
    new RegistryDependencyGraphService(registryQueryService, versions),
    new ListPersistedWorkflowsUseCase(resolveBrowserWorkflowPersistenceRepository()),
  );

  fallbackBridge = Object.freeze<DesktopRegistryBridge>({
    listAssets: (limit) => backendApi.listAssets(limit).then((response) => JSON.stringify(response)),
    filterAssets: (filtersJson) => backendApi.filterAssets(JSON.parse(filtersJson)).then((response) => JSON.stringify(response)),
    searchAssets: (queryJson) => backendApi.searchAssets(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
    listExploreAssets: (limit) => backendApi.listExploreAssets(limit).then((response) => JSON.stringify(response)),
    searchExploreAssets: (queryJson) => backendApi.searchExploreAssets(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
    getAssetDetail: (queryJson) => backendApi.getAssetDetail(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
    getDependencies: (queryJson) => backendApi.getDependencies(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
    getDependents: (queryJson) => backendApi.getDependents(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
    traverseUpstream: (queryJson) => backendApi.traverseDependencies(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
    traverseDownstream: (queryJson) => backendApi.traverseDependents(JSON.parse(queryJson)).then((response) => JSON.stringify(response)),
  });

  return fallbackBridge;
}
