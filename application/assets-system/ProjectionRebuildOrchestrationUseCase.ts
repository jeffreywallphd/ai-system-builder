import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { ReplayScopedAssetGraphProjectionUseCase } from "./ReconciliationUseCases";
import type { ReplayAssetGraphProjectionUseCase } from "./ReplayAssetGraphProjectionUseCase";
import type { VerifyAssetGraphProjectionUseCase } from "./VerifyAssetGraphProjectionUseCase";

type EntityScope = {
  readonly scopeType: "entity";
  readonly entityType: CanonicalEntityType;
  readonly entityId: string;
  readonly versionId?: string;
};

type AssetScope = {
  readonly scopeType: "asset";
  readonly assetId: string;
  readonly versionIdsInScope?: ReadonlyArray<string>;
};

export type ProjectionRebuildScope = EntityScope | AssetScope;

export class ProjectionRebuildOrchestrationUseCase {
  constructor(
    private readonly replayScopedUseCase: ReplayScopedAssetGraphProjectionUseCase,
    private readonly replayAssetProjectionUseCase: ReplayAssetGraphProjectionUseCase,
    private readonly verifyProjectionUseCase: VerifyAssetGraphProjectionUseCase,
  ) {}

  public async execute(params: {
    readonly scopes: ReadonlyArray<ProjectionRebuildScope>;
    readonly verifyAfterReplay?: boolean;
    readonly verifyBeforeReplay?: boolean;
    readonly replayMismatchedVersionsOnly?: boolean;
  }) {
    const results = await Promise.all(params.scopes.map(async (scope) => {
      if (scope.scopeType === "entity") {
        const replay = await this.replayScopedUseCase.execute(scope);
        if (!replay.replayed || !params.verifyAfterReplay || !replay.assetId) {
          return Object.freeze({ scope, replayed: replay.replayed, replay, verification: undefined });
        }
        const verification = await this.verifyProjectionUseCase.execute({
          assetId: replay.assetId,
          versionIdsInScope: replay.versionId ? [replay.versionId] : undefined,
        });
        return Object.freeze({ scope, replayed: replay.replayed, replay, verification });
      }

      const verificationBeforeReplay = params.verifyBeforeReplay
        ? await this.verifyProjectionUseCase.execute({
          assetId: scope.assetId,
          versionIdsInScope: scope.versionIdsInScope,
        })
        : undefined;
      const replayVersionIds = params.replayMismatchedVersionsOnly && verificationBeforeReplay && scope.versionIdsInScope
        ? verificationBeforeReplay.mismatches.map((entry) => entry.versionId)
        : scope.versionIdsInScope;
      const replay = await this.replayAssetProjectionUseCase.execute({
        assetIds: [scope.assetId],
        versionIds: replayVersionIds,
        includeIdentityAssets: false,
      });
      const verification = params.verifyAfterReplay
        ? await this.verifyProjectionUseCase.execute({
          assetId: scope.assetId,
          versionIdsInScope: scope.versionIdsInScope,
        })
        : undefined;
      return Object.freeze({
        scope,
        replayed: replay.publishedEdgeCount > 0 || replay.publishedTransformationCount > 0,
        verificationBeforeReplay,
        replay,
        verification,
      });
    }));

    return Object.freeze({
      totalScopes: results.length,
      replayedScopes: results.filter((entry) => entry.replayed).length,
      verifiedScopes: results.filter((entry) => !!entry.verification).length,
      results: Object.freeze(results),
    });
  }
}
