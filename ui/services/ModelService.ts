import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../../application/ports/interfaces/IInstalledModelCatalog";
import type {
  IRemoteModelCatalogItem,
  IRemoteModelCatalogSearchCriteria,
} from "../../application/ports/interfaces/IRemoteModelCatalog";
import type {
  IModelCompatibilityContext,
  IModelCompatibilityResult,
} from "../../domain/services/interfaces/IModelCompatibilityService";
import {
  InstallModelUseCase,
  type IInstallModelRequest,
  type IInstallModelResult,
} from "../../application/models/InstallModelUseCase";
import {
  ListInstalledModelsUseCase,
  type IListInstalledModelsRequest,
  type IListInstalledModelsResult,
} from "../../application/models/ListInstalledModelsUseCase";
import {
  RemoveModelUseCase,
  type IRemoveModelRequest,
  type IRemoveModelResult,
} from "../../application/models/RemoveModelUseCase";
import {
  ResolveModelCompatibilityUseCase,
  type IResolveModelCompatibilityRequest,
  type IResolveModelCompatibilityResult,
} from "../../application/models/ResolveModelCompatibilityUseCase";
import {
  SearchRemoteModelsUseCase,
  type ISearchRemoteModelsRequest,
  type ISearchRemoteModelsResult,
} from "../../application/models/SearchRemoteModelsUseCase";
import type { IModelInstallProgress } from "../../application/ports/interfaces/IModelInstaller";

export interface IModelServiceOptions {
  readonly installModelUseCase: InstallModelUseCase;
  readonly listInstalledModelsUseCase: ListInstalledModelsUseCase;
  readonly removeModelUseCase: RemoveModelUseCase;
  readonly resolveModelCompatibilityUseCase: ResolveModelCompatibilityUseCase;
  readonly searchRemoteModelsUseCase: SearchRemoteModelsUseCase;
  readonly installedModelCatalog: IInstalledModelCatalog;
}

export class ModelService {
  private readonly installModelUseCase: InstallModelUseCase;
  private readonly listInstalledModelsUseCase: ListInstalledModelsUseCase;
  private readonly removeModelUseCase: RemoveModelUseCase;
  private readonly resolveModelCompatibilityUseCase: ResolveModelCompatibilityUseCase;
  private readonly searchRemoteModelsUseCase: SearchRemoteModelsUseCase;
  private readonly installedModelCatalog: IInstalledModelCatalog;

  constructor(options: IModelServiceOptions) {
    this.installModelUseCase = options.installModelUseCase;
    this.listInstalledModelsUseCase = options.listInstalledModelsUseCase;
    this.removeModelUseCase = options.removeModelUseCase;
    this.resolveModelCompatibilityUseCase = options.resolveModelCompatibilityUseCase;
    this.searchRemoteModelsUseCase = options.searchRemoteModelsUseCase;
    this.installedModelCatalog = options.installedModelCatalog;
  }

  public async listInstalledModels(
    criteria?: IInstalledModelSearchCriteria
  ): Promise<ReadonlyArray<IModel>> {
    const request: IListInstalledModelsRequest = { criteria };
    const result: IListInstalledModelsResult =
      await this.listInstalledModelsUseCase.execute(request);

    return result.models;
  }

  public async getInstalledModelById(id: string): Promise<IModel | undefined> {
    const modelId = id.trim();

    if (!modelId) {
      throw new Error("ModelService.getInstalledModelById requires a non-empty id.");
    }

    return this.installedModelCatalog.getInstalledById(modelId);
  }

  public async isInstalled(id: string): Promise<boolean> {
    const modelId = id.trim();

    if (!modelId) {
      throw new Error("ModelService.isInstalled requires a non-empty id.");
    }

    return this.installedModelCatalog.isInstalled(modelId);
  }

  public async searchRemoteModels(
    criteria?: IRemoteModelCatalogSearchCriteria
  ): Promise<{
    readonly items: ReadonlyArray<IRemoteModelCatalogItem>;
    readonly nextCursor?: string;
  }> {
    const request: ISearchRemoteModelsRequest = { criteria };
    const result: ISearchRemoteModelsResult =
      await this.searchRemoteModelsUseCase.execute(request);

    return Object.freeze({
      items: result.items,
      nextCursor: result.nextCursor,
    });
  }

  public async installModel(
    request: IInstallModelRequest,
    onProgress?: (progress: IModelInstallProgress) => void
  ): Promise<IInstallModelResult> {
    return this.installModelUseCase.execute(request, onProgress);
  }

  public async removeModel(
    request: IRemoveModelRequest
  ): Promise<IRemoveModelResult> {
    return this.removeModelUseCase.execute(request);
  }

  public resolveCompatibility(
    request: IResolveModelCompatibilityRequest
  ): IResolveModelCompatibilityResult {
    return this.resolveModelCompatibilityUseCase.execute(request);
  }

  public checkModelReadiness(
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    return this.resolveModelCompatibilityUseCase.execute({
      mode: "readiness",
      model,
      context,
    }).compatibility;
  }
}
