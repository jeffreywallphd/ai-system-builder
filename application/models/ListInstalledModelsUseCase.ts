import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../ports/interfaces/IInstalledModelCatalog";
import type { CanonicalAssetIdentityService } from "../assets-system/CanonicalAssetIdentityService";
import type { CanonicalEntityReadResolver } from "../assets-system/CanonicalEntityReadResolver";
import { CanonicalEntityOperationalReadService } from "../assets-system/CanonicalEntityOperationalReadService";

export interface IListInstalledModelsRequest {
  readonly criteria?: IInstalledModelSearchCriteria;
}

export interface IListInstalledModelsResult {
  readonly models: ReadonlyArray<IModel>;
  readonly canonicalByModelId?: Readonly<Record<string, {
    readonly preferred: boolean;
    readonly assetId?: string;
    readonly pinnedVersionId?: string;
    readonly latestVersionId?: string;
    readonly provenance?: {
      readonly directUpstreamCount: number;
      readonly directDownstreamCount: number;
      readonly producingTransformationCount: number;
      readonly lineageConfidence: "exact" | "partial";
    };
    readonly dependencyState?: {
      readonly state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
      readonly reasons: ReadonlyArray<string>;
      readonly nextActions: ReadonlyArray<string>;
    };
    readonly fallbackReason?: string;
  }>>;
}

export class ListInstalledModelsUseCase {
  private readonly installedModelCatalog: IInstalledModelCatalog;
  private readonly canonicalIdentityService?: CanonicalAssetIdentityService;
  private readonly canonicalReadService: CanonicalEntityOperationalReadService;

  constructor(
    installedModelCatalog: IInstalledModelCatalog,
    canonicalIdentityService?: CanonicalAssetIdentityService,
    canonicalReadResolver?: CanonicalEntityReadResolver,
  ) {
    this.installedModelCatalog = installedModelCatalog;
    this.canonicalIdentityService = canonicalIdentityService;
    this.canonicalReadService = new CanonicalEntityOperationalReadService(canonicalReadResolver);
  }

  public async execute(
    request: IListInstalledModelsRequest = {}
  ): Promise<IListInstalledModelsResult> {
    const models = await this.installedModelCatalog.listInstalled(request.criteria);
    const canonicalByModelId = this.canonicalIdentityService
      ? Object.freeze(Object.fromEntries(await Promise.all(models.map(async (model) => {
        const resolved = await this.canonicalReadService.resolveSummary({
          entityType: "installed-model",
          entityId: model.id,
          fallbackWhenUnavailable: "Canonical resolver is not configured for installed-model reads.",
        });
        const identity = await this.canonicalIdentityService!.resolveIdentity("installed-model", model.id);
        const assetId = resolved.assetId ?? identity?.assetId;
        const latestVersionId = resolved.latestVersionId ?? await this.canonicalIdentityService!.resolveLatestVersionId("installed-model", model.id);
        return [model.id, Object.freeze({
          preferred: !!assetId,
          assetId,
          pinnedVersionId: resolved.pinnedVersionId ?? identity?.latestVersionId,
          latestVersionId,
          provenance: resolved.provenance,
          dependencyState: resolved.dependencyState
            ? Object.freeze({
              state: resolved.dependencyState.state,
              reasons: resolved.dependencyState.reasons,
              nextActions: resolved.dependencyState.nextActions,
            })
            : undefined,
          fallbackReason: resolved.fallbackReason ?? (assetId ? undefined : `No canonical identity mapping found for installed model '${model.id}'.`),
        })] as const;
      }))))
      : undefined;

    return Object.freeze({
      models: Object.freeze([...models]),
      canonicalByModelId,
    });
  }
}
