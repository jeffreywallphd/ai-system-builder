import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteAssetSystemRepository } from "../../../infrastructure/filesystem/SqliteAssetSystemRepository";
import { RegisterAssetUseCase } from "../RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "../CreateAssetVersionUseCase";
import { PublishDurableEntityToAssetSystemUseCase } from "../PublishDurableEntityToAssetSystemUseCase";
import { Workflow } from "../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { Model, ModelArtifact, ModelSource } from "../../../domain/models/Model";
import { ModelCompatibility } from "../../../domain/models/ModelCompatibility";
import { TuningDatasetVersion } from "../../../domain/tuning-datasets/TuningDatasetEntities";
import { ExplainCanonicalVersionExistenceUseCase, GetCanonicalLatestVersionUseCase, GetCanonicalProvenanceSummaryUseCase, GetCanonicalVersionDependencyUseCase, ListCanonicalAssetsUseCase, LoadCanonicalAssetDetailUseCase, LoadCanonicalAssetSummaryUseCase } from "../CanonicalAssetReadUseCases";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import { GetAssetImpactAnalysisUseCase } from "../GetAssetImpactAnalysisUseCase";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";

function buildModel(id: string): Model {
  return new Model({
    id,
    name: "Model One",
    kind: "llm",
    source: new ModelSource({ type: "local" }),
    artifact: new ModelArtifact({ name: "weights", accessMethod: "local-file", location: `/models/${id}.gguf`, format: "gguf" }),
    compatibility: new ModelCompatibility({}),
  });
}

describe("Canonical asset system integration", () => {
  it("publishes workflows, installed models, and dataset versions as canonical entities", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-canonical-asset-"));

    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) return;

      const publisher = new PublishDurableEntityToAssetSystemUseCase(
        new RegisterAssetUseCase(repository),
        new CreateAssetVersionUseCase(repository),
        repository,
      );

      const workflowResult = await publisher.publishWorkflowDefinition(new Workflow({
        id: "workflow-1",
        metadata: new WorkflowMetadata({ name: "Workflow One" }),
      }));
      const modelResult = await publisher.publishInstalledModel(buildModel("base-1"));
      const datasetVersion = new TuningDatasetVersion({
        id: "version-1",
        datasetId: "dataset-1",
        versionNumber: 1,
        status: "draft",
        kind: "initial_draft",
        createdBy: "tester",
        createdAt: new Date("2026-03-24T00:00:00.000Z"),
        updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        schema: { taskType: "question_answering", schemaVersion: "1", canonicalExampleType: "qa", requiredFields: ["question", "answer"] },
      });
      const datasetResult = await publisher.publishDatasetVersion({
        datasetId: "dataset-1",
        datasetName: "Dataset One",
        version: datasetVersion,
      });

      expect((await repository.getIdentity("workflow-definition", "workflow-1"))?.assetId).toBe(workflowResult.assetId);
      expect((await repository.getIdentity("installed-model", "base-1"))?.assetId).toBe(modelResult.assetId);
      expect((await repository.getIdentity("dataset-version", "dataset-1:version-1"))?.assetId).toBe(datasetResult.assetId);

      const listUseCase = new ListCanonicalAssetsUseCase(repository, repository);
      const assets = await listUseCase.execute({ kinds: ["workflow-definition", "dataset"], limit: 10 });
      expect(assets.length).toBe(2);

      const summary = await new LoadCanonicalAssetSummaryUseCase(repository, repository, repository).execute(datasetResult.assetId);
      expect(summary?.latestVersionId).toBe(datasetResult.versionId);
      const detail = await new LoadCanonicalAssetDetailUseCase(repository, repository, repository, repository, repository).execute(datasetResult.assetId);
      expect(detail?.versionCount).toBe(1);
      expect((await new GetCanonicalLatestVersionUseCase(repository, repository).execute(modelResult.assetId))?.versionId).toBe(modelResult.versionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports bounded dependency and impact analysis", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-impact-"));

    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) return;
      const register = new RegisterAssetUseCase(repository);
      const createVersion = new CreateAssetVersionUseCase(repository);

      for (const [assetId, versionId] of [["a", "a:v1"], ["b", "b:v1"], ["c", "c:v1"]] as const) {
        await register.execute({ asset: { id: assetId, name: assetId, kind: "generic", status: "available", source: { type: "system" }, location: { accessMethod: "virtual", location: assetId }, relationships: [] } as any });
        await createVersion.execute({ assetId, versionId });
      }

      await repository.saveEdge(new AssetLineageEdge({ edgeId: "ab", fromVersionId: "a:v1", toVersionId: "b:v1", type: AssetLineageRelationshipType.DERIVED_FROM }));
      await repository.saveEdge(new AssetLineageEdge({ edgeId: "bc", fromVersionId: "b:v1", toVersionId: "c:v1", type: AssetLineageRelationshipType.DERIVED_FROM }));
      await repository.saveTransformation(new AssetTransformation({ transformationId: "tx-a", transformationType: "model-artifact", status: "success", inputVersionIds: ["a:v1"], outputVersionIds: ["b:v1"] }));

      const dependencies = await new GetCanonicalVersionDependencyUseCase(repository, repository).execute("b:v1");
      expect(dependencies.dependencyVersionIds).toContain("a:v1");
      expect(dependencies.dependentVersionIds).toContain("c:v1");

      const provenance = await new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository).execute("b:v1");
      expect(provenance.directUpstreamVersionIds).toContain("a:v1");
      const explanation = await new ExplainCanonicalVersionExistenceUseCase(new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository), repository).execute("b:v1");
      expect(explanation.evidence.some((entry) => entry.includes("produced-by:tx-a"))).toBeTrue();

      const impact = await new GetAssetImpactAnalysisUseCase(repository, repository, repository).execute({ versionId: "a:v1", maxDepth: 2 });
      expect(impact.directDependentVersionIds).toContain("b:v1");
      expect(impact.transitiveDependentVersionIds).toContain("c:v1");
      expect(impact.impactedArtifactTransformationIds).toContain("tx-a");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
