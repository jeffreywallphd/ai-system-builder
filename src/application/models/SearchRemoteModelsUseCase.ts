import type {
  IRemoteModelCatalog,
  IRemoteModelCatalogItem,
  IRemoteModelCatalogSearchCriteria,
} from "../ports/interfaces/IRemoteModelCatalog";

export interface ISearchRemoteModelsRequest {
  readonly criteria?: IRemoteModelCatalogSearchCriteria;
}

export interface ISearchRemoteModelsResult {
  readonly items: ReadonlyArray<IRemoteModelCatalogItem>;
  readonly nextCursor?: string;
}

export class SearchRemoteModelsUseCase {
  private readonly remoteModelCatalog: IRemoteModelCatalog;

  constructor(remoteModelCatalog: IRemoteModelCatalog) {
    this.remoteModelCatalog = remoteModelCatalog;
  }

  public async execute(
    request: ISearchRemoteModelsRequest = {}
  ): Promise<ISearchRemoteModelsResult> {
    const result = await this.remoteModelCatalog.search(request.criteria);

    return Object.freeze({
      items: Object.freeze([...result.items]),
      nextCursor: result.nextCursor,
    });
  }
}
