import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, testDouble } from "../../../testing/node-test";
import { createContractError } from "../../../contracts/shared";
import { PythonDatasetPreparationError } from "../../ports/runtime";
import {
  PrepareTrainingDatasetFromArtifactsUseCase,
} from "../prepare-training-dataset-from-artifacts.use-case";

const recipe = {
  normalization: { targetFormat: "markdown" as const },
  chunking: { strategy: "character" as const, chunkSize: 1000, chunkOverlap: 100 },
  generation: {
    mode: "qa" as const,
    model: { provider: "transformers" as const, modelId: "test-model", device: "cpu" as const, torchDtype: "float32" as const },
  },
};

const split = { trainRatio: 0.5, testRatio: 0.5 };

async function setupRuntimeOutputs() {
  const tempDir = await mkdtemp(join(tmpdir(), "dataset-use-case-test-"));
  const runtimeTrain = join(tempDir, "train.jsonl");
  const runtimeTest = join(tempDir, "test.jsonl");
  await writeFile(runtimeTrain, '{"text":"train"}\n', "utf-8");
  await writeFile(runtimeTest, '{"text":"test"}\n', "utf-8");
  return { runtimeTrain, runtimeTest };
}

async function expectFileMissing(path: string) {
  await expect(access(path)).rejects.toBeDefined();
}

function createDeps(runtimeTrain: string, runtimeTest: string) {
  const readArtifactStorageBindings = testDouble.fn(async ({ artifactId }: { artifactId: string }) => ({
    ok: true as const,
    value: {
      bindings: [{
        artifactId,
        backing: {
          kind: "artifact-object",
          provider: "local",
          locator: `key-${artifactId}`,
        },
        role: "primary",
      }],
    },
  }));

  const retrieveArtifact = testDouble.fn(async ({ key }: { key: string }) => ({
    ok: true as const,
    value: {
      descriptor: {
        key,
        mediaType: "application/x-ndjson",
        metadata: { originalName: `${key}.md` },
      },
      content: new TextEncoder().encode('{"text":"a"}\n{"text":"b"}\n'),
    },
  }));

  let storeCall = 0;
  const storeArtifact = testDouble.fn(async () => {
    storeCall += 1;
    return storeCall === 1
      ? { ok: true as const, value: { key: "stored-train", mediaType: "application/x-ndjson" } }
      : { ok: true as const, value: { key: "stored-test", mediaType: "application/x-ndjson" } };
  });

  const storeArtifactInRepo = testDouble.fn(async ({ target }: { target: { repository: string; path: string; revision?: string } }) => ({
    ok: true as const,
    value: {
      descriptor: {
        target: { provider: "huggingface", repository: target.repository, path: target.path, revision: target.revision },
        mediaType: "application/x-ndjson",
        sizeBytes: 20,
      },
    },
  }));

  const hasArtifactInRepo = testDouble.fn(async () => ({ ok: true as const, value: { exists: true } }));

  const prepareTrainingDataset = testDouble.fn(async (request) => {
    return {
      outputs: [
        {
          name: "dataset-train",
          role: "train",
          tempPath: runtimeTrain,
          mediaType: "application/x-ndjson",
          metadata: { stage: "generated-examples", generationMode: "qa" },
        },
        {
          name: "dataset-test",
          role: "test",
          tempPath: runtimeTest,
          mediaType: "application/x-ndjson",
          metadata: { stage: "generated-examples", generationMode: "qa" },
        },
      ],
      summary: {
        sourceDocumentCount: 1,
        normalizedDocumentCount: 1,
        skippedDocumentCount: 0,
        chunkCount: 1,
        generatedExampleCount: 2,
        trainRowCount: 1,
        testRowCount: 1,
      },
      request,
    };
  });

  return {
    readArtifactStorageBindings,
    retrieveArtifact,
    storeArtifact,
    storeArtifactInRepo,
    hasArtifactInRepo,
    prepareTrainingDataset,
  };
}

