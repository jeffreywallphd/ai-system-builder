import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import { CanonicalAssetIdentityService } from "./CanonicalAssetIdentityService";
import { GetCanonicalLatestVersionUseCase, GetCanonicalProvenanceSummaryUseCase, LoadCanonicalAssetSummaryUseCase } from "./CanonicalAssetReadUseCases";
import type { GetCanonicalDependencyStateUseCase, CanonicalDependencyStateSummary } from "./CanonicalDependencyStateUseCase";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";

export interface CanonicalEntityReadResolution {
  readonly preferred: boolean;
  readonly assetId?: string;
  readonly pinnedVersionId?: string;
  readonly latestVersionId?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly provenance?: {
    readonly directUpstreamCount: number;
    readonly directDownstreamCount: number;
    readonly producingTransformationCount: number;
    readonly lineageConfidence: "exact" | "partial";
  };
  readonly dependencyState?: CanonicalDependencyStateSummary;
  readonly fallbackReason?: string;
}

export class CanonicalEntityReadResolver {
  constructor(
    private readonly identityService: CanonicalAssetIdentityService,
    private readonly assetSummaryUseCase: LoadCanonicalAssetSummaryUseCase,
    private readonly latestVersionUseCase: GetCanonicalLatestVersionUseCase,
    private readonly provenanceSummaryUseCase?: GetCanonicalProvenanceSummaryUseCase,
    private readonly dependencyStateUseCase?: GetCanonicalDependencyStateUseCase,
    private readonly contractResolver?: IAssetContractResolver,
  ) {}

  public async resolve(params: {
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly changedUpstreamVersionIds?: ReadonlyArray<string>;
    readonly maxDownstreamDepth?: number;
  }): Promise<CanonicalEntityReadResolution> {
    const identity = await this.identityService.resolveIdentity(params.entityType, params.entityId);
    if (!identity) {
      return Object.freeze({
        preferred: false,
        fallbackReason: `No canonical identity mapping found for ${params.entityType} '${params.entityId}'.`,
      });
    }

    const [summary, latestVersion] = await Promise.all([
      this.assetSummaryUseCase.execute(identity.assetId),
      this.latestVersionUseCase.execute(identity.assetId),
    ]);
    if (!summary) {
      return Object.freeze({
        preferred: false,
        assetId: identity.assetId,
        pinnedVersionId: identity.latestVersionId,
        latestVersionId: latestVersion?.versionId,
        taxonomy: identity.taxonomy,
        fallbackReason: `Canonical asset '${identity.assetId}' could not be loaded.`,
      });
    }

    const effectiveVersionId = identity.latestVersionId ?? latestVersion?.versionId;
    const provenance = this.provenanceSummaryUseCase && effectiveVersionId
      ? await this.provenanceSummaryUseCase.execute(effectiveVersionId)
      : undefined;
    const contract = this.contractResolver
      ? await this.contractResolver.resolveCanonicalEntityContract(params.entityType, params.entityId)
      : undefined;

    const dependencyState = this.dependencyStateUseCase
      ? await this.dependencyStateUseCase.evaluateCanonicalEntity({
        entityType: params.entityType,
        entityId: params.entityId,
        changedUpstreamVersionIds: params.changedUpstreamVersionIds,
        maxDownstreamDepth: params.maxDownstreamDepth,
      })
      : undefined;

    return Object.freeze({
      preferred: true,
      assetId: identity.assetId,
      pinnedVersionId: identity.latestVersionId,
      latestVersionId: latestVersion?.versionId,
      taxonomy: summary.taxonomy ?? identity.taxonomy,
      contract,
      provenance: provenance
        ? Object.freeze({
          directUpstreamCount: provenance.directUpstreamVersionIds.length,
          directDownstreamCount: provenance.directDownstreamVersionIds.length,
          producingTransformationCount: provenance.producingTransformationIds.length,
          lineageConfidence: dependencyState?.lineageConfidence ?? "exact",
        })
        : undefined,
      dependencyState,
    });
  }
}
