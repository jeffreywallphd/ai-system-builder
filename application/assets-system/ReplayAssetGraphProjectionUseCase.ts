import type { IAssetLineageGraphProjectionSink } from "../ports/interfaces/IAssetLineageGraphProjectionSink";
import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";

export class ReplayAssetGraphProjectionUseCase {
  constructor(
    private readonly queryRepository: IAssetSystemQueryRepository,
    private readonly graphProjectionSink: IAssetLineageGraphProjectionSink,
  ) {}

  public async execute(params: {
    readonly assetIds: ReadonlyArray<string>;
    readonly versionIds?: ReadonlyArray<string>;
    readonly transformationIds?: ReadonlyArray<string>;
    readonly includeIdentityAssets?: boolean;
  }): Promise<{
    readonly assetIds: ReadonlyArray<string>;
    readonly versionIds: ReadonlyArray<string>;
    readonly transformationIds: ReadonlyArray<string>;
    readonly publishedTransformationCount: number;
    readonly publishedEdgeCount: number;
  }> {
    const directAssetIds = params.assetIds.map((assetId) => assetId.trim()).filter(Boolean);
    const versionScope = (params as { readonly versionIds?: ReadonlyArray<string> }).versionIds?.map((entry) => entry.trim()).filter(Boolean) ?? [];
    const transformationScope = (params as { readonly transformationIds?: ReadonlyArray<string> }).transformationIds?.map((entry) => entry.trim()).filter(Boolean) ?? [];
    const includeIdentityAssets = (params as { readonly includeIdentityAssets?: boolean }).includeIdentityAssets ?? true;
    const identityAssetIds = includeIdentityAssets
      ? (await this.queryRepository.listCanonicalIdentities()).map((entry) => entry.assetId)
      : [];
    const normalizedAssetIds = [...new Set([...directAssetIds, ...identityAssetIds])];
    let publishedTransformationCount = 0;
    let publishedEdgeCount = 0;
    const publishedVersionIds = new Set<string>();
    const publishedTransformationIds = new Set<string>();
    const versionScopeSet = versionScope.length > 0 ? new Set(versionScope) : undefined;
    const transformationScopeSet = transformationScope.length > 0 ? new Set(transformationScope) : undefined;

    for (const assetId of normalizedAssetIds) {
      let [transformations, edges] = await Promise.all([
        this.queryRepository.listTransformationsByAssetId(assetId),
        this.queryRepository.listLineageEdgesByAssetId(assetId),
      ]);
      if (transformationScopeSet) {
        transformations = transformations.filter((entry) => transformationScopeSet.has(entry.transformationId));
      }
      if (versionScopeSet) {
        transformations = transformations.filter((entry) =>
          entry.inputVersionIds.some((id) => versionScopeSet.has(id)) || entry.outputVersionIds.some((id) => versionScopeSet.has(id)));
        edges = edges.filter((edge) => versionScopeSet.has(edge.fromVersionId) || versionScopeSet.has(edge.toVersionId));
      }

      for (const transformation of transformations) {
        await this.graphProjectionSink.publishTransformation(transformation);
        publishedTransformationIds.add(transformation.transformationId);
        transformation.inputVersionIds.forEach((versionId) => publishedVersionIds.add(versionId));
        transformation.outputVersionIds.forEach((versionId) => publishedVersionIds.add(versionId));
        publishedTransformationCount += 1;
      }

      for (const edge of edges) {
        await this.graphProjectionSink.publishEdge(edge);
        publishedVersionIds.add(edge.fromVersionId);
        publishedVersionIds.add(edge.toVersionId);
        publishedEdgeCount += 1;
      }
    }

    return Object.freeze({
      assetIds: Object.freeze(normalizedAssetIds),
      versionIds: Object.freeze([...publishedVersionIds]),
      transformationIds: Object.freeze([...publishedTransformationIds]),
      publishedTransformationCount,
      publishedEdgeCount,
    });
  }
}
