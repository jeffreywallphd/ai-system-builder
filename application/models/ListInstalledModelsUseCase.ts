import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../ports/interfaces/IInstalledModelCatalog";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";
import type { CanonicalEntityReadResolver } from "../assets-system/CanonicalEntityReadResolver";
import { CanonicalEntityOperationalReadService, type CanonicalOperationalReadSummary } from "../assets-system/CanonicalEntityOperationalReadService";

export interface IListInstalledModelsRequest {
  readonly criteria?: IInstalledModelSearchCriteria;
}

export interface IListInstalledModelsResult {
  readonly models: ReadonlyArray<IModel>;
  readonly canonicalByModelId?: Readonly<Record<string, CanonicalOperationalReadSummary>>;
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
        const resolved = await this.canonicalReadService.resolveSummary({
          entityType: "installed-model",
          entityId: model.id,
          fallbackWhenUnavailable: "Canonical resolver is not configured for installed-model reads.",
        });
        return [model.id, Object.freeze({
          preferred: resolved.preferred,
          assetId: resolved.assetId,
          pinnedVersionId: resolved.pinnedVersionId,
          latestVersionId: resolved.latestVersionId,
          provenance: resolved.provenance,
          dependencyState: resolved.dependencyState
            ? Object.freeze({
              state: resolved.dependencyState.state,
              reasons: resolved.dependencyState.reasons,
              nextActions: resolved.dependencyState.nextActions,
            })
            : undefined,
          operationalStatus: resolved.operationalStatus
            ? Object.freeze({
              trust: resolved.operationalStatus.trust,
              explanation: resolved.operationalStatus.explanation,
              recommendedNextSteps: resolved.operationalStatus.recommendedNextSteps,
            })
            : undefined,
          fallbackReason: resolved.fallbackReason,
        })] as const;
      }))));

    return Object.freeze({
      models: Object.freeze([...models]),
      canonicalByModelId,
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
