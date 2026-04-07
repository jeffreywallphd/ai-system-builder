import type { IAssetLineageGraphProjectionSink } from "../../application/ports/interfaces/IAssetLineageGraphProjectionSink";
import type { AssetTransformation } from "../../src/domain/assets/AssetTransformation";
import type { AssetLineageEdge } from "../../src/domain/assets/AssetLineageEdge";

export class NoopAssetLineageGraphProjectionSink implements IAssetLineageGraphProjectionSink {
  public async publishTransformation(_transformation: AssetTransformation): Promise<void> {
    return;
  }

  public async publishEdge(_edge: AssetLineageEdge): Promise<void> {
    return;
  }
}
