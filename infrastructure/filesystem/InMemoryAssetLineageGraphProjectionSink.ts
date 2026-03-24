import type { IAssetLineageGraphProjectionSink } from "../../application/ports/interfaces/IAssetLineageGraphProjectionSink";
import type { AssetLineageEdge } from "../../domain/assets/AssetLineageEdge";
import type { AssetTransformation } from "../../domain/assets/AssetTransformation";

export class InMemoryAssetLineageGraphProjectionSink implements IAssetLineageGraphProjectionSink {
  private readonly publishedTransformationsStore: AssetTransformation[] = [];
  private readonly publishedEdgesStore: AssetLineageEdge[] = [];

  public async publishTransformation(transformation: AssetTransformation): Promise<void> {
    this.publishedTransformationsStore.push(transformation);
  }

  public async publishEdge(edge: AssetLineageEdge): Promise<void> {
    this.publishedEdgesStore.push(edge);
  }

  public get publishedTransformations(): ReadonlyArray<AssetTransformation> {
    return Object.freeze([...this.publishedTransformationsStore]);
  }

  public get publishedEdges(): ReadonlyArray<AssetLineageEdge> {
    return Object.freeze([...this.publishedEdgesStore]);
  }

  public hasVersionPath(fromVersionId: string, toVersionId: string, maxDepth = 6): boolean {
    const adjacency = new Map<string, Set<string>>();
    for (const edge of this.publishedEdgesStore) {
      const next = adjacency.get(edge.fromVersionId) ?? new Set<string>();
      next.add(edge.toVersionId);
      adjacency.set(edge.fromVersionId, next);
    }

    const queue: Array<{ readonly versionId: string; readonly depth: number }> = [{ versionId: fromVersionId, depth: 0 }];
    const visited = new Set<string>([fromVersionId]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.versionId === toVersionId) {
        return true;
      }
      if (current.depth >= maxDepth) {
        continue;
      }
      for (const adjacent of adjacency.get(current.versionId) ?? []) {
        if (visited.has(adjacent)) {
          continue;
        }
        visited.add(adjacent);
        queue.push({ versionId: adjacent, depth: current.depth + 1 });
      }
    }
    return false;
  }
}
