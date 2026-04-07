import type { IAssetCatalog, IAssetSearchCriteria } from "@application/ports/interfaces/IAssetCatalog";
import type { IAsset } from "@domain/assets/interfaces/IAsset";
import { SqliteAssetSystemRepository } from "../SqliteAssetSystemRepository";

export class SqliteAssetSystemAgentMemoryCatalog implements IAssetCatalog {
  constructor(private readonly repository: SqliteAssetSystemRepository) {}

  public async list(criteria?: IAssetSearchCriteria): Promise<ReadonlyArray<IAsset>> {
    return this.repository.listAssetsByCriteria({
      kinds: criteria?.kinds,
      sourceTypes: criteria?.sourceTypes,
      limit: criteria?.limit,
    });
  }

  public async getById(id: string): Promise<IAsset | undefined> {
    return this.repository.getById(id);
  }

  public async save(asset: IAsset): Promise<void> {
    await this.repository.save(asset);
  }

  public async remove(_id: string): Promise<boolean> {
    return false;
  }

  public async exists(id: string): Promise<boolean> {
    return this.repository.exists(id);
  }
}

