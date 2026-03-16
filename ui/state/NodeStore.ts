import type { INodeDefinition } from "../../domain/nodes/interfaces/INodeDefinition";
import type { INodeCatalogSearchCriteria } from "../../application/ports/interfaces/INodeCatalogProvider";
import { NodeService } from "../services/NodeService";

export interface INodeStoreState {
  readonly definitions: ReadonlyArray<INodeDefinition>;
  readonly categories: ReadonlyArray<string>;
  readonly selectedDefinitionId?: string;
  readonly searchCriteria?: INodeCatalogSearchCriteria;
  readonly isLoading: boolean;
  readonly error?: string;
}

export type NodeStoreListener = (state: INodeStoreState) => void;

export interface INodeStoreOptions {
  readonly nodeService: NodeService;
  readonly initialState?: Partial<INodeStoreState>;
}

const defaultState: INodeStoreState = Object.freeze({
  definitions: Object.freeze([]),
  categories: Object.freeze([]),
  selectedDefinitionId: undefined,
  searchCriteria: undefined,
  isLoading: false,
  error: undefined,
});

export class NodeStore {
  private readonly nodeService: NodeService;
  private readonly listeners = new Set<NodeStoreListener>();
  private state: INodeStoreState;

  constructor(options: INodeStoreOptions) {
    this.nodeService = options.nodeService;
    this.state = Object.freeze({
      ...defaultState,
      ...options.initialState,
      definitions: Object.freeze([...(options.initialState?.definitions ?? [])]),
      categories: Object.freeze([...(options.initialState?.categories ?? [])]),
    });
  }

  public getState(): INodeStoreState {
    return this.state;
  }

  public subscribe(listener: NodeStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async refreshCatalog(
    criteria?: INodeCatalogSearchCriteria
  ): Promise<void> {
    this.setState({
      isLoading: true,
      error: undefined,
      searchCriteria: criteria,
    });

    try {
      const [definitions, categories] = await Promise.all([
        this.nodeService.listAvailableNodes(criteria),
        this.nodeService.getCategories(),
      ]);

      this.setState({
        definitions: Object.freeze([...definitions]),
        categories: Object.freeze([...categories]),
        isLoading: false,
      });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async selectDefinition(id: string | undefined): Promise<void> {
    const definitionId = id?.trim() || undefined;

    if (!definitionId) {
      this.setState({
        selectedDefinitionId: undefined,
      });
      return;
    }

    const definition = await this.nodeService.getDefinitionById(definitionId);

    if (!definition) {
      throw new Error(`Node definition '${definitionId}' was not found.`);
    }

    this.setState({
      selectedDefinitionId: definition.id,
      error: undefined,
    });
  }

  public clearSelection(): void {
    this.setState({
      selectedDefinitionId: undefined,
    });
  }

  public getSelectedDefinition(): INodeDefinition | undefined {
    return this.state.definitions.find(
      (definition) => definition.id === this.state.selectedDefinitionId
    );
  }

  private setState(patch: Partial<INodeStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      definitions: patch.definitions
        ? Object.freeze([...patch.definitions])
        : this.state.definitions,
      categories: patch.categories
        ? Object.freeze([...patch.categories])
        : this.state.categories,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown node store error.";
}
