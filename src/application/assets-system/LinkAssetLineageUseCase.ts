import { AssetLineageEdge } from "../../domain/assets/AssetLineageEdge";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetLineageGraphProjectionSink } from "../ports/interfaces/IAssetLineageGraphProjectionSink";

export class LinkAssetLineageUseCase {
  constructor(
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly graphProjectionSink?: IAssetLineageGraphProjectionSink,
  ) {}

  public async execute(request: ConstructorParameters<typeof AssetLineageEdge>[0]): Promise<AssetLineageEdge> {
    const edge = new AssetLineageEdge(request);
    await this.lineageRepository.saveEdge(edge);
    await this.graphProjectionSink?.publishEdge(edge);
    return edge;
  }
}
