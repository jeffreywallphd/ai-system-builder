import type { CanonicalEntityType } from "@application/ports/interfaces/ICanonicalAssetIdentityRepository";
import type {
  CanonicalAssetDetailReadModel,
  CanonicalDependencyStateReadModel,
  CanonicalProjectionVerificationReadModel,
  CanonicalReconciliationReadModel,
  CanonicalVersionChainItemReadModel,
} from "@application/assets-system/AssetManagementReadModels";

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
  readonly verifyProjection?: (params: { assetId: string; versionIdsInScope?: ReadonlyArray<string> }) => Promise<CanonicalProjectionVerificationReadModel>;
  readonly rebuildProjectionScopes?: (params: {
    readonly scopes: ReadonlyArray<
      | { readonly scopeType: "entity"; readonly entityType: CanonicalEntityType; readonly entityId: string; readonly versionId?: string; }
      | { readonly scopeType: "asset"; readonly assetId: string; readonly versionIdsInScope?: ReadonlyArray<string>; }
    >;
    readonly verifyAfterReplay?: boolean;
    readonly verifyBeforeReplay?: boolean;
    readonly replayMismatchedVersionsOnly?: boolean;
  }) => Promise<{
    readonly totalScopes: number;
    readonly replayedScopes: number;
    readonly verifiedScopes: number;
    readonly results: ReadonlyArray<unknown>;
  }>;
  readonly loadManagementSnapshot?: (params: {
    readonly assetId: string;
    readonly includeProjectionHealth?: boolean;
    readonly versionIdsInProjectionScope?: ReadonlyArray<string>;
  }) => Promise<{
    readonly asset: CanonicalAssetDetailReadModel;
    readonly versions: ReadonlyArray<CanonicalVersionChainItemReadModel>;
    readonly dependencyLifecycleSummary: {
      readonly healthy: number;
      readonly impacted: number;
      readonly stale: number;
      readonly partiallyTrusted: number;
      readonly reconciliationNeeded: number;
    };
    readonly operationalSummary: {
      readonly status: "healthy" | "attention-needed";
      readonly explanation: string;
      readonly recommendedActions: ReadonlyArray<string>;
    };
    readonly existenceExplanation?: {
      readonly versionId: string;
      readonly explanation: string;
      readonly evidence: ReadonlyArray<string>;
    };
    readonly projectionHealth?: {
      readonly matched: boolean;
      readonly trustState: "trusted" | "mismatch-detected";
      readonly trustExplanation: string;
      readonly failedChecks: ReadonlyArray<string>;
      readonly edgeCount: number;
      readonly scopedVersionCount: number;
      readonly mismatchedVersionIds: ReadonlyArray<string>;
    };
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

  public async verifyProjection(params: { assetId: string; versionIdsInScope?: ReadonlyArray<string> }): Promise<CanonicalProjectionVerificationReadModel | undefined> {
    if (!this.options.verifyProjection) {
      return undefined;
    }
    return this.options.verifyProjection({
      assetId: params.assetId.trim(),
      versionIdsInScope: params.versionIdsInScope?.map((entry) => entry.trim()).filter(Boolean),
    });
  }

  public async rebuildProjectionScopes(params: {
    readonly scopes: ReadonlyArray<
      | { readonly scopeType: "entity"; readonly entityType: CanonicalEntityType; readonly entityId: string; readonly versionId?: string; }
      | { readonly scopeType: "asset"; readonly assetId: string; readonly versionIdsInScope?: ReadonlyArray<string>; }
    >;
    readonly verifyAfterReplay?: boolean;
    readonly verifyBeforeReplay?: boolean;
    readonly replayMismatchedVersionsOnly?: boolean;
  }): Promise<{
    readonly totalScopes: number;
    readonly replayedScopes: number;
    readonly verifiedScopes: number;
    readonly results: ReadonlyArray<unknown>;
  } | undefined> {
    if (!this.options.rebuildProjectionScopes) {
      return undefined;
    }
    return this.options.rebuildProjectionScopes(params);
  }

  public async loadManagementSnapshot(params: {
    readonly assetId: string;
    readonly includeProjectionHealth?: boolean;
    readonly versionIdsInProjectionScope?: ReadonlyArray<string>;
  }): Promise<{
    readonly asset: CanonicalAssetDetailReadModel;
    readonly versions: ReadonlyArray<CanonicalVersionChainItemReadModel>;
    readonly dependencyLifecycleSummary: {
      readonly healthy: number;
      readonly impacted: number;
      readonly stale: number;
      readonly partiallyTrusted: number;
      readonly reconciliationNeeded: number;
    };
    readonly operationalSummary: {
      readonly status: "healthy" | "attention-needed";
      readonly explanation: string;
      readonly recommendedActions: ReadonlyArray<string>;
    };
    readonly existenceExplanation?: {
      readonly versionId: string;
      readonly explanation: string;
      readonly evidence: ReadonlyArray<string>;
    };
    readonly projectionHealth?: {
      readonly matched: boolean;
      readonly trustState: "trusted" | "mismatch-detected";
      readonly trustExplanation: string;
      readonly failedChecks: ReadonlyArray<string>;
      readonly edgeCount: number;
      readonly scopedVersionCount: number;
      readonly mismatchedVersionIds: ReadonlyArray<string>;
    };
  } | undefined> {
    if (!this.options.loadManagementSnapshot) {
      return undefined;
    }
    return this.options.loadManagementSnapshot({
      assetId: params.assetId.trim(),
      includeProjectionHealth: params.includeProjectionHealth,
      versionIdsInProjectionScope: params.versionIdsInProjectionScope?.map((entry) => entry.trim()).filter(Boolean),
    });
  }
}

