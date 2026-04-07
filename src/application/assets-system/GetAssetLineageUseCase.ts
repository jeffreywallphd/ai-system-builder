import type { AssetLineageDirection, IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { AssetLineageEdge } from "@domain/assets/AssetLineageEdge";

export class GetAssetLineageUseCase {
  constructor(private readonly lineageRepository: IAssetLineageRepository) {}

  public async execute(params: {
    readonly versionId: string;
    readonly direction?: Exclude<AssetLineageDirection, "both">;
    readonly maxDepth?: number;
    readonly maxEdges?: number;
  }): Promise<ReadonlyArray<AssetLineageEdge>> {
    const versionId = params.versionId.trim();
    if (!versionId) {
      throw new Error("GetAssetLineageUseCase requires a non-empty versionId.");
    }

    const direction = params.direction ?? "upstream";
    const maxDepth = Math.max(1, params.maxDepth ?? 1);
    const maxEdges = Math.max(1, params.maxEdges ?? 100);
    const visited = new Set<string>([versionId]);
    const queue: Array<{ readonly versionId: string; readonly depth: number }> = [{ versionId, depth: 0 }];
    const results: AssetLineageEdge[] = [];

    while (queue.length > 0 && results.length < maxEdges) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) {
        continue;
      }

      const edges = await this.lineageRepository.listEdgesByVersionId(current.versionId, direction);
      for (const edge of edges) {
        if (results.length >= maxEdges) {
          break;
        }

        results.push(edge);
        const nextVersionId = direction === "upstream" ? edge.fromVersionId : edge.toVersionId;
        if (!visited.has(nextVersionId)) {
          visited.add(nextVersionId);
          queue.push({ versionId: nextVersionId, depth: current.depth + 1 });
        }
      }
    }

    return Object.freeze(results);
  }
}

