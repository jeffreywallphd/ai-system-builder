import { GetAssetDependencyHealthUseCase } from "./GetAssetDependencyHealthUseCase";
import { ExplainCanonicalVersionExistenceUseCase, GetCanonicalProvenanceSummaryUseCase } from "./CanonicalAssetReadUseCases";

export class GetAssetLineageDiagnosticsUseCase {
  constructor(
    private readonly dependencyHealthUseCase: GetAssetDependencyHealthUseCase,
    private readonly provenanceSummaryUseCase: GetCanonicalProvenanceSummaryUseCase,
    private readonly explanationUseCase: ExplainCanonicalVersionExistenceUseCase,
  ) {}

  public async execute(params: { readonly versionId: string; readonly maxDownstreamDepth?: number }): Promise<{
    readonly versionId: string;
    readonly status: "healthy" | "partial";
    readonly diagnostics: ReadonlyArray<{
      readonly code: string;
      readonly severity: "info" | "warning";
      readonly message: string;
    }>;
  }> {
    const [dependencyHealth, provenance, explanation] = await Promise.all([
      this.dependencyHealthUseCase.execute(params),
      this.provenanceSummaryUseCase.execute(params.versionId),
      this.explanationUseCase.execute(params.versionId),
    ]);

    const diagnostics: Array<{ code: string; severity: "info" | "warning"; message: string }> = [
      {
        code: "LINEAGE_DIRECT",
        severity: "info",
        message: `Direct upstream=${dependencyHealth.direct.upstreamVersionIds.length}, downstream=${dependencyHealth.direct.downstreamVersionIds.length}.`,
      },
      {
        code: "LINEAGE_TRANSITIVE",
        severity: "info",
        message: `Transitive downstream exposure count=${dependencyHealth.transitiveDownstream.versionIds.length} (depth ${dependencyHealth.transitiveDownstream.maxDepth}).`,
      },
      {
        code: "LINEAGE_EXISTENCE_EXPLANATION",
        severity: "info",
        message: explanation.explanation,
      },
    ];

    for (const reason of dependencyHealth.partialReasons) {
      diagnostics.push({
        code: "LINEAGE_PARTIAL",
        severity: "warning",
        message: reason,
      });
    }

    if (provenance.producingTransformationIds.length === 0 && provenance.directUpstreamVersionIds.length === 0) {
      diagnostics.push({
        code: "LINEAGE_GAP",
        severity: "warning",
        message: "No producing transformation and no direct upstream lineage were found.",
      });
    }

    return Object.freeze({
      versionId: params.versionId,
      status: dependencyHealth.confidence === "certain" ? "healthy" : "partial",
      diagnostics: Object.freeze(diagnostics.map((entry) => Object.freeze(entry))),
    });
  }
}
