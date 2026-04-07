import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../ports/interfaces/IInstalledModelCatalog";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";
import type { CanonicalEntityReadResolver } from "../assets-system/CanonicalEntityReadResolver";
import { CanonicalEntityOperationalReadService, type CanonicalOperationalReadSummary } from "../assets-system/CanonicalEntityOperationalReadService";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";

export interface IListInstalledModelsRequest {
  readonly criteria?: IInstalledModelSearchCriteria;
}

export interface IListInstalledModelsResult {
  readonly models: ReadonlyArray<IModel>;
  readonly canonicalByModelId?: Readonly<Record<string, CanonicalOperationalReadSummary>>;
  readonly canonicalContractByModelId?: Readonly<Record<string, AssetContractDescriptor | undefined>>;
}

export class ListInstalledModelsUseCase {
  private readonly installedModelCatalog: IInstalledModelCatalog;
  private readonly canonicalReadService: CanonicalEntityOperationalReadService;

  constructor(
    installedModelCatalog: IInstalledModelCatalog,
    canonicalIdentityService?: CanonicalAssetIdentityService,
    canonicalReadResolver?: CanonicalEntityReadResolver,
  ) {
    this.installedModelCatalog = installedModelCatalog;
    this.canonicalReadService = new CanonicalEntityOperationalReadService(canonicalReadResolver, canonicalIdentityService);
  }

  public async execute(
    request: IListInstalledModelsRequest = {}
  ): Promise<IListInstalledModelsResult> {
    const models = await this.installedModelCatalog.listInstalled(request.criteria);
    const canonicalByModelId = Object.freeze(Object.fromEntries(await Promise.all(models.map(async (model) => {
        const summary = await this.resolveCanonicalModelSummary(model.id);
        return [model.id, summary] as const;
      }))));

    const canonicalContractByModelId = Object.freeze(Object.fromEntries(
      Object.entries(canonicalByModelId).map(([modelId, summary]) => [modelId, summary.contract] as const),
    ));

    return Object.freeze({
      models: Object.freeze([...models]),
      canonicalByModelId,
      canonicalContractByModelId,
    });
  }

  public async resolveCanonicalModelSummary(modelId: string): Promise<CanonicalOperationalReadSummary> {
    const normalizedModelId = modelId.trim();
    if (!normalizedModelId) {
      throw new Error("ListInstalledModelsUseCase.resolveCanonicalModelSummary requires a non-empty modelId.");
    }
    return this.canonicalReadService.resolveSummary({
      entityType: "installed-model",
      entityId: normalizedModelId,
      fallbackWhenUnavailable: "Canonical resolver is not configured for installed-model reads.",
    });
  }
}
