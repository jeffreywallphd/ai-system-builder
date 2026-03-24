import type { CanonicalProjectionVerificationReadModel } from "./AssetManagementReadModels";

interface ProjectionVerificationResult {
  readonly assetId: string;
  readonly matched: boolean;
  readonly trust: {
    readonly state: "trusted" | "mismatch-detected";
    readonly explanation: string;
    readonly recommendedActions: ReadonlyArray<string>;
  };
  readonly projectionSummary: {
    readonly edgeCount: number;
    readonly scopedVersionCount: number;
  };
  readonly mismatches: ReadonlyArray<{
    readonly versionId: string;
    readonly missingUpstreamVersionIds: ReadonlyArray<string>;
    readonly unexpectedUpstreamVersionIds: ReadonlyArray<string>;
    readonly missingDownstreamVersionIds: ReadonlyArray<string>;
    readonly unexpectedDownstreamVersionIds: ReadonlyArray<string>;
  }>;
  readonly checks: ReadonlyArray<{
    readonly code: string;
    readonly matched: boolean;
    readonly message: string;
  }>;
}

export class ProjectionTrustReadModelService {
  public summarize(verification: ProjectionVerificationResult): CanonicalProjectionVerificationReadModel {
    const missingEdgeReferences = verification.mismatches.reduce(
      (total, entry) => total
        + (entry.missingUpstreamVersionIds?.length ?? 0)
        + (entry.missingDownstreamVersionIds?.length ?? 0),
      0,
    );
    const unexpectedEdgeReferences = verification.mismatches.reduce(
      (total, entry) => total
        + (entry.unexpectedUpstreamVersionIds?.length ?? 0)
        + (entry.unexpectedDownstreamVersionIds?.length ?? 0),
      0,
    );

    return Object.freeze({
      assetId: verification.assetId,
      matched: verification.matched,
      trustState: verification.trust.state,
      trustExplanation: verification.trust.explanation,
      edgeCount: verification.projectionSummary.edgeCount,
      scopedVersionCount: verification.projectionSummary.scopedVersionCount,
      failedChecks: Object.freeze(verification.checks.filter((entry) => !entry.matched).map((entry) => `${entry.code}: ${entry.message}`)),
      mismatchedVersionIds: Object.freeze(verification.mismatches.map((entry) => entry.versionId)),
      comparison: Object.freeze({
        scopedVersionIdsCompared: verification.projectionSummary.scopedVersionCount,
        mismatchedScopedVersions: verification.mismatches.length,
        missingEdgeReferences,
        unexpectedEdgeReferences,
      }),
      remediation: Object.freeze({
        status: verification.matched ? "none-needed" : "replay-recommended",
        explanation: verification.matched
          ? "Projection trust is healthy for this scope; no repair action is needed."
          : `Projection trust mismatch is scoped to ${verification.mismatches.length} version(s); replay and re-verify this scope.`,
        actions: Object.freeze(verification.trust.recommendedActions),
      }),
    });
  }
}
