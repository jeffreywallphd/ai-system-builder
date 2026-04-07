import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type { ModelModality, ModelTask, RuntimeEngine } from "@domain/models/interfaces/IModelCompatibility";

export interface INodeCatalogSearchCriteria {
  /**
   * Free-text search over title, type, category, description, etc.
   */
  readonly query?: string;

  /**
   * Filter by node category.
   */
  readonly categories?: ReadonlyArray<string>;

  /**
   * Filter by node execution kind.
   */
  readonly executionKinds?: ReadonlyArray<INodeDefinition["executionKind"]>;

  /**
   * Filter by tasks supported by the node definition.
   */
  readonly tasks?: ReadonlyArray<ModelTask>;

  /**
   * Filter by runtime support.
   */
  readonly runtimes?: ReadonlyArray<RuntimeEngine>;

  /**
   * Filter by modality relevance.
   */
  readonly modalities?: ReadonlyArray<ModelModality>;

  /**
   * Whether only nodes visible in simplified/basic mode should be returned.
   */
  readonly basicModeOnly?: boolean;

  /**
   * Whether only model-aware nodes should be returned.
   */
  readonly modelAwareOnly?: boolean;
}

export interface INodeCatalogProvider {
  /**
   * Returns all available node definitions known to this provider.
   */
  getAllDefinitions(): Promise<ReadonlyArray<INodeDefinition>>;

  /**
   * Searches/filter node definitions.
   */
  searchDefinitions(
    criteria?: INodeCatalogSearchCriteria
  ): Promise<ReadonlyArray<INodeDefinition>>;

  /**
   * Returns a single node definition by stable ID or type key.
   */
  getDefinitionById(id: string): Promise<INodeDefinition | undefined>;

  /**
   * Returns a single node definition by internal type key.
   */
  getDefinitionByType(type: string): Promise<INodeDefinition | undefined>;

  /**
   * Returns all available categories from the current catalog.
   */
  getCategories(): Promise<ReadonlyArray<string>>;
}

