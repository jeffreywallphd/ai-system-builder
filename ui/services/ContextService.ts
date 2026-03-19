import {
  CreateContextPackageUseCase,
  type ICreateContextPackageRequest,
  type ICreateContextPackageResult,
} from "../../application/context/CreateContextPackageUseCase";
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
  LoadContextPackageUseCase,
  type ILoadContextPackageResult,
} from "../../application/context/LoadContextPackageUseCase";
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
}

export class ContextService {
  private readonly createContextPackageUseCase: CreateContextPackageUseCase;
  private readonly updateContextPackageUseCase: UpdateContextPackageUseCase;
  private readonly deleteContextPackageUseCase: DeleteContextPackageUseCase;
  private readonly listContextPackagesUseCase: ListContextPackagesUseCase;
  private readonly loadContextPackageUseCase: LoadContextPackageUseCase;
  private readonly searchContextPackagesUseCase: SearchContextPackagesUseCase;

  constructor(options: IContextServiceOptions) {
    this.createContextPackageUseCase = options.createContextPackageUseCase;
    this.updateContextPackageUseCase = options.updateContextPackageUseCase;
    this.deleteContextPackageUseCase = options.deleteContextPackageUseCase;
    this.listContextPackagesUseCase = options.listContextPackagesUseCase;
    this.loadContextPackageUseCase = options.loadContextPackageUseCase;
    this.searchContextPackagesUseCase = options.searchContextPackagesUseCase;
  }

  public async listContextPackages(
    request: IListContextPackagesRequest = {}
  ): Promise<IListContextPackagesResult> {
    return this.listContextPackagesUseCase.execute(request);
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

  public async createContextPackage(
    request: ICreateContextPackageRequest
  ): Promise<ICreateContextPackageResult> {
    return this.createContextPackageUseCase.execute(request);
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
