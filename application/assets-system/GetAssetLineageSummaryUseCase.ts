import type { AssetLineageDirection } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";

export class GetAssetLineageSummaryUseCase {
  constructor(
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly transformationRepository?: IAssetTransformationRepository,
  ) {}

  public async execute(request: {
    readonly versionId: string;
    readonly direction: Exclude<AssetLineageDirection, "both">;
    readonly maxDepth?: number;
    readonly maxEdges?: number;
  }): Promise<{
    readonly rootVersionId: string;
    readonly direction: "upstream" | "downstream";
    readonly visitedVersionIds: ReadonlyArray<string>;
    readonly traversedEdgeIds: ReadonlyArray<string>;
    readonly traversedEdges: ReadonlyArray<{
      readonly edgeId: string;
      readonly fromVersionId: string;
      readonly toVersionId: string;
      readonly type: string;
      readonly transformationId?: string;
      readonly transformationType?: string;
      readonly transformationStatus?: string;
    }>;
  }> {
    const rootVersionId = request.versionId.trim();
    if (!rootVersionId) {
      throw new Error("GetAssetLineageSummaryUseCase requires a non-empty versionId.");
    }

    const maxDepth = Math.max(1, request.maxDepth ?? 2);
    const maxEdges = Math.max(1, request.maxEdges ?? 100);
    const direction = request.direction;

    const visited = new Set<string>([rootVersionId]);
    const traversedEdges = new Map<string, true>();
    const traversedEdgeDetails = new Map<string, {
      readonly edgeId: string;
      readonly fromVersionId: string;
      readonly toVersionId: string;
      readonly type: string;
      readonly transformationId?: string;
      readonly transformationType?: string;
      readonly transformationStatus?: string;
    }>();
    let frontier = new Set<string>([rootVersionId]);

    for (let depth = 0; depth < maxDepth && frontier.size > 0 && traversedEdges.size < maxEdges; depth += 1) {
      const nextFrontier = new Set<string>();

      for (const versionId of frontier) {
        const edges = await this.lineageRepository.listEdgesByVersionId(versionId, direction);

        for (const edge of edges) {
          traversedEdges.set(edge.edgeId, true);
          let transformationType: string | undefined;
          let transformationStatus: string | undefined;
          if (edge.transformationId) {
            const transformation = await this.transformationRepository?.getById(edge.transformationId);
            transformationType = transformation?.transformationType;
            transformationStatus = transformation?.status;
          }
          traversedEdgeDetails.set(edge.edgeId, Object.freeze({
            edgeId: edge.edgeId,
            fromVersionId: edge.fromVersionId,
            toVersionId: edge.toVersionId,
            type: edge.type,
            transformationId: edge.transformationId,
            transformationType,
            transformationStatus,
          }));

          const nextVersionId = direction === "upstream" ? edge.fromVersionId : edge.toVersionId;
          if (!visited.has(nextVersionId)) {
            visited.add(nextVersionId);
            nextFrontier.add(nextVersionId);
          }

          if (traversedEdges.size >= maxEdges) {
            break;
          }
        }

        if (traversedEdges.size >= maxEdges) {
          break;
        }
      }

      frontier = nextFrontier;
    }

    return Object.freeze({
      rootVersionId,
      direction,
      visitedVersionIds: Object.freeze([...visited]),
      traversedEdgeIds: Object.freeze([...traversedEdges.keys()]),
      traversedEdges: Object.freeze([...traversedEdgeDetails.values()]),
    });
  }
}
