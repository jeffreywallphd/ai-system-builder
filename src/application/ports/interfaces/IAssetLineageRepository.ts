import type { AssetLineageEdge } from "../../../domain/assets/AssetLineageEdge";

export type AssetLineageDirection = "upstream" | "downstream" | "both";

export interface IAssetLineageRepository {
  saveEdge(edge: AssetLineageEdge): Promise<void>;
  listEdgesByVersionId(
    versionId: string,
    direction?: AssetLineageDirection,
  ): Promise<ReadonlyArray<AssetLineageEdge>>;
}
