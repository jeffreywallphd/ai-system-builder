import { AssetVersion } from "../../domain/assets/AssetVersion";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";

export class CreateAssetVersionUseCase {
  constructor(private readonly versionRepository: IAssetVersionRepository) {}

  public async execute(request: ConstructorParameters<typeof AssetVersion>[0]): Promise<AssetVersion> {
    const version = new AssetVersion(request);
    await this.versionRepository.saveVersion(version);
    return version;
  }
}
