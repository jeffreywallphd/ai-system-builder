import { AssetTransformation } from "../../domain/assets/AssetTransformation";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { IAssetLineageGraphProjectionSink } from "../ports/interfaces/IAssetLineageGraphProjectionSink";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../domain/assets/AssetLineageEdge";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";

export class RecordAssetTransformationUseCase {
  constructor(
    private readonly transformationRepository: IAssetTransformationRepository,
    private readonly lineageRepository?: IAssetLineageRepository,
    private readonly graphProjectionSink?: IAssetLineageGraphProjectionSink,
  ) {}

  public async execute(request: ConstructorParameters<typeof AssetTransformation>[0]): Promise<AssetTransformation> {
    const transformation = new AssetTransformation(request);
    await this.transformationRepository.saveTransformation(transformation);
    await this.graphProjectionSink?.publishTransformation(transformation);

    for (const inputVersionId of transformation.inputVersionIds) {
      for (const outputVersionId of transformation.outputVersionIds) {
        const edge = new AssetLineageEdge({
          edgeId: `${transformation.transformationId}:${inputVersionId}->${outputVersionId}`,
          fromVersionId: inputVersionId,
          toVersionId: outputVersionId,
          type: transformation.transformationType.includes("train")
            ? AssetLineageRelationshipType.TRAINED_FROM
            : transformation.transformationType.includes("generate")
              ? AssetLineageRelationshipType.GENERATED_FROM
              : AssetLineageRelationshipType.TRANSFORMED_FROM,
          transformationId: transformation.transformationId,
          createdAt: transformation.createdAt,
        });

        await this.lineageRepository?.saveEdge(edge);
        await this.graphProjectionSink?.publishEdge(edge);
      }
    }

    return transformation;
  }
}
