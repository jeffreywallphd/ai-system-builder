import type { CanonicalDependencyLifecycleState } from "./CanonicalDependencyStateUseCase";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";

export interface CanonicalAssetDetailReadModel {
  readonly assetId: string;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
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
  readonly dependencyState?: {
    readonly state: CanonicalDependencyLifecycleState;
    readonly reasons: ReadonlyArray<string>;
    readonly nextActions: ReadonlyArray<string>;
  };
}

export interface CanonicalDependencyStateReadModel {
  readonly versionId: string;
  readonly state: CanonicalDependencyLifecycleState;
  readonly lineageConfidence: "exact" | "partial";
  readonly lifecycle: {
    readonly source: "persisted-fresh" | "recomputed";
    readonly computedAt: Date;
    readonly reason: string;
  };
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

export interface CanonicalProjectionVerificationReadModel {
  readonly assetId: string;
  readonly matched: boolean;
  readonly trustState?: "trusted" | "mismatch-detected";
  readonly trustExplanation?: string;
  readonly edgeCount: number;
  readonly scopedVersionCount: number;
  readonly failedChecks: ReadonlyArray<string>;
  readonly mismatchedVersionIds?: ReadonlyArray<string>;
  readonly comparison?: {
    readonly scopedVersionIdsCompared: number;
    readonly mismatchedScopedVersions: number;
    readonly missingEdgeReferences: number;
    readonly unexpectedEdgeReferences: number;
  };
  readonly remediation?: {
    readonly status: "none-needed" | "replay-recommended";
    readonly explanation: string;
    readonly actions: ReadonlyArray<string>;
  };
}
