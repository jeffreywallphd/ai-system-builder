import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";

export class GetAssetDependencyHealthUseCase {
  constructor(
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly versionRepository: IAssetVersionRepository,
  ) {}

  public async execute(params: { readonly versionId: string; readonly maxDownstreamDepth?: number }): Promise<{
    readonly versionId: string;
    readonly assetId: string;
    readonly direct: {
      readonly upstreamVersionIds: ReadonlyArray<string>;
      readonly downstreamVersionIds: ReadonlyArray<string>;
      readonly consumingTransformationIds: ReadonlyArray<string>;
    };
    readonly transitiveDownstream: {
      readonly maxDepth: number;
      readonly versionIds: ReadonlyArray<string>;
    };
    readonly confidence: "certain" | "partial";
    readonly partialReasons: ReadonlyArray<string>;
    readonly staleExposure: ReadonlyArray<{
      readonly versionId: string;
      readonly exposure: "direct" | "transitive";
      readonly reason: string;
    }>;
  }> {
    const maxDepth = Math.max(1, Math.min(params.maxDownstreamDepth ?? 3, 8));
    const source = await this.versionRepository.getByVersionId(params.versionId);
    if (!source) {
      throw new Error(`Asset version '${params.versionId}' was not found for dependency health analysis.`);
    }

    const [upstreamEdges, downstreamEdges, relatedTransformations] = await Promise.all([
      this.lineageRepository.listEdgesByVersionId(params.versionId, "upstream"),
      this.lineageRepository.listEdgesByVersionId(params.versionId, "downstream"),
      this.transformationRepository.listByVersionId(params.versionId),
    ]);

    const directUpstreamVersionIds = [...new Set(upstreamEdges.map((edge) => edge.fromVersionId))];
    const directDownstreamVersionIds = [...new Set(downstreamEdges.map((edge) => edge.toVersionId))];
    const consumingTransformationIds = relatedTransformations
      .filter((entry) => entry.inputVersionIds.includes(params.versionId))
      .map((entry) => entry.transformationId);
    const producingTransformations = relatedTransformations.filter((entry) => entry.outputVersionIds.includes(params.versionId));

    const queue: Array<{ readonly versionId: string; readonly depth: number }> = directDownstreamVersionIds.map((versionId) => ({ versionId, depth: 1 }));
    const visited = new Set<string>(directDownstreamVersionIds);
    const transitiveVersionIds: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) {
        continue;
      }

      const edges = await this.lineageRepository.listEdgesByVersionId(current.versionId, "downstream");
      for (const edge of edges) {
        const nextVersionId = edge.toVersionId;
        if (visited.has(nextVersionId)) {
          continue;
        }
        visited.add(nextVersionId);
        transitiveVersionIds.push(nextVersionId);
        queue.push({ versionId: nextVersionId, depth: current.depth + 1 });
      }
    }

    const partialReasons: string[] = [];
    if (directUpstreamVersionIds.length === 0 && producingTransformations.length === 0) {
      partialReasons.push("No direct upstream edges or producing transformations were found for this version.");
    }
    if (producingTransformations.some((entry) => entry.status === "partial" || entry.status === "degraded")) {
      partialReasons.push("One or more producing transformations are marked partial/degraded.");
    }

    const staleExposure = [
      ...directDownstreamVersionIds.map((versionId) => ({
        versionId,
        exposure: "direct" as const,
        reason: `Direct lineage edge from '${params.versionId}' to '${versionId}' indicates likely impact when upstream changes.`,
      })),
      ...transitiveVersionIds.map((versionId) => ({
        versionId,
        exposure: "transitive" as const,
        reason: `Transitive downstream lineage from '${params.versionId}' reaches '${versionId}' within depth ${maxDepth}.`,
      })),
    ];

    return Object.freeze({
      versionId: params.versionId,
      assetId: source.assetId.value,
      direct: Object.freeze({
        upstreamVersionIds: Object.freeze(directUpstreamVersionIds),
        downstreamVersionIds: Object.freeze(directDownstreamVersionIds),
        consumingTransformationIds: Object.freeze(consumingTransformationIds),
      }),
      transitiveDownstream: Object.freeze({
        maxDepth,
        versionIds: Object.freeze(transitiveVersionIds),
      }),
      confidence: partialReasons.length > 0 ? "partial" : "certain",
      partialReasons: Object.freeze(partialReasons),
      staleExposure: Object.freeze(staleExposure),
    });
  }
}
