import {
  CreateContextPackageUseCase,
  type ICreateContextPackageRequest,
  type ICreateContextPackageResult,
} from "../../application/context/CreateContextPackageUseCase";
import {
  CreateContextRecipeUseCase,
  type ICreateContextRecipeRequest,
  type ICreateContextRecipeResult,
} from "../../application/context/CreateContextRecipeUseCase";
import {
  DeleteContextPackageUseCase,
  type IDeleteContextPackageResult,
} from "../../application/context/DeleteContextPackageUseCase";
import {
  ListContextPackagesUseCase,
  type IListContextPackagesRequest,
  type IListContextPackagesResult,
} from "../../application/context/ListContextPackagesUseCase";
import {
  ListContextRecipesUseCase,
  type IListContextRecipesRequest,
  type IListContextRecipesResult,
} from "../../application/context/ListContextRecipesUseCase";
import {
  LoadContextPackageUseCase,
  type ILoadContextPackageResult,
} from "../../application/context/LoadContextPackageUseCase";
import {
  LoadContextRecipeUseCase,
  type ILoadContextRecipeResult,
} from "../../application/context/LoadContextRecipeUseCase";
import {
  SearchContextPackagesUseCase,
  type ISearchContextPackagesRequest,
  type ISearchContextPackagesResult,
} from "../../application/context/SearchContextPackagesUseCase";
import {
  UpdateContextPackageUseCase,
  type IUpdateContextPackageRequest,
  type IUpdateContextPackageResult,
} from "../../application/context/UpdateContextPackageUseCase";

export interface IContextServiceOptions {
  readonly createContextPackageUseCase: CreateContextPackageUseCase;
  readonly updateContextPackageUseCase: UpdateContextPackageUseCase;
  readonly deleteContextPackageUseCase: DeleteContextPackageUseCase;
  readonly listContextPackagesUseCase: ListContextPackagesUseCase;
  readonly loadContextPackageUseCase: LoadContextPackageUseCase;
  readonly searchContextPackagesUseCase: SearchContextPackagesUseCase;
  readonly createContextRecipeUseCase: CreateContextRecipeUseCase;
  readonly listContextRecipesUseCase: ListContextRecipesUseCase;
  readonly loadContextRecipeUseCase: LoadContextRecipeUseCase;
}

export class ContextService {
  private readonly createContextPackageUseCase: CreateContextPackageUseCase;
  private readonly updateContextPackageUseCase: UpdateContextPackageUseCase;
  private readonly deleteContextPackageUseCase: DeleteContextPackageUseCase;
  private readonly listContextPackagesUseCase: ListContextPackagesUseCase;
  private readonly loadContextPackageUseCase: LoadContextPackageUseCase;
  private readonly searchContextPackagesUseCase: SearchContextPackagesUseCase;
  private readonly createContextRecipeUseCase: CreateContextRecipeUseCase;
  private readonly listContextRecipesUseCase: ListContextRecipesUseCase;
  private readonly loadContextRecipeUseCase: LoadContextRecipeUseCase;

  constructor(options: IContextServiceOptions) {
    this.createContextPackageUseCase = options.createContextPackageUseCase;
    this.updateContextPackageUseCase = options.updateContextPackageUseCase;
    this.deleteContextPackageUseCase = options.deleteContextPackageUseCase;
    this.listContextPackagesUseCase = options.listContextPackagesUseCase;
    this.loadContextPackageUseCase = options.loadContextPackageUseCase;
    this.searchContextPackagesUseCase = options.searchContextPackagesUseCase;
    this.createContextRecipeUseCase = options.createContextRecipeUseCase;
    this.listContextRecipesUseCase = options.listContextRecipesUseCase;
    this.loadContextRecipeUseCase = options.loadContextRecipeUseCase;
  }

  public async listContextPackages(
    request: IListContextPackagesRequest = {}
  ): Promise<IListContextPackagesResult> {
    return this.listContextPackagesUseCase.execute(request);
  }

  public async listContextRecipes(
    request: IListContextRecipesRequest = {}
  ): Promise<IListContextRecipesResult> {
    return this.listContextRecipesUseCase.execute(request);
  }

  public async searchContextPackages(
    request: ISearchContextPackagesRequest = {}
  ): Promise<ISearchContextPackagesResult> {
    return this.searchContextPackagesUseCase.execute(request);
  }

  public async loadContextPackage(contextPackageId: string): Promise<ILoadContextPackageResult> {
    return this.loadContextPackageUseCase.execute({
      contextPackageId,
      throwIfNotFound: false,
    });
  }

  public async loadContextRecipe(contextRecipeId: string): Promise<ILoadContextRecipeResult> {
    return this.loadContextRecipeUseCase.execute({
      contextRecipeId,
      throwIfNotFound: false,
    });
  }

  public async createContextPackage(
    request: ICreateContextPackageRequest
  ): Promise<ICreateContextPackageResult> {
    return this.createContextPackageUseCase.execute(request);
  }

  public async createContextRecipe(
    request: ICreateContextRecipeRequest
  ): Promise<ICreateContextRecipeResult> {
    return this.createContextRecipeUseCase.execute(request);
  }

  public async updateContextPackage(
    request: IUpdateContextPackageRequest
  ): Promise<IUpdateContextPackageResult> {
    return this.updateContextPackageUseCase.execute(request);
  }

  public async deleteContextPackage(contextPackageId: string): Promise<IDeleteContextPackageResult> {
    return this.deleteContextPackageUseCase.execute({
      contextPackageId,
      throwIfNotFound: false,
    });
  }
}
