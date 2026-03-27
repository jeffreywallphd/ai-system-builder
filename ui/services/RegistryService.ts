import type { RegistryFilterParams } from "../../application/asset-registry/RegistryQueryService";
import type { RegistryDependencyEndpointQuery, RegistryTraversalEndpointQuery, RegistryApiResponse } from "../../infrastructure/api/registry/RegistryBackendApi";
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

  public async getDependencies(query: RegistryDependencyEndpointQuery): Promise<RegistryApiResponse<unknown>> {
    const raw = await this.requireBridge().getDependencies(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<unknown>;
  }

  public async getDependents(query: RegistryDependencyEndpointQuery): Promise<RegistryApiResponse<unknown>> {
    const raw = await this.requireBridge().getDependents(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<unknown>;
  }

  public async traverseUpstream(query: RegistryTraversalEndpointQuery): Promise<RegistryApiResponse<unknown>> {
    const raw = await this.requireBridge().traverseUpstream(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<unknown>;
  }

  public async traverseDownstream(query: RegistryTraversalEndpointQuery): Promise<RegistryApiResponse<unknown>> {
    const raw = await this.requireBridge().traverseDownstream(JSON.stringify(query));
    return JSON.parse(raw) as RegistryApiResponse<unknown>;
  }
}
