import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, testDouble } from "../../../testing/node-test";
import {
  PrepareTemplatedDatasetFromArtifactsUseCase,
} from "../prepare-templated-dataset-from-artifacts.use-case";

describe("PrepareTemplatedDatasetFromArtifactsUseCase", () => {
  it("resolves source artifacts, invokes runtime dataset preparation, and stores runtime outputs", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "dataset-use-case-test-"));
    const runtimeTrain = join(tempDir, "train.jsonl");
    const runtimeTest = join(tempDir, "test.jsonl");

    await writeFile(runtimeTrain, '{"text":"train"}\n', "utf-8");
    await writeFile(runtimeTest, '{"text":"test"}\n', "utf-8");

    const readArtifactStorageBindings = testDouble.fn(async ({ artifactId }: { artifactId: string }) => ({
      ok: true as const,
      value: {
        bindings: [{
          artifactId,
          storage: {
            key: `key-${artifactId}`,
            storageKind: "filesystem",
            providerId: "local",
          },
        }],
      },
    }));

    const retrieveArtifact = testDouble.fn(async () => ({
      ok: true as const,
      value: {
        descriptor: { key: "key-artifact-1", mediaType: "application/x-ndjson" },
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

    const prepareTemplatedDataset = testDouble.fn(async (request) => {
      expect(request.sourceInputs[0]?.artifactId).toBe("artifact-1");
      return {
        outputs: [
          { name: "dataset-train", role: "train", tempPath: runtimeTrain, mediaType: "application/x-ndjson" },
          { name: "dataset-test", role: "test", tempPath: runtimeTest, mediaType: "application/x-ndjson" },
        ],
        trainRowCount: 1,
        testRowCount: 1,
      };
    });

    const useCase = new PrepareTemplatedDatasetFromArtifactsUseCase({
      datasetPreparation: { prepareTemplatedDataset },
      storageBindings: {
        readArtifactStorageBindings,
        upsertArtifactStorageBinding: testDouble.fn(),
        deleteArtifactStorageBindings: testDouble.fn(),
      },
      storage: {
        retrieveArtifact,
        storeArtifact,
        hasArtifact: testDouble.fn(),
        deleteArtifact: testDouble.fn(),
      },
    });

    const result = await useCase.execute({
      sourceArtifactIds: ["artifact-1"],
      template: "Prompt: {{text}}",
      split: { trainRatio: 0.5, testRatio: 0.5 },
      outputFormat: "jsonl",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(prepareTemplatedDataset).toHaveBeenCalledOnce();
    expect(storeArtifact).toHaveBeenCalledTimes(2);
    expect(result.value.train.storage.key).toBe("stored-train");
    expect(result.value.test.storage.key).toBe("stored-test");
  });
});
