import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { CanonicalAssetIdentityService } from "./CanonicalAssetIdentityService";
import type { CanonicalEntityReadResolver } from "./CanonicalEntityReadResolver";

export interface CanonicalOperationalReadSummary {
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
}

export class CanonicalEntityOperationalReadService {
  constructor(
    private readonly resolver?: CanonicalEntityReadResolver,
    private readonly identityService?: CanonicalAssetIdentityService,
  ) {}

  public async resolveSummary(params: {
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly changedUpstreamVersionIds?: ReadonlyArray<string>;
    readonly maxDownstreamDepth?: number;
    readonly fallbackWhenUnavailable: string;
  }): Promise<CanonicalOperationalReadSummary> {
    if (!this.resolver) {
      if (this.identityService) {
        const identity = await this.identityService.resolveIdentity(params.entityType, params.entityId);
        if (identity) {
          const latestVersionId = identity.latestVersionId
            ?? await this.identityService.resolveLatestVersionId(params.entityType, params.entityId);
          return Object.freeze({
            preferred: true,
            assetId: identity.assetId,
            pinnedVersionId: identity.latestVersionId,
            latestVersionId,
            fallbackReason: "Canonical resolver is not configured; returning identity-only canonical summary.",
          });
        }
      }

      return Object.freeze({
        preferred: false,
        fallbackReason: params.fallbackWhenUnavailable,
      });
    }

    const resolution = await this.resolver.resolve(params);
    return Object.freeze({
      preferred: resolution.preferred,
      assetId: resolution.assetId,
      pinnedVersionId: resolution.pinnedVersionId,
      latestVersionId: resolution.latestVersionId,
      provenance: resolution.provenance,
      dependencyState: resolution.dependencyState
        ? Object.freeze({
          state: resolution.dependencyState.state,
          reasons: resolution.dependencyState.reasons,
          nextActions: resolution.dependencyState.nextActions,
        })
        : undefined,
      fallbackReason: resolution.fallbackReason,
    });
  }
}
