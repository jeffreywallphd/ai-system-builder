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
}
