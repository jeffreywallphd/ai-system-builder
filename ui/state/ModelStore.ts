import type { IModel } from "../../domain/models/interfaces/IModel";
import type { ManagedModelLibrarySnapshot } from "../../application/models/ManagedModelLibrary";
import type { IInstalledModelSearchCriteria } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type {
  IRemoteModelCatalogItem,
  IRemoteModelCatalogSearchCriteria,
} from "../../application/ports/interfaces/IRemoteModelCatalog";
import type { IModelInstallProgress } from "../../application/ports/interfaces/IModelInstaller";
import { ModelService } from "../services/ModelService";

export interface IModelStoreState {
  readonly installedModels: ReadonlyArray<IModel>;
  readonly remoteModels: ReadonlyArray<IRemoteModelCatalogItem>;
  readonly selectedInstalledModelId?: string;
  readonly selectedRemoteModelId?: string;
  readonly installedSearchCriteria?: IInstalledModelSearchCriteria;
  readonly remoteSearchCriteria?: IRemoteModelCatalogSearchCriteria;
  readonly installProgressByModelId: Readonly<Record<string, IModelInstallProgress>>;
  readonly managedLibrary?: ManagedModelLibrarySnapshot;
  readonly isLoadingInstalled: boolean;
  readonly isSearchingRemote: boolean;
  readonly isInstalling: boolean;
  readonly isRemoving: boolean;
  readonly error?: string;
}

export type ModelStoreListener = (state: IModelStoreState) => void;

export interface IModelStoreOptions {
  readonly modelService: ModelService;
  readonly initialState?: Partial<IModelStoreState>;
}

const defaultState: IModelStoreState = Object.freeze({
  installedModels: Object.freeze([]),
  remoteModels: Object.freeze([]),
  selectedInstalledModelId: undefined,
  selectedRemoteModelId: undefined,
  installedSearchCriteria: undefined,
  remoteSearchCriteria: undefined,
  installProgressByModelId: Object.freeze({}),
  managedLibrary: undefined,
  isLoadingInstalled: false,
  isSearchingRemote: false,
  isInstalling: false,
  isRemoving: false,
  error: undefined,
});

export class ModelStore {
  private readonly modelService: ModelService;
  private readonly listeners = new Set<ModelStoreListener>();
  private state: IModelStoreState;

  constructor(options: IModelStoreOptions) {
    this.modelService = options.modelService;
    this.state = Object.freeze({
      ...defaultState,
      ...options.initialState,
      installedModels: Object.freeze([
        ...(options.initialState?.installedModels ?? []),
      ]),
      remoteModels: Object.freeze([...(options.initialState?.remoteModels ?? [])]),
      installProgressByModelId: Object.freeze({
        ...(options.initialState?.installProgressByModelId ?? {}),
      }),
      managedLibrary: options.initialState?.managedLibrary,
    });
  }

  public getState(): IModelStoreState {
    return this.state;
  }

  public subscribe(listener: ModelStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async refreshInstalled(
    criteria?: IInstalledModelSearchCriteria
  ): Promise<void> {
    this.setState({
      isLoadingInstalled: true,
      installedSearchCriteria: criteria,
      error: undefined,
    });

    try {
      const [installedModels, managedLibrary] = await Promise.all([
        this.modelService.listInstalledModels(criteria),
        this.modelService.inspectManagedLibrary(),
      ]);

      this.setState({
        installedModels: Object.freeze([...installedModels]),
        managedLibrary,
        isLoadingInstalled: false,
      });
    } catch (error: unknown) {
      this.setState({
        isLoadingInstalled: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async searchRemote(
    criteria?: IRemoteModelCatalogSearchCriteria
  ): Promise<void> {
    this.setState({
      isSearchingRemote: true,
      remoteSearchCriteria: criteria,
      error: undefined,
    });

    try {
      const result = await this.modelService.searchRemoteModels(criteria);

      this.setState({
        remoteModels: Object.freeze([...result.items]),
        isSearchingRemote: false,
      });
    } catch (error: unknown) {
      this.setState({
        isSearchingRemote: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async installModel(
    request: {
      readonly model?: IModel;
      readonly modelId?: string;
      readonly remoteId?: string;
      readonly provider?: string;
      readonly destination: string;
      readonly overwrite?: boolean;
      readonly verifyIntegrity?: boolean;
      readonly authToken?: string;
      readonly registerInstalled?: boolean;
    }
  ): Promise<void> {
    this.setState({
      isInstalling: true,
      error: undefined,
    });

    const progressModelId = request.modelId ?? request.remoteId ?? "unknown";

    try {
      await this.modelService.installModel(request, (progress) => {
        const progressIds = [
          progress.modelId,
          request.modelId,
          request.remoteId,
        ].filter((value): value is string => !!value?.trim());
        const nextProgress = { ...this.state.installProgressByModelId };

        for (const progressId of progressIds) {
          nextProgress[progressId] = progress;
        }

        this.setState({
          installProgressByModelId: Object.freeze({
            ...nextProgress,
            [progress.modelId || progressModelId]: progress,
          }),
        });
      });

      await this.refreshInstalled(this.state.installedSearchCriteria);

      this.setState({
        isInstalling: false,
      });
    } catch (error: unknown) {
      this.setState({
        isInstalling: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async removeModel(request: {
    readonly modelId?: string;
    readonly removeArtifacts?: boolean;
    readonly unregisterOnly?: boolean;
  }): Promise<void> {
    this.setState({
      isRemoving: true,
      error: undefined,
    });

    try {
      await this.modelService.removeModel(request);
      await this.refreshInstalled(this.state.installedSearchCriteria);

      this.setState({
        isRemoving: false,
      });
    } catch (error: unknown) {
      this.setState({
        isRemoving: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public selectInstalledModel(id: string | undefined): void {
    this.setState({
      selectedInstalledModelId: id?.trim() || undefined,
    });
  }

  public selectRemoteModel(id: string | undefined): void {
    this.setState({
      selectedRemoteModelId: id?.trim() || undefined,
    });
  }

  public getSelectedInstalledModel(): IModel | undefined {
    return this.state.installedModels.find(
      (model) => model.id === this.state.selectedInstalledModelId
    );
  }

  public getSelectedRemoteModel(): IRemoteModelCatalogItem | undefined {
    return this.state.remoteModels.find(
      (item) =>
        item.remoteId === this.state.selectedRemoteModelId ||
        item.model.id === this.state.selectedRemoteModelId
    );
  }

  private setState(patch: Partial<IModelStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      installedModels: patch.installedModels
        ? Object.freeze([...patch.installedModels])
        : this.state.installedModels,
      remoteModels: patch.remoteModels
        ? Object.freeze([...patch.remoteModels])
        : this.state.remoteModels,
      installProgressByModelId: patch.installProgressByModelId
        ? Object.freeze({ ...patch.installProgressByModelId })
        : this.state.installProgressByModelId,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown model store error.";
}
