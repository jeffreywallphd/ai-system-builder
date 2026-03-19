import type { ICreateContextPackageRequest } from "../../application/context/CreateContextPackageUseCase";
import type { IUpdateContextPackageRequest } from "../../application/context/UpdateContextPackageUseCase";
import { ContextPackage } from "../../application/context/models/ContextPackage";
import type { IContextPackageSummary } from "../../application/ports/interfaces/IContextPackageRepository";
import { ContextService } from "../services/ContextService";

export interface ContextStoreState {
  readonly packages: ReadonlyArray<IContextPackageSummary>;
  readonly selectedPackageId?: string;
  readonly selectedPackage?: ContextPackage;
  readonly searchQuery: string;
  readonly searchTags: ReadonlyArray<string>;
  readonly isLoadingList: boolean;
  readonly isLoadingSelected: boolean;
  readonly isMutating: boolean;
  readonly error?: string;
}

export type ContextStoreListener = (state: ContextStoreState) => void;

const defaultState: ContextStoreState = Object.freeze({
  packages: Object.freeze([]),
  selectedPackageId: undefined,
  selectedPackage: undefined,
  searchQuery: "",
  searchTags: Object.freeze([]),
  isLoadingList: false,
  isLoadingSelected: false,
  isMutating: false,
  error: undefined,
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected context library error.";
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(tags ?? [])].map((tag) => tag.trim()).filter(Boolean));
}

export class ContextStore {
  private state: ContextStoreState = defaultState;
  private readonly listeners = new Set<ContextStoreListener>();

  constructor(private readonly contextService: ContextService) {}

  public getState(): ContextStoreState {
    return this.state;
  }

  public subscribe(listener: ContextStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async initialize(): Promise<void> {
    await this.refreshPackages();
  }

  public async refreshPackages(): Promise<void> {
    this.patch({ isLoadingList: true, error: undefined });

    try {
      const result = this.hasActiveSearch()
        ? await this.contextService.searchContextPackages({
            query: this.state.searchQuery || undefined,
            tags: this.state.searchTags,
          })
        : await this.contextService.listContextPackages();

      const packages = Object.freeze([...result.contextPackages]);
      const selectedPackageId = this.resolveSelectedPackageId(packages);

      this.patch({
        packages,
        selectedPackageId,
        isLoadingList: false,
      });

      if (selectedPackageId) {
        await this.selectPackage(selectedPackageId);
      } else {
        this.patch({ selectedPackage: undefined });
      }
    } catch (error) {
      this.patch({ isLoadingList: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async search(params: { query?: string; tags?: ReadonlyArray<string> } = {}): Promise<void> {
    this.patch({
      searchQuery: params.query?.trim() ?? this.state.searchQuery,
      searchTags: normalizeTags(params.tags ?? this.state.searchTags),
      error: undefined,
    });

    await this.refreshPackages();
  }

  public async clearSearch(): Promise<void> {
    this.patch({ searchQuery: "", searchTags: Object.freeze([]), error: undefined });
    await this.refreshPackages();
  }

  public async selectPackage(contextPackageId: string | undefined): Promise<void> {
    const selectedPackageId = contextPackageId?.trim() || undefined;

    this.patch({ selectedPackageId, isLoadingSelected: Boolean(selectedPackageId), error: undefined });

    if (!selectedPackageId) {
      this.patch({ selectedPackage: undefined, isLoadingSelected: false });
      return;
    }

    try {
      const result = await this.contextService.loadContextPackage(selectedPackageId);
      this.patch({
        selectedPackage: result.contextPackage,
        selectedPackageId: result.contextPackage?.id,
        isLoadingSelected: false,
      });
    } catch (error) {
      this.patch({ isLoadingSelected: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async createPackage(request: ICreateContextPackageRequest): Promise<ContextPackage> {
    this.patch({ isMutating: true, error: undefined });

    try {
      const result = await this.contextService.createContextPackage(request);
      await this.refreshPackages();
      await this.selectPackage(result.contextPackage.id);
      this.patch({ isMutating: false });
      return result.contextPackage;
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async updatePackage(request: IUpdateContextPackageRequest): Promise<ContextPackage> {
    this.patch({ isMutating: true, error: undefined });

    try {
      const result = await this.contextService.updateContextPackage(request);
      await this.refreshPackages();
      await this.selectPackage(result.contextPackage.id);
      this.patch({ isMutating: false });
      return result.contextPackage;
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async deletePackage(contextPackageId: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });

    try {
      const result = await this.contextService.deleteContextPackage(contextPackageId);
      if (!result.deleted) {
        this.patch({ isMutating: false });
        return;
      }

      const deletedId = contextPackageId.trim();
      this.patch({
        selectedPackageId: this.state.selectedPackageId === deletedId ? undefined : this.state.selectedPackageId,
        selectedPackage: this.state.selectedPackageId === deletedId ? undefined : this.state.selectedPackage,
      });
      await this.refreshPackages();
      this.patch({ isMutating: false });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  private hasActiveSearch(): boolean {
    return Boolean(this.state.searchQuery.trim()) || this.state.searchTags.length > 0;
  }

  private resolveSelectedPackageId(packages: ReadonlyArray<IContextPackageSummary>): string | undefined {
    const currentSelection = this.state.selectedPackageId;

    if (currentSelection && packages.some((contextPackage) => contextPackage.id === currentSelection)) {
      return currentSelection;
    }

    return packages[0]?.id;
  }

  private patch(patch: Partial<ContextStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      packages: patch.packages ?? this.state.packages,
      searchTags: patch.searchTags ?? this.state.searchTags,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
