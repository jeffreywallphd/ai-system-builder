import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../ports/interfaces/IInstalledModelCatalog";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";

export interface IListInstalledModelsRequest {
  readonly criteria?: IInstalledModelSearchCriteria;
}

export interface IListInstalledModelsResult {
  readonly models: ReadonlyArray<IModel>;
  readonly canonicalByModelId?: Readonly<Record<string, {
    readonly preferred: boolean;
    readonly assetId?: string;
    readonly latestVersionId?: string;
    readonly fallbackReason?: string;
  }>>;
}

export class ListInstalledModelsUseCase {
  private readonly installedModelCatalog: IInstalledModelCatalog;
  private readonly canonicalIdentityService?: CanonicalAssetIdentityService;

  constructor(installedModelCatalog: IInstalledModelCatalog, canonicalIdentityService?: CanonicalAssetIdentityService) {
    this.installedModelCatalog = installedModelCatalog;
    this.canonicalIdentityService = canonicalIdentityService;
  }

  public async execute(
    request: IListInstalledModelsRequest = {}
  ): Promise<IListInstalledModelsResult> {
    const models = await this.installedModelCatalog.listInstalled(request.criteria);
    const canonicalByModelId = this.canonicalIdentityService
      ? Object.freeze(Object.fromEntries(await Promise.all(models.map(async (model) => {
        const assetId = await this.canonicalIdentityService!.resolveAssetId("installed-model", model.id);
        const latestVersionId = await this.canonicalIdentityService!.resolveLatestVersionId("installed-model", model.id);
        return [model.id, Object.freeze({
          preferred: !!assetId,
          assetId,
          latestVersionId,
          fallbackReason: assetId ? undefined : `No canonical identity mapping found for installed model '${model.id}'.`,
        })] as const;
      }))))
      : undefined;

    return Object.freeze({
      models: Object.freeze([...models]),
      canonicalByModelId,
    });
  }
}
