import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type {
  IAssetCatalog,
  IAssetSearchCriteria,
} from "../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../ports/interfaces/IAssetTransformationRepository";
import { loadCanonicalAssetSummary, type CanonicalAssetSummary } from "./AssetLineageReadModelSupport";

export interface IListAssetsRequest {
  readonly criteria?: IAssetSearchCriteria;
}

export interface IListAssetsResult {
  readonly assets: ReadonlyArray<IAsset>;
  readonly canonicalByAssetId?: Readonly<Record<string, CanonicalAssetSummary>>;
}

export class ListAssetsUseCase {
  private readonly assetCatalog: IAssetCatalog;
  private readonly versionRepository?: IAssetVersionRepository;
  private readonly lineageRepository?: IAssetLineageRepository;
  private readonly transformationRepository?: IAssetTransformationRepository;

  constructor(
    assetCatalog: IAssetCatalog,
    repositories?: {
      versionRepository?: IAssetVersionRepository;
      lineageRepository?: IAssetLineageRepository;
      transformationRepository?: IAssetTransformationRepository;
    },
  ) {
    this.assetCatalog = assetCatalog;
    this.versionRepository = repositories?.versionRepository;
    this.lineageRepository = repositories?.lineageRepository;
    this.transformationRepository = repositories?.transformationRepository;
  }

  public async execute(request: IListAssetsRequest = {}): Promise<IListAssetsResult> {
    const assets = await this.assetCatalog.list(request.criteria);

    const canonicalByAssetId = await this.loadCanonicalByAssetId(assets);
    return Object.freeze({
      assets: Object.freeze([...assets]),
      canonicalByAssetId,
    });
  }

  private async loadCanonicalByAssetId(assets: ReadonlyArray<IAsset>): Promise<Readonly<Record<string, CanonicalAssetSummary>> | undefined> {
    if (!this.versionRepository || !this.lineageRepository || !this.transformationRepository) {
      return undefined;
    }

    const entries = await Promise.all(assets.map(async (asset) => [
      asset.id,
      await loadCanonicalAssetSummary(asset.id, {
        versionRepository: this.versionRepository!,
        lineageRepository: this.lineageRepository!,
        transformationRepository: this.transformationRepository!,
      }),
    ] as const));

    return Object.freeze(Object.fromEntries(entries.filter((entry): entry is readonly [string, CanonicalAssetSummary] => !!entry[1])));
  }
}
