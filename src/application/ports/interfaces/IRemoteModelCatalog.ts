import type { IModel } from "@domain/models/interfaces/IModel";
import type {
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "@domain/models/interfaces/IModelCompatibility";

export interface IRemoteModelCatalogSearchCriteria {
  /**
   * Free-text search over names, tags, descriptions, etc.
   */
  readonly query?: string;

  /**
   * Domain model kinds to include.
   */
  readonly kinds?: ReadonlyArray<IModel["kind"]>;

  /**
   * Optional architecture family filters.
   * Examples:
   * - llama
   * - sdxl
   * - whisper
   */
  readonly architectureFamilies?: ReadonlyArray<string>;

  /**
   * Optional task filters.
   */
  readonly tasks?: ReadonlyArray<ModelTask>;

  /**
   * Optional input modality filters.
   */
  readonly inputModalities?: ReadonlyArray<ModelModality>;

  /**
   * Optional output modality filters.
   */
  readonly outputModalities?: ReadonlyArray<ModelModality>;

  /**
   * Optional runtime filters.
   */
  readonly runtimes?: ReadonlyArray<RuntimeEngine>;

  /**
   * Whether only runnable models should be returned.
   */
  readonly runnableOnly?: boolean;

  /**
   * Whether only models that appear installable/downloadable should be returned.
   */
  readonly installableOnly?: boolean;

  /**
   * Optional provider filter.
   * Examples:
   * - huggingface
   * - civitai
   * - ollama
   */
  readonly providers?: ReadonlyArray<string>;

  /**
   * Optional tags that should be present.
   */
  readonly tags?: ReadonlyArray<string>;

  /**
   * Maximum results to return.
   */
  readonly limit?: number;

  /**
   * Cursor for paginated catalogs.
   */
  readonly cursor?: string;
}

export interface IRemoteModelCatalogItem {
  /**
   * Domain model representation for the remote catalog item.
   */
  readonly model: IModel;

  /**
   * Provider-specific identifier if available.
   */
  readonly remoteId?: string;

  /**
   * Provider/source label.
   */
  readonly provider: string;

  /**
   * Whether the model appears downloadable/installable through the system.
   */
  readonly isInstallable: boolean;

  /**
   * Optional gating/auth requirement hint.
   */
  readonly requiresAuth?: boolean;
}

export interface IRemoteModelCatalogSearchResult {
  readonly items: ReadonlyArray<IRemoteModelCatalogItem>;

  /**
   * Cursor for fetching the next page, if any.
   */
  readonly nextCursor?: string;
}

export interface IRemoteModelCatalog {
  /**
   * Searches the remote model catalog using domain-oriented criteria.
   */
  search(
    criteria?: IRemoteModelCatalogSearchCriteria
  ): Promise<IRemoteModelCatalogSearchResult>;

  /**
   * Resolves a single remote model by provider-specific identifier or catalog ID.
   */
  getById(id: string, provider?: string): Promise<IRemoteModelCatalogItem | undefined>;

  /**
   * Returns true when this catalog implementation can serve a provider/source.
   */
  supportsProvider(provider: string): boolean;
}

