import type { GetCanonicalDependencyStateUseCase } from "./CanonicalDependencyStateUseCase";
import type { ExplainCanonicalVersionExistenceUseCase, LoadCanonicalAssetDetailUseCase } from "./CanonicalAssetReadUseCases";
import type { GetAssetVersionHistoryUseCase } from "./GetAssetVersionHistoryUseCase";
import type { VerifyAssetGraphProjectionUseCase } from "./VerifyAssetGraphProjectionUseCase";
import { ProjectionTrustReadModelService } from "./ProjectionTrustReadModelService";

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
}

export class LoadCanonicalAssetManagementSnapshotUseCase {
  private readonly projectionTrustReadModelService: ProjectionTrustReadModelService;

  constructor(
    private readonly loadAssetDetailUseCase: LoadCanonicalAssetDetailUseCase,
    private readonly getVersionHistoryUseCase: GetAssetVersionHistoryUseCase,
    private readonly dependencyStateUseCase: GetCanonicalDependencyStateUseCase,
    private readonly explainVersionExistenceUseCase: ExplainCanonicalVersionExistenceUseCase,
    private readonly verifyProjectionUseCase?: VerifyAssetGraphProjectionUseCase,
    projectionTrustReadModelService?: ProjectionTrustReadModelService,
  ) {
    this.projectionTrustReadModelService = projectionTrustReadModelService ?? new ProjectionTrustReadModelService();
  }

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

    const lifecycleSummary = this.buildLifecycleSummary(versionsWithState);

    const existenceExplanation = detail.latestVersion
      ? await this.explainVersionExistenceUseCase.execute(detail.latestVersion.versionId)
      : undefined;
    const operationalSummary = this.buildOperationalSummary(versionsWithState);

    const projectionHealth = params.includeProjectionHealth && this.verifyProjectionUseCase
      ? await this.verifyProjectionUseCase.execute({
        assetId: normalizedAssetId,
        versionIdsInScope: params.versionIdsInProjectionScope,
      }).then((verification) => {
        const projection = this.projectionTrustReadModelService.summarize(verification);
        return Object.freeze({
          matched: projection.matched,
          trustState: projection.trustState ?? "mismatch-detected",
          trustExplanation: projection.trustExplanation ?? "Projection trust state is unavailable.",
          failedChecks: projection.failedChecks,
          edgeCount: projection.edgeCount,
          scopedVersionCount: projection.scopedVersionCount,
          mismatchedVersionIds: projection.mismatchedVersionIds ?? Object.freeze([]),
        });
      })
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
      operationalSummary,
      existenceExplanation,
      projectionHealth,
    });
  }

  private buildOperationalSummary(versions: ReadonlyArray<{
    readonly dependencyState: {
      readonly state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
      readonly nextActions: ReadonlyArray<string>;
    };
  }>): CanonicalAssetManagementSnapshot["operationalSummary"] {
    const unhealthy = versions.filter((entry) => entry.dependencyState.state !== "healthy");
    if (unhealthy.length === 0) {
      return Object.freeze({
        status: "healthy",
        explanation: "All versions in scope currently report healthy dependency-state.",
        recommendedActions: Object.freeze(["No reconciliation is required."]),
      });
    }

    const actions = [...new Set(unhealthy.flatMap((entry) => entry.dependencyState.nextActions))];
    return Object.freeze({
      status: "attention-needed",
      explanation: `${unhealthy.length} version(s) in this chain require dependency attention.`,
      recommendedActions: Object.freeze(actions.slice(0, 5)),
    });
  }

  private buildLifecycleSummary(versions: ReadonlyArray<{
    readonly dependencyState: {
      readonly state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
    };
  }>): CanonicalAssetManagementSnapshot["dependencyLifecycleSummary"] {
    const summary = versions.reduce(
      (counts, version) => {
        switch (version.dependencyState.state) {
          case "healthy":
            counts.healthy += 1;
            break;
          case "impacted":
            counts.impacted += 1;
            break;
          case "stale":
            counts.stale += 1;
            break;
          case "partially-trusted":
            counts.partiallyTrusted += 1;
            break;
          case "reconciliation-needed":
            counts.reconciliationNeeded += 1;
            break;
        }
        return counts;
      },
      {
        healthy: 0,
        impacted: 0,
        stale: 0,
        partiallyTrusted: 0,
        reconciliationNeeded: 0,
      },
    );
    return Object.freeze(summary);
  }
}
