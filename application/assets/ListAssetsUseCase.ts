import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type {
  IAssetCatalog,
  IAssetSearchCriteria,
} from "../ports/interfaces/IAssetCatalog";

export interface IListAssetsRequest {
  readonly criteria?: IAssetSearchCriteria;
}

export interface IListAssetsResult {
  readonly assets: ReadonlyArray<IAsset>;
}

export class ListAssetsUseCase {
  private readonly assetCatalog: IAssetCatalog;

  constructor(assetCatalog: IAssetCatalog) {
    this.assetCatalog = assetCatalog;
  }

  public async execute(request: IListAssetsRequest = {}): Promise<IListAssetsResult> {
    const assets = await this.assetCatalog.list(request.criteria);

    return Object.freeze({
      assets: Object.freeze([...assets]),
    });
  }
}
