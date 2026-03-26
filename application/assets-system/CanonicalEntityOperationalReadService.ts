import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { CanonicalAssetIdentityService } from "./CanonicalAssetIdentityService";
import type { CanonicalEntityReadResolver } from "./CanonicalEntityReadResolver";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";

export interface CanonicalOperationalReadSummary {
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
  readonly dependencyState?: {
    readonly state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
    readonly reasons: ReadonlyArray<string>;
    readonly nextActions: ReadonlyArray<string>;
  };
  readonly operationalStatus?: {
    readonly trust: "trusted" | "attention-needed";
    readonly explanation: string;
    readonly recommendedNextSteps: ReadonlyArray<string>;
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
            taxonomy: identity.taxonomy,
            operationalStatus: Object.freeze({
              trust: "attention-needed",
              explanation: "Canonical identity resolved but resolver-backed dependency/provenance evidence is unavailable.",
              recommendedNextSteps: Object.freeze([
                "Enable canonical resolver wiring for dependency-state and provenance-backed operational reads.",
              ]),
            }),
            fallbackReason: "Canonical resolver is not configured; returning identity-only canonical summary.",
          });
        }
      }

      return Object.freeze({
        preferred: false,
        operationalStatus: Object.freeze({
          trust: "attention-needed",
          explanation: params.fallbackWhenUnavailable,
          recommendedNextSteps: Object.freeze([
            "Use legacy detail/history providers and retry canonical resolution after identity reconciliation.",
          ]),
        }),
        fallbackReason: params.fallbackWhenUnavailable,
      });
    }

    const resolution = await this.resolver.resolve(params);
    const dependencyState = resolution.dependencyState
      ? Object.freeze({
        state: resolution.dependencyState.state,
        reasons: resolution.dependencyState.reasons,
        nextActions: resolution.dependencyState.nextActions,
      })
      : undefined;
    return Object.freeze({
      preferred: resolution.preferred,
      assetId: resolution.assetId,
      pinnedVersionId: resolution.pinnedVersionId,
      latestVersionId: resolution.latestVersionId,
      taxonomy: resolution.taxonomy,
      contract: resolution.contract,
      provenance: resolution.provenance,
      dependencyState,
      operationalStatus: this.toOperationalStatus(resolution.preferred, dependencyState, resolution.fallbackReason),
      fallbackReason: resolution.fallbackReason,
    });
  }

  private toOperationalStatus(
    preferred: boolean,
    dependencyState: CanonicalOperationalReadSummary["dependencyState"],
    fallbackReason?: string,
  ): CanonicalOperationalReadSummary["operationalStatus"] {
    if (!preferred) {
      return Object.freeze({
        trust: "attention-needed",
        explanation: fallbackReason ?? "Canonical operational read is unavailable.",
        recommendedNextSteps: Object.freeze([
          "Continue using explicit legacy fallback behavior and investigate canonical identity mapping gaps.",
        ]),
      });
    }

    if (!dependencyState) {
      return Object.freeze({
        trust: "attention-needed",
        explanation: "Canonical entity resolved without dependency-state evidence.",
        recommendedNextSteps: Object.freeze([
          "Refresh canonical dependency-state for the resolved latest version.",
        ]),
      });
    }

    return Object.freeze({
      trust: dependencyState.state === "healthy" ? "trusted" : "attention-needed",
      explanation: dependencyState.state === "healthy"
        ? "Canonical dependency-state is healthy."
        : `Canonical dependency-state is '${dependencyState.state}'.`,
      recommendedNextSteps: Object.freeze(dependencyState.nextActions),
    });
  }
}
