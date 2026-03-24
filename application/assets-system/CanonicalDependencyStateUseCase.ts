import type { ICanonicalAssetIdentityRepository, CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { ICanonicalDependencyStateRepository } from "../ports/interfaces/ICanonicalDependencyStateRepository";
import { GetAssetDependencyHealthUseCase } from "./GetAssetDependencyHealthUseCase";
import { GetAssetImpactAnalysisUseCase } from "./GetAssetImpactAnalysisUseCase";
import { GetCanonicalProvenanceSummaryUseCase } from "./CanonicalAssetReadUseCases";

export type CanonicalDependencyLifecycleState =
  | "healthy"
  | "impacted"
  | "stale"
  | "partially-trusted"
  | "reconciliation-needed";

export interface CanonicalDependencyStateSummary {
  readonly versionId: string;
  readonly state: CanonicalDependencyLifecycleState;
  readonly lineageConfidence: "exact" | "partial";
  readonly reasons: ReadonlyArray<string>;
  readonly impactedByUpstreamVersionIds: ReadonlyArray<string>;
  readonly staleBecauseUpstreamAdvanced: ReadonlyArray<{
    readonly upstreamAssetId: string;
    readonly referencedVersionId: string;
    readonly latestVersionId: string;
  }>;
  readonly nextActions: ReadonlyArray<string>;
}

export class GetCanonicalDependencyStateUseCase {
  constructor(
    private readonly versionRepository: IAssetVersionRepository,
    private readonly identityRepository: ICanonicalAssetIdentityRepository,
    private readonly dependencyHealthUseCase: GetAssetDependencyHealthUseCase,
    private readonly impactAnalysisUseCase: GetAssetImpactAnalysisUseCase,
    private readonly provenanceSummaryUseCase: GetCanonicalProvenanceSummaryUseCase,
    private readonly dependencyStateRepository?: ICanonicalDependencyStateRepository,
  ) {}

  public async execute(params: {
    readonly versionId: string;
    readonly changedUpstreamVersionIds?: ReadonlyArray<string>;
    readonly maxDownstreamDepth?: number;
    readonly preferPersistedIfFreshMs?: number;
    readonly forceRefresh?: boolean;
  }): Promise<CanonicalDependencyStateSummary> {
    const version = await this.versionRepository.getByVersionId(params.versionId);
    if (!version) {
      throw new Error(`Canonical dependency state requires an existing version. '${params.versionId}' was not found.`);
    }

    const freshnessWindowMs = params.preferPersistedIfFreshMs ?? 0;
    if (!params.forceRefresh && this.dependencyStateRepository && freshnessWindowMs > 0) {
      const persisted = await this.dependencyStateRepository.getDependencyState(params.versionId);
      if (persisted && Date.now() - persisted.computedAt.getTime() <= freshnessWindowMs) {
        return persisted.summary;
      }
    }

    const [health, impact, provenance] = await Promise.all([
      this.dependencyHealthUseCase.execute({ versionId: params.versionId, maxDownstreamDepth: params.maxDownstreamDepth }),
      this.impactAnalysisUseCase.execute({ versionId: params.versionId, maxDepth: params.maxDownstreamDepth }),
      this.provenanceSummaryUseCase.execute(params.versionId),
    ]);

    const changedUpstreamSet = new Set((params.changedUpstreamVersionIds ?? []).map((entry) => entry.trim()).filter(Boolean));
    const impactedByUpstreamVersionIds = health.direct.upstreamVersionIds.filter((upstreamId) => changedUpstreamSet.has(upstreamId));

    const staleBecauseUpstreamAdvanced = await this.findUpstreamVersionDrift(health.direct.upstreamVersionIds);
    const reasons: string[] = [];
    let state: CanonicalDependencyLifecycleState = "healthy";

    if (impactedByUpstreamVersionIds.length > 0) {
      state = "impacted";
      reasons.push(`Upstream change notifications include ${impactedByUpstreamVersionIds.length} direct dependency version(s).`);
    }

    if (staleBecauseUpstreamAdvanced.length > 0) {
      state = state === "impacted" ? "reconciliation-needed" : "stale";
      reasons.push(`Upstream dependency assets have newer canonical versions than this version references (${staleBecauseUpstreamAdvanced.length} drifted upstream asset(s)).`);
    }

    if (health.confidence === "partial") {
      reasons.push(...health.partialReasons);
      state = state === "healthy" ? "partially-trusted" : "reconciliation-needed";
    }

    if (provenance.producingTransformationIds.length === 0 && provenance.directUpstreamVersionIds.length > 0) {
      reasons.push("Lineage includes upstream dependencies but no producing transformation for this version.");
      state = state === "healthy" ? "partially-trusted" : "reconciliation-needed";
    }

    if (reasons.length === 0) {
      reasons.push("Canonical lineage and transformation evidence are consistent for current upstream dependencies.");
    }

    const nextActions = this.buildNextActions({
      state,
      impactedByUpstreamVersionIds,
      staleBecauseUpstreamAdvanced,
      hasDownstreamExposure: impact.directDependentVersionIds.length > 0 || impact.transitiveDependentVersionIds.length > 0,
    });

    const summary = Object.freeze({
      versionId: params.versionId,
      state,
      lineageConfidence: health.confidence === "certain" ? "exact" : "partial",
      reasons: Object.freeze(reasons),
      impactedByUpstreamVersionIds: Object.freeze(impactedByUpstreamVersionIds),
      staleBecauseUpstreamAdvanced: Object.freeze(staleBecauseUpstreamAdvanced.map((entry) => Object.freeze(entry))),
      nextActions: Object.freeze(nextActions),
    });
    await this.dependencyStateRepository?.saveDependencyState({
      versionId: params.versionId,
      computedAt: new Date(),
      summary,
    });
    return summary;
  }

  public async evaluateCanonicalEntity(params: {
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly changedUpstreamVersionIds?: ReadonlyArray<string>;
    readonly maxDownstreamDepth?: number;
  }): Promise<CanonicalDependencyStateSummary | undefined> {
    const identity = await this.identityRepository.getIdentity(params.entityType, params.entityId);
    const versionId = identity?.latestVersionId;
    if (!versionId) {
      return undefined;
    }
    return this.execute({
      versionId,
      changedUpstreamVersionIds: params.changedUpstreamVersionIds,
      maxDownstreamDepth: params.maxDownstreamDepth,
    });
  }

  private async findUpstreamVersionDrift(upstreamVersionIds: ReadonlyArray<string>): Promise<ReadonlyArray<{
    readonly upstreamAssetId: string;
    readonly referencedVersionId: string;
    readonly latestVersionId: string;
  }>> {
    const drift: Array<{ upstreamAssetId: string; referencedVersionId: string; latestVersionId: string; }> = [];
    for (const upstreamVersionId of upstreamVersionIds) {
      const upstreamVersion = await this.versionRepository.getByVersionId(upstreamVersionId);
      if (!upstreamVersion) continue;
      const latest = await this.versionRepository.listVersionsByAssetId(upstreamVersion.assetId.value).then((entries) => entries[0]);
      if (!latest || latest.versionId === upstreamVersionId) continue;
      drift.push({
        upstreamAssetId: upstreamVersion.assetId.value,
        referencedVersionId: upstreamVersionId,
        latestVersionId: latest.versionId,
      });
    }
    return drift;
  }

  private buildNextActions(params: {
    readonly state: CanonicalDependencyLifecycleState;
    readonly impactedByUpstreamVersionIds: ReadonlyArray<string>;
    readonly staleBecauseUpstreamAdvanced: ReadonlyArray<unknown>;
    readonly hasDownstreamExposure: boolean;
  }): ReadonlyArray<string> {
    const actions: string[] = [];
    if (params.state === "healthy") {
      actions.push("No reconciliation is required.");
      return actions;
    }

    if (params.impactedByUpstreamVersionIds.length > 0) {
      actions.push("Refresh dependency state after upstream changes and review downstream exposure.");
      actions.push("Recompute canonical dependency summaries for this version.");
    }
    if (params.staleBecauseUpstreamAdvanced.length > 0) {
      actions.push("Publish a successor version that references newer upstream canonical versions.");
    }
    if (params.state === "partially-trusted" || params.state === "reconciliation-needed") {
      actions.push("Investigate partial lineage gaps before promoting dependency conclusions.");
      actions.push("Replay scoped graph projection for this asset/version to verify lineage edges.");
    }
    if (params.hasDownstreamExposure) {
      actions.push("Review affected downstream versions and schedule targeted reconciliation.");
    }
    return actions.slice(0, 5);
  }
}
