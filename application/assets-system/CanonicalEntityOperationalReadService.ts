import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
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
  constructor(private readonly resolver?: CanonicalEntityReadResolver) {}

  public async resolveSummary(params: {
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly changedUpstreamVersionIds?: ReadonlyArray<string>;
    readonly maxDownstreamDepth?: number;
    readonly fallbackWhenUnavailable: string;
  }): Promise<CanonicalOperationalReadSummary> {
    if (!this.resolver) {
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
