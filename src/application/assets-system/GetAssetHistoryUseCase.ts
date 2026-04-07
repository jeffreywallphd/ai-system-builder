import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";

export class GetAssetHistoryUseCase {
  constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    private readonly lineageRepository: IAssetLineageRepository,
    private readonly transformationRepository: IAssetTransformationRepository,
  ) {}

  public async execute(assetId: string): Promise<{
    readonly assetId: string;
    readonly assetName?: string;
    readonly versions: ReadonlyArray<{
      readonly versionId: string;
      readonly versionLabel?: string;
      readonly parentVersionId?: string;
      readonly createdAt: string;
      readonly transformationCount: number;
      readonly lineageEdgeCount: number;
      readonly upstreamVersionIds: ReadonlyArray<string>;
      readonly downstreamVersionIds: ReadonlyArray<string>;
    }>;
  }> {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      throw new Error("GetAssetHistoryUseCase requires a non-empty assetId.");
    }

    const [asset, versions] = await Promise.all([
      this.assetRepository.getById(normalizedAssetId),
      this.versionRepository.listVersionsByAssetId(normalizedAssetId),
    ]);

    const versionSummaries = await Promise.all(versions.map(async (version) => {
      const [edges, transformations] = await Promise.all([
        this.lineageRepository.listEdgesByVersionId(version.versionId, "both"),
        this.transformationRepository.listByVersionId(version.versionId),
      ]);

      return Object.freeze({
        versionId: version.versionId,
        versionLabel: version.versionLabel,
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt.toISOString(),
        transformationCount: transformations.length,
        lineageEdgeCount: edges.length,
        upstreamVersionIds: Object.freeze(edges.filter((edge) => edge.toVersionId === version.versionId).map((edge) => edge.fromVersionId)),
        downstreamVersionIds: Object.freeze(edges.filter((edge) => edge.fromVersionId === version.versionId).map((edge) => edge.toVersionId)),
      });
    }));

    return Object.freeze({
      assetId: normalizedAssetId,
      assetName: asset?.name,
      versions: Object.freeze(versionSummaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt))),
    });
  }
}
