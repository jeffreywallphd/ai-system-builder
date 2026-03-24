import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Asset } from "../../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { SourceDocumentReference } from "../../../domain/tuning-datasets/TuningDatasetEntities";
import { NoopAssetLineageGraphProjectionSink } from "../../../infrastructure/filesystem/NoopAssetLineageGraphProjectionSink";
import { SqliteAssetSystemRepository } from "../../../infrastructure/filesystem/SqliteAssetSystemRepository";
import { CreateAssetVersionUseCase } from "../CreateAssetVersionUseCase";
import { ExecutionAssetLineageRecorder } from "../ExecutionAssetLineageRecorder";
import { ProjectArtifactToAssetSystemUseCase } from "../ProjectArtifactToAssetSystemUseCase";
import { RecordAssetTransformationUseCase } from "../RecordAssetTransformationUseCase";
import { RegisterAssetUseCase } from "../RegisterAssetUseCase";

describe("ExecutionAssetLineageRecorder integration", () => {
  it("emits version, transformation, and lineage from workflow execution", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-exec-lineage-"));

    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) {
        return;
      }

      await repository.save(new Asset({
        id: "input-asset",
        name: "Input Asset",
        kind: "document",
        status: "available",
        source: new AssetSourceInfo({ type: "uploaded" }),
        location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/input.txt" }),
      }));
      await repository.saveVersion(new AssetVersion({ assetId: "input-asset", versionId: "input-v1" }));

      const projectUseCase = new ProjectArtifactToAssetSystemUseCase(
        new RegisterAssetUseCase(repository),
        new CreateAssetVersionUseCase(repository),
        new RecordAssetTransformationUseCase(repository, repository, new NoopAssetLineageGraphProjectionSink()),
      );
      const recorder = new ExecutionAssetLineageRecorder(projectUseCase, repository);

      await recorder.recordWorkflowExecution({
        input: {
          workflow: { id: "workflow-1" } as any,
          inputAssets: [(await repository.getById("input-asset"))!],
        },
        result: {
          executionId: "exec-1",
          status: "completed",
          provenance: { classification: "delegated", strategyId: "test-strategy" },
          outputAssets: [new Asset({
            id: "output-1",
            name: "Generated Output",
            kind: "text",
            status: "available",
            source: new AssetSourceInfo({ type: "generated", nodeId: "node-1", executionId: "exec-1" }),
            location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/output.txt", contentType: "text/plain" }),
          })],
        },
      });

      const outputVersions = await repository.listVersionsByAssetId("workflow-output:exec-1:output-1");
      expect(outputVersions).toHaveLength(1);
      const upstreamEdges = await repository.listEdgesByVersionId(outputVersions[0].versionId, "upstream");
      expect(upstreamEdges).toHaveLength(1);
      expect(upstreamEdges[0].fromVersionId).toBe("input-v1");
      const transformations = await repository.listByVersionId(outputVersions[0].versionId);
      expect(transformations.length).toBe(1);
      expect(transformations[0].status).toBe("degraded");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("projects dataset generation runs into the asset system", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-dataset-lineage-"));

    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) {
        return;
      }

      await repository.save(new Asset({
        id: "doc-1",
        name: "Source Document",
        kind: "document",
        status: "available",
        source: new AssetSourceInfo({ type: "uploaded" }),
        location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/source.txt" }),
      }));
      await repository.saveVersion(new AssetVersion({ assetId: "doc-1", versionId: "doc-1:v1" }));

      const projectUseCase = new ProjectArtifactToAssetSystemUseCase(
        new RegisterAssetUseCase(repository),
        new CreateAssetVersionUseCase(repository),
        new RecordAssetTransformationUseCase(repository, repository, new NoopAssetLineageGraphProjectionSink()),
      );
      const recorder = new ExecutionAssetLineageRecorder(projectUseCase, repository);

      await recorder.recordDatasetGeneration({
        request: {
          datasetId: "dataset-1",
          versionId: "version-1",
          taskType: "question_answering",
          createdBy: "tester",
          sourceDocuments: [new SourceDocumentReference({
            id: "doc-1",
            datasetId: "dataset-1",
            versionId: "version-1",
            name: "FAQ",
            content: "hello",
            normalizedContent: "hello",
            checksum: "abc",
            sourceType: "uploaded_text",
            mediaType: "text/plain",
            createdBy: "tester",
            segments: [],
          })],
          existingExamples: [],
        },
        result: {
          batchId: "batch-1",
          datasetId: "dataset-1",
          versionId: "version-1",
          taskType: "question_answering",
          generatedAt: new Date("2026-03-24T00:00:00.000Z"),
          examples: [],
          provenance: {
            provider: "python-runtime",
            generatorId: "dataset-runtime",
            generatorVersion: "1.0.0",
            batchId: "batch-1",
            mode: "python-runtime-local",
            executionKind: "python-runtime-local",
            status: "completed",
            path: "runtime-local",
            isFallback: false,
            isDegraded: false,
            parameters: {},
            startedAt: new Date("2026-03-24T00:00:00.000Z"),
            executedAt: new Date("2026-03-24T00:00:01.000Z"),
            diagnostics: [],
          },
          generatedCount: 2,
          skippedCount: 0,
          status: "completed",
        },
      });

      const assetId = "dataset-generation:dataset-1:version-1:batch-1";
      const versions = await repository.listVersionsByAssetId(assetId);
      expect(versions).toHaveLength(1);
      const upstreamEdges = await repository.listEdgesByVersionId(versions[0].versionId, "upstream");
      expect(upstreamEdges).toHaveLength(1);
      expect(upstreamEdges[0].fromVersionId).toBe("doc-1:v1");
      expect((await repository.listByVersionId(versions[0].versionId)).length).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("projects model training artifacts into the asset system", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-model-training-lineage-"));

    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) {
        return;
      }

      await repository.save(new Asset({
        id: "dataset-version:dataset-1:version-1",
        name: "Dataset Version 1",
        kind: "dataset",
        status: "available",
        source: new AssetSourceInfo({ type: "generated" }),
        location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/dataset-v1.jsonl" }),
      }));
      await repository.saveVersion(new AssetVersion({ assetId: "dataset-version:dataset-1:version-1", versionId: "dataset-1:v1" }));

      const projectUseCase = new ProjectArtifactToAssetSystemUseCase(
        new RegisterAssetUseCase(repository),
        new CreateAssetVersionUseCase(repository),
        new RecordAssetTransformationUseCase(repository, repository, new NoopAssetLineageGraphProjectionSink()),
      );
      const recorder = new ExecutionAssetLineageRecorder(projectUseCase, repository);

      await recorder.recordModelTraining({
        request: {
          id: "job-1",
          name: "Train adapter",
          executionKind: "local-gradient-training",
          baseModelId: "base-1",
          baseModelName: "Base Model",
          datasetId: "dataset-1",
          datasetName: "Dataset 1",
          datasetVersionId: "version-1",
          datasetVersionNumber: 1,
          datasetTaskType: "question_answering",
          createdBy: "tester",
          configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
          examples: [],
          assetLineage: {
            sourceVersionIds: ["dataset-1:v1"],
            outputAssetNamespace: "trained-model",
          },
        },
        job: {
          id: "job-1",
          name: "Train adapter",
          backend: "python-runtime-local",
          executionKind: "local-gradient-training",
          baseModelId: "base-1",
          datasetId: "dataset-1",
          datasetVersionId: "version-1",
          createdBy: "tester",
          createdAt: new Date("2026-03-24T00:00:00.000Z"),
          updatedAt: new Date("2026-03-24T00:00:01.000Z"),
          completedAt: new Date("2026-03-24T00:10:00.000Z"),
          status: "completed",
          configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
          diagnostics: [],
          artifacts: [{
            id: "artifact-1",
            kind: "trained-model",
            label: "Adapter Model",
            location: "/tmp/model.gguf",
            contentType: "application/octet-stream",
            createdAt: new Date("2026-03-24T00:10:00.000Z"),
          }],
          checkpoints: [],
          outputModelName: "adapter-model",
          summary: "Completed",
          provenance: {
            executionKind: "local-gradient-training",
            backend: "python-runtime-local",
            truthfulness: "real-execution",
            runtime: "python-runtime",
            runMode: "local-gradient-training",
            supportsGradientTraining: true,
            isPreparationOnly: false,
            path: "/tmp/job-1",
            diagnostics: [],
          },
        },
      });

      const assetId = "trained-model:job-1:artifact-1";
      const versions = await repository.listVersionsByAssetId(assetId);
      expect(versions).toHaveLength(1);
      const upstreamEdges = await repository.listEdgesByVersionId(versions[0].versionId, "upstream");
      expect(upstreamEdges).toHaveLength(1);
      expect(upstreamEdges[0].fromVersionId).toBe("dataset-1:v1");
      const transformations = await repository.listByVersionId(versions[0].versionId);
      expect(transformations).toHaveLength(1);
      expect(transformations[0].transformationType).toBe("model-artifact");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