describe("PrepareTrainingDatasetFromArtifactsUseCase", () => {
  it("passes originalName to runtime source inputs and stores local outputs by default", async () => {
    const { runtimeTrain, runtimeTest } = await setupRuntimeOutputs();
    const deps = createDeps(runtimeTrain, runtimeTest);

    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTrainingDataset: deps.prepareTrainingDataset },
      storageBindings: {
        readArtifactStorageBindings: deps.readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact: deps.retrieveArtifact,
        storeArtifact: deps.storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      recipe,
      split,
      output: { format: "jsonl" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const runtimeRequest = deps.prepareTrainingDataset.mock.calls[0]?.[0];
    expect(runtimeRequest.sourceInputs[0]?.originalName).toBe("key-artifact-1.md");
    expect(runtimeRequest.runtime).toBeUndefined();
    expect(deps.storeArtifact).toHaveBeenCalledTimes(2);
    expect(result.value.outputs.local?.train.storage.key).toBe("stored-train");
    expect(result.value.outputs.huggingFace).toBeUndefined();
    expect((result.value as Record<string, unknown>).train).toBeUndefined();
    expect((result.value as Record<string, unknown>).localOutputs).toBeUndefined();
    expect(result.value.provenance.generationModelId).toBe("test-model");
    await expectFileMissing(runtimeTrain);
    await expectFileMissing(runtimeTest);
  });

  it("supports huggingface-only output destination", async () => {
    const { runtimeTrain, runtimeTest } = await setupRuntimeOutputs();
    const deps = createDeps(runtimeTrain, runtimeTest);

    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTrainingDataset: deps.prepareTrainingDataset },
      storageBindings: {
        readArtifactStorageBindings: deps.readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact: deps.retrieveArtifact,
        storeArtifact: deps.storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
      artifactRepoStorage: {
        storeArtifactInRepo: deps.storeArtifactInRepo,
        hasArtifactInRepo: deps.hasArtifactInRepo,
        retrieveArtifactFromRepo: testDouble.fn(),
      },
      now: () => "2026-04-20T00:00:00.000Z",
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      recipe,
      split,
      output: {
        format: "jsonl",
        destinations: {
          local: { enabled: false },
          huggingFace: { enabled: true, repository: "org/repo", pathPrefix: "datasets" },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(deps.storeArtifact).not.toHaveBeenCalled();
    expect(deps.storeArtifactInRepo).toHaveBeenCalledTimes(2);
    expect(result.value.outputs.local).toBeUndefined();
    expect(result.value.outputs.huggingFace?.train.path).toBe("datasets/dataset-train.jsonl");
    expect(result.value.outputs.huggingFace?.train.repository).toBe("org/repo");
    await expectFileMissing(runtimeTrain);
    await expectFileMissing(runtimeTest);
  });

  it("supports local + huggingface output destinations", async () => {
    const { runtimeTrain, runtimeTest } = await setupRuntimeOutputs();
    const deps = createDeps(runtimeTrain, runtimeTest);

    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTrainingDataset: deps.prepareTrainingDataset },
      storageBindings: {
        readArtifactStorageBindings: deps.readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact: deps.retrieveArtifact,
        storeArtifact: deps.storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
      artifactRepoStorage: {
        storeArtifactInRepo: deps.storeArtifactInRepo,
        hasArtifactInRepo: deps.hasArtifactInRepo,
        retrieveArtifactFromRepo: testDouble.fn(),
      },
      now: () => "2026-04-20T00:00:00.000Z",
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      recipe,
      split,
      output: {
        format: "jsonl",
        destinations: {
          local: { enabled: true },
          huggingFace: { enabled: true, repository: "org/repo" },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(deps.storeArtifact).toHaveBeenCalledTimes(2);
    expect(deps.storeArtifactInRepo).toHaveBeenCalledTimes(2);
    expect(result.value.outputs.local?.train.storage.key).toBe("stored-train");
    expect(result.value.outputs.huggingFace?.test.path).toBe("dataset-test.jsonl");
    expect(result.value.summary.trainRowCount).toBe(1);
    expect(result.value.provenance.output.destinations?.huggingFace?.repository).toBe("org/repo");
    const firstStoreMetadata = deps.storeArtifact.mock.calls[0]?.[0]?.descriptor?.metadata;
    expect(firstStoreMetadata).toMatchObject({
      sourceArtifactIds: ["artifact-1"],
      summary: { generatedExampleCount: 2 },
      destination: { provider: "local" },
      generationModel: { modelId: "test-model" },
    });
    await expectFileMissing(runtimeTrain);
    await expectFileMissing(runtimeTest);
  });

  it("fails without storing when runtime output is invalid JSONL", async () => {
    const { runtimeTrain, runtimeTest } = await setupRuntimeOutputs();
    await writeFile(runtimeTrain, "not-json\n", "utf-8");
    const deps = createDeps(runtimeTrain, runtimeTest);
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTrainingDataset: deps.prepareTrainingDataset },
      storageBindings: {
        readArtifactStorageBindings: deps.readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact: deps.retrieveArtifact,
        storeArtifact: deps.storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      recipe,
      split,
      output: { format: "jsonl" },
    });

    expect(result.ok).toBe(false);
    expect(deps.storeArtifact).not.toHaveBeenCalled();
    await expectFileMissing(runtimeTrain);
    await expectFileMissing(runtimeTest);
  });

  it("cleans runtime files on partial destination failure", async () => {
    const { runtimeTrain, runtimeTest } = await setupRuntimeOutputs();
    const deps = createDeps(runtimeTrain, runtimeTest);
    deps.storeArtifact.mockImplementationOnce(async () => ({
      ok: false as const,
      error: { code: "unavailable", message: "store failed" },
    }));
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTrainingDataset: deps.prepareTrainingDataset },
      storageBindings: {
        readArtifactStorageBindings: deps.readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact: deps.retrieveArtifact,
        storeArtifact: deps.storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      recipe,
      split,
      output: { format: "jsonl" },
    });

    expect(result.ok).toBe(false);
    await expectFileMissing(runtimeTrain);
    await expectFileMissing(runtimeTest);
  });

  it("returns mapped structured runtime contract errors", async () => {
    const { runtimeTrain, runtimeTest } = await setupRuntimeOutputs();
    const deps = createDeps(runtimeTrain, runtimeTest);
    deps.prepareTrainingDataset.mockImplementationOnce(async () => {
      throw new PythonDatasetPreparationError(
        createContractError("internal", "[generation] runtime timeout", {
          details: { stage: "generation", runtimeErrorCode: "runtime_timeout" },
        }),
      );
    });

    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTrainingDataset: deps.prepareTrainingDataset },
      storageBindings: {
        readArtifactStorageBindings: deps.readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact: deps.retrieveArtifact,
        storeArtifact: deps.storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      recipe,
      split,
      output: { format: "jsonl" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe("[generation] runtime timeout");
    expect(result.error.details).toMatchObject({ stage: "generation", runtimeErrorCode: "runtime_timeout" });
    await expectFileMissing(runtimeTrain);
    await expectFileMissing(runtimeTest);
  });
});
