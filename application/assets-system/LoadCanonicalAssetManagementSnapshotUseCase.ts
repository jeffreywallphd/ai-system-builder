import type { GetCanonicalDependencyStateUseCase } from "./CanonicalDependencyStateUseCase";
import type { ExplainCanonicalVersionExistenceUseCase, LoadCanonicalAssetDetailUseCase } from "./CanonicalAssetReadUseCases";
import type { GetAssetVersionHistoryUseCase } from "./GetAssetVersionHistoryUseCase";
import type { VerifyAssetGraphProjectionUseCase } from "./VerifyAssetGraphProjectionUseCase";

export interface CanonicalAssetManagementSnapshot {
  readonly asset: {
    readonly assetId: string;
    readonly name: string;
    readonly kind: string;
    readonly status: string;
    readonly latestVersionId?: string;
    readonly versionCount: number;
    readonly transformationCount: number;
    readonly lineageEdgeCount: number;
  };
  readonly versions: ReadonlyArray<{
    readonly versionId: string;
    readonly parentVersionId?: string;
    readonly createdAt: Date;
    readonly label?: string;
    readonly dependencyState: {
      readonly state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
      readonly reasons: ReadonlyArray<string>;
      readonly nextActions: ReadonlyArray<string>;
    };
  }>;
  readonly dependencyLifecycleSummary: {
    readonly healthy: number;
    readonly impacted: number;
    readonly stale: number;
    readonly partiallyTrusted: number;
    readonly reconciliationNeeded: number;
  };
  readonly existenceExplanation?: {
    readonly versionId: string;
    readonly explanation: string;
    readonly evidence: ReadonlyArray<string>;
  };
  readonly projectionHealth?: {
    readonly matched: boolean;
    readonly failedChecks: ReadonlyArray<string>;
    readonly edgeCount: number;
    readonly scopedVersionCount: number;
  };
}

export class LoadCanonicalAssetManagementSnapshotUseCase {
  constructor(
    private readonly loadAssetDetailUseCase: LoadCanonicalAssetDetailUseCase,
    private readonly getVersionHistoryUseCase: GetAssetVersionHistoryUseCase,
    private readonly dependencyStateUseCase: GetCanonicalDependencyStateUseCase,
    private readonly explainVersionExistenceUseCase: ExplainCanonicalVersionExistenceUseCase,
    private readonly verifyProjectionUseCase?: VerifyAssetGraphProjectionUseCase,
  ) {}

  public async execute(params: {
    readonly assetId: string;
    readonly includeProjectionHealth?: boolean;
    readonly versionIdsInProjectionScope?: ReadonlyArray<string>;
  }): Promise<CanonicalAssetManagementSnapshot | undefined> {
    const normalizedAssetId = params.assetId.trim();
    if (!normalizedAssetId) {
      throw new Error("LoadCanonicalAssetManagementSnapshotUseCase requires a non-empty assetId.");
    }

    const detail = await this.loadAssetDetailUseCase.execute(normalizedAssetId);
    if (!detail) {
      return undefined;
    }

    const versions = await this.getVersionHistoryUseCase.execute(normalizedAssetId);
    const versionsWithState = await Promise.all(versions.map(async (version) => {
      const dependencyState = await this.dependencyStateUseCase.execute({
        versionId: version.versionId,
        preferPersistedIfFreshMs: 300_000,
      });
      return Object.freeze({
        versionId: version.versionId,
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt,
        label: version.versionLabel,
        dependencyState: Object.freeze({
          state: dependencyState.state,
          reasons: dependencyState.reasons,
          nextActions: dependencyState.nextActions,
        }),
      });
    }));

    const lifecycleSummary = Object.freeze({
      healthy: versionsWithState.filter((entry) => entry.dependencyState.state === "healthy").length,
      impacted: versionsWithState.filter((entry) => entry.dependencyState.state === "impacted").length,
      stale: versionsWithState.filter((entry) => entry.dependencyState.state === "stale").length,
      partiallyTrusted: versionsWithState.filter((entry) => entry.dependencyState.state === "partially-trusted").length,
      reconciliationNeeded: versionsWithState.filter((entry) => entry.dependencyState.state === "reconciliation-needed").length,
    });

    const existenceExplanation = detail.latestVersion
      ? await this.explainVersionExistenceUseCase.execute(detail.latestVersion.versionId)
      : undefined;

    const projectionHealth = params.includeProjectionHealth && this.verifyProjectionUseCase
      ? await this.verifyProjectionUseCase.execute({
        assetId: normalizedAssetId,
        versionIdsInScope: params.versionIdsInProjectionScope,
      }).then((verification) => Object.freeze({
        matched: verification.matched,
        failedChecks: Object.freeze(verification.checks.filter((entry) => !entry.matched).map((entry) => `${entry.code}: ${entry.message}`)),
        edgeCount: verification.projectionSummary.edgeCount,
        scopedVersionCount: verification.projectionSummary.scopedVersionCount,
      }))
      : undefined;

    return Object.freeze({
      asset: Object.freeze({
        assetId: detail.assetId,
        name: detail.name,
        kind: detail.kind,
        status: detail.status,
        latestVersionId: detail.latestVersion?.versionId,
        versionCount: detail.versionCount,
        transformationCount: detail.transformationCount,
        lineageEdgeCount: detail.lineageEdgeCount,
      }),
      versions: Object.freeze(versionsWithState),
      dependencyLifecycleSummary: lifecycleSummary,
      existenceExplanation,
      projectionHealth,
    });
  }
}
