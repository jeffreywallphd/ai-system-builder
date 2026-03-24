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
import { ReplayAssetGraphProjectionUseCase } from "../ReplayAssetGraphProjectionUseCase";
import { InMemoryAssetLineageGraphProjectionSink } from "../../../infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink";
import { ExplainCanonicalVersionExistenceUseCase, GetCanonicalProvenanceSummaryUseCase } from "../CanonicalAssetReadUseCases";
import { GetAssetLineageDiagnosticsUseCase } from "../GetAssetLineageDiagnosticsUseCase";

describe("Dependency health and graph projection", () => {
  it("distinguishes direct, transitive, and partial lineage signals", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-dependency-health-"));
    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) return;

      const register = new RegisterAssetUseCase(repository);
      const createVersion = new CreateAssetVersionUseCase(repository);
      for (const [assetId, versionId] of [["a", "a:v1"], ["b", "b:v1"], ["c", "c:v1"], ["d", "d:v1"]] as const) {
        await register.execute({ asset: { id: assetId, name: assetId, kind: "generic", status: "available", source: { type: "system" }, location: { accessMethod: "virtual", location: assetId } } as any });
        await createVersion.execute({ assetId, versionId });
      }

      await repository.saveEdge(new AssetLineageEdge({ edgeId: "ab", fromVersionId: "a:v1", toVersionId: "b:v1", type: AssetLineageRelationshipType.DERIVED_FROM }));
      await repository.saveEdge(new AssetLineageEdge({ edgeId: "bc", fromVersionId: "b:v1", toVersionId: "c:v1", type: AssetLineageRelationshipType.DERIVED_FROM }));
      await repository.saveTransformation(new AssetTransformation({ transformationId: "tx-a", transformationType: "dataset-export", status: "partial", inputVersionIds: ["a:v1"], outputVersionIds: ["b:v1"] }));

      const summary = await new GetAssetDependencyHealthUseCase(repository, repository, repository).execute({ versionId: "a:v1", maxDownstreamDepth: 2 });
      expect(summary.direct.downstreamVersionIds).toContain("b:v1");
      expect(summary.transitiveDownstream.versionIds).toContain("c:v1");
      expect(summary.confidence).toBe("partial");
      expect(summary.staleExposure.some((entry) => entry.exposure === "transitive" && entry.versionId === "c:v1")).toBeTrue();

      const unlinked = await new GetAssetDependencyHealthUseCase(repository, repository, repository).execute({ versionId: "d:v1" });
      expect(unlinked.confidence).toBe("partial");
      expect(unlinked.partialReasons.length).toBeGreaterThan(0);

      const diagnostics = await new GetAssetLineageDiagnosticsUseCase(
        new GetAssetDependencyHealthUseCase(repository, repository, repository),
        new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
        new ExplainCanonicalVersionExistenceUseCase(new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository), repository),
      ).execute({ versionId: "d:v1" });
      expect(diagnostics.status).toBe("partial");
      expect(diagnostics.diagnostics.some((entry) => entry.code === "LINEAGE_GAP")).toBeTrue();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("replays normalized transformations and edges to the graph projection sink", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-graph-replay-"));
    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) return;

      const register = new RegisterAssetUseCase(repository);
      const createVersion = new CreateAssetVersionUseCase(repository);
      await register.execute({ asset: { id: "asset-out", name: "Out", kind: "generic", status: "available", source: { type: "system" }, location: { accessMethod: "virtual", location: "asset-out" } } as any });
      await register.execute({ asset: { id: "asset-in", name: "In", kind: "generic", status: "available", source: { type: "system" }, location: { accessMethod: "virtual", location: "asset-in" } } as any });
      await createVersion.execute({ assetId: "asset-in", versionId: "asset-in:v1" });
      await createVersion.execute({ assetId: "asset-out", versionId: "asset-out:v1", upstreamVersionIds: ["asset-in:v1"] });
      await repository.saveTransformation(new AssetTransformation({ transformationId: "tx-1", transformationType: "workflow-output", status: "success", inputVersionIds: ["asset-in:v1"], outputVersionIds: ["asset-out:v1"] }));
      await repository.saveEdge(new AssetLineageEdge({ edgeId: "in-out", fromVersionId: "asset-in:v1", toVersionId: "asset-out:v1", type: AssetLineageRelationshipType.GENERATED_FROM, transformationId: "tx-1" }));

      const sink = new InMemoryAssetLineageGraphProjectionSink();
      const replayResult = await new ReplayAssetGraphProjectionUseCase(repository, sink).execute({ assetIds: ["asset-out", "asset-in"] });
      expect(replayResult.publishedTransformationCount).toBeGreaterThan(0);
      expect(replayResult.publishedEdgeCount).toBeGreaterThan(0);
      expect(sink.hasVersionPath("asset-in:v1", "asset-out:v1")).toBeTrue();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
