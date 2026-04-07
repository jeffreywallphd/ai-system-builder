import type { AssetLineageEdge } from "@domain/assets/AssetLineageEdge";
import type { AssetTransformation } from "@domain/assets/AssetTransformation";

export interface IAssetLineageGraphProjectionSink {
  publishTransformation(transformation: AssetTransformation): Promise<void>;
  publishEdge(edge: AssetLineageEdge): Promise<void>;
}

