import type { CanonicalEntityType } from "../../application/ports/interfaces/ICanonicalAssetIdentityRepository";
import type {
  CanonicalAssetDetailReadModel,
  CanonicalDependencyStateReadModel,
  CanonicalReconciliationReadModel,
  CanonicalVersionChainItemReadModel,
} from "../../application/assets-system/AssetManagementReadModels";

export interface CanonicalAssetManagementServiceOptions {
  readonly listAssets?: () => Promise<ReadonlyArray<CanonicalAssetDetailReadModel>>;
  readonly loadAssetDetail?: (assetId: string) => Promise<CanonicalAssetDetailReadModel | undefined>;
  readonly listVersionChain?: (assetId: string) => Promise<ReadonlyArray<CanonicalVersionChainItemReadModel>>;
  readonly evaluateDependencyState?: (versionId: string) => Promise<CanonicalDependencyStateReadModel>;
  readonly reconcileIdentity?: (params: { entityType: CanonicalEntityType; entityId: string }) => Promise<CanonicalReconciliationReadModel>;
  readonly replayScopedProjection?: (params: { entityType: CanonicalEntityType; entityId: string; versionId?: string }) => Promise<{
    readonly replayed: boolean;
    readonly reason?: string;
  }>;
}

export class CanonicalAssetManagementService {
  constructor(private readonly options: CanonicalAssetManagementServiceOptions = {}) {}

  public async listAssets(): Promise<ReadonlyArray<CanonicalAssetDetailReadModel>> {
    return this.options.listAssets ? this.options.listAssets() : Object.freeze([]);
  }

  public async loadAssetDetail(assetId: string): Promise<CanonicalAssetDetailReadModel | undefined> {
    return this.options.loadAssetDetail ? this.options.loadAssetDetail(assetId.trim()) : undefined;
  }

  public async listVersionChain(assetId: string): Promise<ReadonlyArray<CanonicalVersionChainItemReadModel>> {
    return this.options.listVersionChain ? this.options.listVersionChain(assetId.trim()) : Object.freeze([]);
  }

  public async evaluateDependencyState(versionId: string): Promise<CanonicalDependencyStateReadModel | undefined> {
    if (!this.options.evaluateDependencyState) {
      return undefined;
    }
    return this.options.evaluateDependencyState(versionId.trim());
  }

  public async reconcileIdentity(params: { entityType: CanonicalEntityType; entityId: string }): Promise<CanonicalReconciliationReadModel | undefined> {
    if (!this.options.reconcileIdentity) {
      return undefined;
    }
    return this.options.reconcileIdentity({
      entityType: params.entityType,
      entityId: params.entityId.trim(),
    });
  }

  public async replayScopedProjection(params: { entityType: CanonicalEntityType; entityId: string; versionId?: string }): Promise<{
    readonly replayed: boolean;
    readonly reason?: string;
  }> {
    if (!this.options.replayScopedProjection) {
      return Object.freeze({
        replayed: false,
        reason: "Graph replay is not configured in this runtime.",
      });
    }
    return this.options.replayScopedProjection({
      entityType: params.entityType,
      entityId: params.entityId.trim(),
      versionId: params.versionId?.trim() || undefined,
    });
  }
}
