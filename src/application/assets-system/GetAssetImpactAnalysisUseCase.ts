import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";

export class GetAssetImpactAnalysisUseCase {
  constructor(
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly versionRepository: IAssetVersionRepository,
  ) {}

  public async execute(params: { readonly versionId: string; readonly maxDepth?: number }) {
    const maxDepth = Math.max(1, Math.min(params.maxDepth ?? 3, 8));
    const startVersion = await this.versionRepository.getByVersionId(params.versionId);
    if (!startVersion) {
      throw new Error(`Asset version '${params.versionId}' was not found for impact analysis.`);
    }

    const directEdges = await this.lineageRepository.listEdgesByVersionId(params.versionId, "downstream");
    const directDependents = [...new Set(directEdges.map((edge) => edge.toVersionId))];

    const queue: Array<{ readonly versionId: string; readonly depth: number }> = directDependents.map((versionId) => ({ versionId, depth: 1 }));
    const visited = new Set<string>(directDependents);
    const transitive: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) {
        continue;
      }

      const edges = await this.lineageRepository.listEdgesByVersionId(current.versionId, "downstream");
      for (const edge of edges) {
        const next = edge.toVersionId;
        if (visited.has(next)) {
          continue;
        }
        visited.add(next);
        transitive.push(next);
        queue.push({ versionId: next, depth: current.depth + 1 });
      }
    }

    const consumedByTransformations = await this.transformationRepository.listByVersionId(params.versionId)
      .then((transformations) => transformations.filter((entry) => entry.inputVersionIds.includes(params.versionId)));

    const impactedArtifactTransformations = consumedByTransformations.filter((entry) =>
      entry.transformationType.includes("model")
      || entry.transformationType.includes("dataset")
      || entry.transformationType.includes("workflow-output")
    );

    return Object.freeze({
      sourceVersionId: params.versionId,
      sourceAssetId: startVersion.assetId.value,
      maxDepth,
      directDependentVersionIds: Object.freeze(directDependents),
      transitiveDependentVersionIds: Object.freeze(transitive),
      consumedByTransformationIds: Object.freeze(consumedByTransformations.map((entry) => entry.transformationId)),
      impactedArtifactTransformationIds: Object.freeze(impactedArtifactTransformations.map((entry) => entry.transformationId)),
      partialLineageWarning: directDependents.length === 0 && consumedByTransformations.length === 0,
    });
  }
}
