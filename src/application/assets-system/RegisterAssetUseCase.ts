import { Asset } from "../../domain/assets/Asset";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";

export class RegisterAssetUseCase {
  constructor(private readonly assetRepository: IAssetRecordRepository) {}

  public async execute(request: { readonly asset: IAsset }): Promise<{ readonly asset: IAsset; readonly created: boolean }> {
    const asset = Asset.from(request.asset);
    const existing = await this.assetRepository.getById(asset.id);
    await this.assetRepository.save(asset);

    return Object.freeze({
      asset,
      created: !existing,
    });
  }
}
