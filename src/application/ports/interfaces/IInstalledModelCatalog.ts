import type { IModel } from "@domain/models/interfaces/IModel";
import type {
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "@domain/models/interfaces/IModelCompatibility";

export interface IInstalledModelSearchCriteria {
  readonly query?: string;
  readonly ids?: ReadonlyArray<string>;
  readonly kinds?: ReadonlyArray<IModel["kind"]>;
  readonly architectureFamilies?: ReadonlyArray<string>;
  readonly tasks?: ReadonlyArray<ModelTask>;
  readonly inputModalities?: ReadonlyArray<ModelModality>;
  readonly outputModalities?: ReadonlyArray<ModelModality>;
  readonly runtimes?: ReadonlyArray<RuntimeEngine>;
  readonly runnableOnly?: boolean;
  readonly availableOnly?: boolean;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface IInstalledModelCatalog {
  /**
   * Lists installed models using optional domain-oriented search criteria.
   */
  listInstalled(
    criteria?: IInstalledModelSearchCriteria
  ): Promise<ReadonlyArray<IModel>>;

  /**
   * Returns one installed model by stable ID.
   */
  getInstalledById(id: string): Promise<IModel | undefined>;

  /**
   * Saves or updates an installed model record.
   */
  saveInstalled(model: IModel): Promise<void>;

  /**
   * Removes an installed model record by stable ID.
   * Returns true when a record was removed.
   */
  removeInstalled(id: string): Promise<boolean>;

  /**
   * Returns true when the model is known to be installed.
   */
  isInstalled(id: string): Promise<boolean>;
}

