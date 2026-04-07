import type { INodeDefinition } from "../../../domain/nodes/interfaces/INodeDefinition";
import type { INodeCatalogProvider } from "../ports/interfaces/INodeCatalogProvider";
import type { INodeCatalogSearchCriteria } from "../ports/interfaces/INodeCatalogProvider";

export interface IListAvailableNodesRequest {
  readonly criteria?: INodeCatalogSearchCriteria;
}

export interface IListAvailableNodesResult {
  readonly definitions: ReadonlyArray<INodeDefinition>;
}

export class ListAvailableNodesUseCase {
  private readonly nodeCatalogProvider: INodeCatalogProvider;

  constructor(nodeCatalogProvider: INodeCatalogProvider) {
    this.nodeCatalogProvider = nodeCatalogProvider;
  }

  public async execute(
    request: IListAvailableNodesRequest = {}
  ): Promise<IListAvailableNodesResult> {
    const definitions = await this.nodeCatalogProvider.searchDefinitions(
      request.criteria
    );

    return Object.freeze({
      definitions: Object.freeze([...definitions]),
    });
  }
}
