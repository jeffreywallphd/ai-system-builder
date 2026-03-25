import type { CanonicalEntityType, ICanonicalAssetIdentityRepository } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { IAssetSystemQueryRepository } from "../ports/interfaces/IAssetSystemQueryRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { ICanonicalDependencyStateRepository } from "../ports/interfaces/ICanonicalDependencyStateRepository";
import { GetCanonicalDependencyStateUseCase } from "./CanonicalDependencyStateUseCase";

export class RefreshCanonicalDependencyStateUseCase {
  constructor(
    private readonly dependencyStateUseCase: GetCanonicalDependencyStateUseCase,
    private readonly dependencyStateRepository?: ICanonicalDependencyStateRepository,
  ) {}

  public async execute(params: {
    readonly versionId: string;
    readonly changedUpstreamVersionIds?: ReadonlyArray<string>;
    readonly maxDownstreamDepth?: number;
    readonly allowPersistedIfFreshMs?: number;
    readonly forceRefresh?: boolean;
  }) {
    const summary = await this.dependencyStateUseCase.execute({
      ...params,
      preferPersistedIfFreshMs: params.allowPersistedIfFreshMs,
      forceRefresh: params.forceRefresh,
    });
    const persisted = this.dependencyStateRepository
      ? await this.dependencyStateRepository.getDependencyState(params.versionId)
      : undefined;
    return Object.freeze({
      refreshedAt: persisted?.computedAt ?? new Date(),
      persisted: !!persisted,
      explanation: summary.lifecycle.reason,
      remediationHint: summary.nextActions[0] ?? "No reconciliation is required.",
      summary,
    });
  }
}

export class ReconcileCanonicalIdentityMappingsUseCase {
  constructor(
    private readonly identityRepository: ICanonicalAssetIdentityRepository,
    private readonly versionRepository: IAssetVersionRepository,
  ) {}

  public async execute(params: { readonly entityType: CanonicalEntityType; readonly entityId: string }): Promise<{
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly reconciled: boolean;
    readonly assetId?: string;
    readonly previousVersionId?: string;
    readonly reconciledVersionId?: string;
    readonly reason: string;
  }> {
    const identity = await this.identityRepository.getIdentity(params.entityType, params.entityId);
    if (!identity) {
      return Object.freeze({
        entityType: params.entityType,
        entityId: params.entityId,
        reconciled: false,
        reason: "No canonical identity mapping was found.",
      });
    }

    if (identity.latestVersionId) {
      const pinned = await this.versionRepository.getByVersionId(identity.latestVersionId);
      if (pinned) {
        return Object.freeze({
          entityType: params.entityType,
          entityId: params.entityId,
          reconciled: false,
          assetId: identity.assetId,
          previousVersionId: identity.latestVersionId,
          reconciledVersionId: identity.latestVersionId,
          reason: "Pinned canonical version reference is valid.",
        });
      }
    }

    const latest = await this.versionRepository.listVersionsByAssetId(identity.assetId).then((entries) => entries[0]);
    if (!latest) {
      return Object.freeze({
        entityType: params.entityType,
        entityId: params.entityId,
        reconciled: false,
        assetId: identity.assetId,
        previousVersionId: identity.latestVersionId,
        reason: "Canonical asset exists but has no versions to reconcile.",
      });
    }

    await this.identityRepository.upsertIdentity({
      entityType: params.entityType,
      entityId: params.entityId,
      assetId: identity.assetId,
      latestVersionId: latest.versionId,
      taxonomy: identity.taxonomy,
      updatedAt: new Date(),
    });

    return Object.freeze({
      entityType: params.entityType,
      entityId: params.entityId,
      reconciled: true,
      assetId: identity.assetId,
      previousVersionId: identity.latestVersionId,
      reconciledVersionId: latest.versionId,
      reason: "Reconciled canonical identity to the latest durable version for the mapped asset.",
    });
  }
}

export class ReplayScopedAssetGraphProjectionUseCase {
  constructor(
    private readonly queryRepository: IAssetSystemQueryRepository,
    private readonly replayUseCase: { execute(params: { readonly assetIds: ReadonlyArray<string>; readonly versionIds?: ReadonlyArray<string>; readonly transformationIds?: ReadonlyArray<string>; readonly includeIdentityAssets?: boolean; }): Promise<unknown> },
  ) {}

  public async execute(params: {
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly versionId?: string;
  }) {
    const identities = await this.queryRepository.listCanonicalIdentities({ entityType: params.entityType });
    const identity = identities.find((entry) => entry.entityId === params.entityId);
    if (!identity) {
      return Object.freeze({
        replayed: false,
        reason: "No canonical identity mapping was found for scoped graph replay.",
      });
    }

    const replaySummary = await this.replayUseCase.execute({
      assetIds: [identity.assetId],
      versionIds: params.versionId ? [params.versionId] : undefined,
      includeIdentityAssets: false,
    });

    return Object.freeze({
      replayed: true,
      entityType: params.entityType,
      entityId: params.entityId,
      assetId: identity.assetId,
      versionId: params.versionId,
      projectionSummary: replaySummary,
    });
  }
}
