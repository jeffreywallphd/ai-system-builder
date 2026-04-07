import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import type { AssetTransformation } from "../../domain/assets/AssetTransformation";

interface AssetTransformationHistoryRepository extends IAssetTransformationRepository {
  listTransformationsByAssetId?(assetId: string): Promise<ReadonlyArray<AssetTransformation>>;
}

export interface AssetTransformationHistoryReadModel {
  readonly transformationId: string;
  readonly transformationType: string;
  readonly status: string;
  readonly executionId?: string;
  readonly provider?: string;
  readonly runtime?: string;
  readonly inputVersionIds: ReadonlyArray<string>;
  readonly outputVersionIds: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class GetAssetTransformationHistoryUseCase {
  constructor(
    private readonly versionRepository: IAssetVersionRepository,
    private readonly transformationRepository: AssetTransformationHistoryRepository,
  ) {}

  public async execute(assetId: string): Promise<ReadonlyArray<AssetTransformationHistoryReadModel>> {
    const normalizedId = assetId.trim();
    if (!normalizedId) {
      throw new Error("GetAssetTransformationHistoryUseCase requires a non-empty assetId.");
    }

    const transformations = this.transformationRepository.listTransformationsByAssetId
      ? await this.transformationRepository.listTransformationsByAssetId(normalizedId)
      : await this.loadByAssetVersions(normalizedId);

    return Object.freeze(
      [...transformations]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((transformation) => Object.freeze({
          transformationId: transformation.transformationId,
          transformationType: transformation.transformationType,
          status: transformation.status,
          executionId: transformation.executionId,
          provider: transformation.provider,
          runtime: transformation.runtime,
          inputVersionIds: Object.freeze([...transformation.inputVersionIds]),
          outputVersionIds: Object.freeze([...transformation.outputVersionIds]),
          createdAt: transformation.createdAt.toISOString(),
          completedAt: transformation.completedAt?.toISOString(),
          metadata: transformation.metadata,
        })),
    );
  }

  private async loadByAssetVersions(assetId: string): Promise<ReadonlyArray<AssetTransformation>> {
    const versions = await this.versionRepository.listVersionsByAssetId(assetId);
    const byId = new Map<string, AssetTransformation>();
    for (const version of versions) {
      const transformations = await this.transformationRepository.listByVersionId(version.versionId);
      for (const transformation of transformations) {
        byId.set(transformation.transformationId, transformation);
      }
    }
    return Object.freeze([...byId.values()]);
  }
}
