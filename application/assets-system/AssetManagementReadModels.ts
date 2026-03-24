import type { CanonicalDependencyLifecycleState } from "./CanonicalDependencyStateUseCase";

export interface CanonicalAssetDetailReadModel {
  readonly assetId: string;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly latestVersionId?: string;
  readonly versionCount: number;
  readonly transformationCount: number;
  readonly lineageEdgeCount: number;
}

export interface CanonicalVersionChainItemReadModel {
  readonly versionId: string;
  readonly parentVersionId?: string;
  readonly createdAt: Date;
  readonly label?: string;
  readonly dependencyState?: CanonicalDependencyLifecycleState;
}

export interface CanonicalDependencyStateReadModel {
  readonly versionId: string;
  readonly state: CanonicalDependencyLifecycleState;
  readonly lineageConfidence: "exact" | "partial";
  readonly reasons: ReadonlyArray<string>;
  readonly nextActions: ReadonlyArray<string>;
}

export interface CanonicalReconciliationReadModel {
  readonly entityType: string;
  readonly entityId: string;
  readonly reconciled: boolean;
  readonly reason: string;
  readonly previousVersionId?: string;
  readonly reconciledVersionId?: string;
}
