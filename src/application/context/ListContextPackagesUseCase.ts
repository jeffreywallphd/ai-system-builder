import type {
  IContextPackageListCriteria,
  IContextPackageRepository,
  IContextPackageSummary,
} from "../ports/interfaces/IContextPackageRepository";

export interface IListContextPackagesRequest {
  readonly criteria?: IContextPackageListCriteria;
}

export interface IListContextPackagesResult {
  readonly contextPackages: ReadonlyArray<IContextPackageSummary>;
}

export class ListContextPackagesUseCase {
  private readonly contextPackageRepository: IContextPackageRepository;

  constructor(contextPackageRepository: IContextPackageRepository) {
    this.contextPackageRepository = contextPackageRepository;
  }

  public async execute(
    request: IListContextPackagesRequest = {}
  ): Promise<IListContextPackagesResult> {
    const contextPackages = await this.contextPackageRepository.list(request.criteria);

    return Object.freeze({
      contextPackages: Object.freeze([...contextPackages]),
    });
  }
}
