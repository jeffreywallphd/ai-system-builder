import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import { AssetVersion } from "@domain/assets/AssetVersion";

export class GetAssetVersionHistoryUseCase {
  constructor(private readonly versionRepository: IAssetVersionRepository) {}

  public async execute(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      throw new Error("GetAssetVersionHistoryUseCase requires a non-empty assetId.");
    }

    const versions = await this.versionRepository.listVersionsByAssetId(normalizedAssetId);
    return Object.freeze([...versions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()));
  }
}

