import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../ports/interfaces/IInstalledModelCatalog";

export interface IListInstalledModelsRequest {
  readonly criteria?: IInstalledModelSearchCriteria;
}

export interface IListInstalledModelsResult {
  readonly models: ReadonlyArray<IModel>;
}

export class ListInstalledModelsUseCase {
  private readonly installedModelCatalog: IInstalledModelCatalog;

  constructor(installedModelCatalog: IInstalledModelCatalog) {
    this.installedModelCatalog = installedModelCatalog;
  }

  public async execute(
    request: IListInstalledModelsRequest = {}
  ): Promise<IListInstalledModelsResult> {
    const models = await this.installedModelCatalog.listInstalled(request.criteria);

    return Object.freeze({
      models: Object.freeze([...models]),
    });
  }
}
