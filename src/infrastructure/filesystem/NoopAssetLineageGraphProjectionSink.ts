import type { IAssetLineageGraphProjectionSink } from "@application/ports/interfaces/IAssetLineageGraphProjectionSink";
import type { AssetTransformation } from "@domain/assets/AssetTransformation";
import type { AssetLineageEdge } from "@domain/assets/AssetLineageEdge";

export class NoopAssetLineageGraphProjectionSink implements IAssetLineageGraphProjectionSink {
  public async publishTransformation(_transformation: AssetTransformation): Promise<void> {
    return;
  }

  public async publishEdge(_edge: AssetLineageEdge): Promise<void> {
    return;
  }
}

