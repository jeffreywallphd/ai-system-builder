import type { IAssetLineageGraphProjectionSink } from "../ports/interfaces/IAssetLineageGraphProjectionSink";
import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";

export class ReplayAssetGraphProjectionUseCase {
  constructor(
    private readonly queryRepository: IAssetSystemQueryRepository,
    private readonly graphProjectionSink: IAssetLineageGraphProjectionSink,
  ) {}

  public async execute(params: { readonly assetIds: ReadonlyArray<string> }): Promise<{
    readonly assetIds: ReadonlyArray<string>;
    readonly publishedTransformationCount: number;
    readonly publishedEdgeCount: number;
  }> {
    const directAssetIds = params.assetIds.map((assetId) => assetId.trim()).filter(Boolean);
    const identityAssetIds = (await this.queryRepository.listCanonicalIdentities())
      .map((entry) => entry.assetId);
    const normalizedAssetIds = [...new Set([...directAssetIds, ...identityAssetIds])];
    let publishedTransformationCount = 0;
    let publishedEdgeCount = 0;

    for (const assetId of normalizedAssetIds) {
      const [transformations, edges] = await Promise.all([
        this.queryRepository.listTransformationsByAssetId(assetId),
        this.queryRepository.listLineageEdgesByAssetId(assetId),
      ]);

      for (const transformation of transformations) {
        await this.graphProjectionSink.publishTransformation(transformation);
        publishedTransformationCount += 1;
      }

      for (const edge of edges) {
        await this.graphProjectionSink.publishEdge(edge);
        publishedEdgeCount += 1;
      }
    }

    return Object.freeze({
      assetIds: Object.freeze(normalizedAssetIds),
      publishedTransformationCount,
      publishedEdgeCount,
    });
  }
}
