import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteAssetSystemRepository } from "../../../infrastructure/filesystem/SqliteAssetSystemRepository";
import { RegisterAssetUseCase } from "../RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "../CreateAssetVersionUseCase";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import { GetAssetDependencyHealthUseCase } from "../GetAssetDependencyHealthUseCase";
import { GetAssetImpactAnalysisUseCase } from "../GetAssetImpactAnalysisUseCase";
import { GetCanonicalProvenanceSummaryUseCase } from "../CanonicalAssetReadUseCases";
import { GetCanonicalDependencyStateUseCase } from "../CanonicalDependencyStateUseCase";

describe("GetCanonicalDependencyStateUseCase", () => {
  it("marks versions stale when direct upstream references are behind latest upstream versions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-dependency-state-"));
    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) return;
      const register = new RegisterAssetUseCase(repository);
      const createVersion = new CreateAssetVersionUseCase(repository);
      await register.execute({ asset: { id: "upstream", name: "upstream", kind: "generic", status: "available", source: { type: "system" }, location: { accessMethod: "virtual", location: "upstream" } } as any });
      await register.execute({ asset: { id: "downstream", name: "downstream", kind: "generic", status: "available", source: { type: "system" }, location: { accessMethod: "virtual", location: "downstream" } } as any });

      await createVersion.execute({ assetId: "upstream", versionId: "upstream:v1" });
      await createVersion.execute({ assetId: "downstream", versionId: "downstream:v1", upstreamVersionIds: ["upstream:v1"] });
      await repository.saveTransformation(new AssetTransformation({
        transformationId: "tx-1",
        transformationType: "workflow-output",
        status: "success",
        inputVersionIds: ["upstream:v1"],
        outputVersionIds: ["downstream:v1"],
      }));
      await repository.saveEdge(new AssetLineageEdge({
        edgeId: "edge-1",
        fromVersionId: "upstream:v1",
        toVersionId: "downstream:v1",
        type: AssetLineageRelationshipType.GENERATED_FROM,
        transformationId: "tx-1",
      }));
      await createVersion.execute({ assetId: "upstream", versionId: "upstream:v2", parentVersionId: "upstream:v1" });

      const summary = await new GetCanonicalDependencyStateUseCase(
        repository,
        repository,
        new GetAssetDependencyHealthUseCase(repository, repository, repository),
        new GetAssetImpactAnalysisUseCase(repository, repository, repository),
        new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
      ).execute({ versionId: "downstream:v1", maxDownstreamDepth: 2 });

      expect(summary.state).toBe("stale");
      expect(summary.staleBecauseUpstreamAdvanced[0]?.latestVersionId).toBe("upstream:v2");
      expect(summary.nextActions.some((action) => action.includes("successor"))).toBeTrue();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
