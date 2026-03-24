import { AssetTransformation } from "../../domain/assets/AssetTransformation";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetLineageGraphProjectionSink } from "../ports/interfaces/IAssetLineageGraphProjectionSink";

export class RecordAssetTransformationUseCase {
  constructor(
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly graphProjectionSink?: IAssetLineageGraphProjectionSink,
  ) {}

  public async execute(request: ConstructorParameters<typeof AssetTransformation>[0]): Promise<AssetTransformation> {
    const transformation = new AssetTransformation(request);
    await this.transformationRepository.saveTransformation(transformation);
    await this.graphProjectionSink?.publishTransformation(transformation);
    return transformation;
  }
}
