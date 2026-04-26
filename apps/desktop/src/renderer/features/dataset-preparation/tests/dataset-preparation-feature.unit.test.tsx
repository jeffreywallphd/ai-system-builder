import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatasetPreparationFeature } from "../components/DatasetPreparationFeature";

const settingsClient = {
  listDefinitions: vi.fn(),
  readSettings: vi.fn().mockResolvedValue({ values: [] }),
  updateSetting: vi.fn(),
  clearSetting: vi.fn(),
  resolveModelDefault: vi.fn().mockResolvedValue({
    resolved: {
      provider: "transformers",
      modelId: "google/flan-t5-base",
      inferenceMode: "text2text",
      source: "global",
      device: "auto",
    },
  }),
};

describe("DatasetPreparationFeature", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
    delete window.desktopApi;
  });

  it("constructs request, shows loading, and renders success output summary", async () => {
    const prepareTrainingDatasetFromArtifacts = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      return {
        ok: true,
        value: {
          outputs: {
            local: {
              train: { sourceKind: "runtime", storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 8 } },
              test: { sourceKind: "runtime", storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 2 } },
            },
          },
          provenance: {
            sourceArtifactIds: ["artifact-1"],
            recipe: {
              normalization: { targetFormat: "markdown" },
              chunking: { strategy: "character", chunkSize: 1_000, chunkOverlap: 200 },
              generation: { mode: "qa", model: { provider: "transformers", modelId: "Qwen/Qwen2.5-1.5B-Instruct" } },
            },
            split: { trainRatio: 0.8, testRatio: 0.2, shuffle: true },
            output: { format: "parquet" },
            generationModelId: "Qwen/Qwen2.5-1.5B-Instruct",
            summary: {
              sourceDocumentCount: 1,
              normalizedDocumentCount: 1,
              skippedDocumentCount: 0,
              chunkCount: 2,
              generatedExampleCount: 10,
              trainRowCount: 8,
              testRowCount: 2,
            },
          },
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            trainRowCount: 8,
            testRowCount: 2,
          },
        },
      };
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={settingsClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Dataset preparation model defaults");
    expect(container.textContent).toContain("Inference mode");

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(prepareTrainingDatasetFromArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      sourceArtifactIds: ["artifact-1"],
      recipe: {
        normalization: {
          targetFormat: "markdown",
          normalizationMode: undefined,
          unsupportedDocumentPolicy: undefined,
        },
        chunking: {
          strategy: "character",
          chunkSize: 1000,
          chunkOverlap: 200,
          preserveDocumentBoundaries: true,
          maxChunkCount: undefined,
        },
        generation: {
          mode: "qa",
            model: {
              provider: "transformers",
              modelId: "google/flan-t5-base",
              inferenceMode: "text2text",
              device: "auto",
              torchDtype: undefined,
            },
          maxExamplesPerChunk: 4,
          batchSize: 4,
          failurePolicy: "skip",
          generationParams: {
            temperature: undefined,
            topP: undefined,
            maxNewTokens: undefined,
          },
        },
      },
      output: {
        format: "parquet",
        naming: { baseName: undefined },
        destinations: {
          local: { enabled: true },
          huggingFace: undefined,
        },
      },
    }), expect.objectContaining({
      requestId: expect.stringMatching(/^dataset-preparation-/),
    }));
    expect(settingsClient.resolveModelDefault).toHaveBeenCalled();
    expect(container.textContent).toContain("stored-train");
    expect(container.textContent).toContain("stored-test");
  });

  it("shows error state when preparation fails", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts: async () => ({ ok: false, error: { code: "internal", message: "failed" } }),
          }}
        />,
      );
    });

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("failed");
  });

  it("shows model download progress from Python runtime logs while preparation is running", async () => {
    let resolvePreparation: ((value: { ok: true; value: any }) => void) | undefined;
    const prepareTrainingDatasetFromArtifacts = vi.fn(() => new Promise<{ ok: true; value: any }>((resolve) => {
      resolvePreparation = resolve;
    }));
    const runtimeStatusClient = {
      readStatus: vi.fn().mockResolvedValue({
        supervisorStatus: "ready",
        healthy: true,
        runtimeStatus: "ready",
        capabilities: ["prepare-training-dataset"],
        logs: [{
          timestamp: new Date(Date.now() + 1_000).toISOString(),
          level: "warn",
          message: "Python runtime stderr: Fetching 14 files: 43%|####2 | 6/14 [00:00<00:00, 11.15it/s]",
        }],
      }),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={settingsClient}
          runtimeStatusClient={runtimeStatusClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Downloading model google/flan-t5-base: 43% (6/14 files).");

    await act(async () => {
      resolvePreparation?.({
        ok: true,
        value: {
          outputs: {
            local: {
              train: { sourceKind: "runtime", storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 8 } },
              test: { sourceKind: "runtime", storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 2 } },
            },
          },
          provenance: {
            sourceArtifactIds: ["artifact-1"],
            recipe: {
              normalization: { targetFormat: "markdown" },
              chunking: { strategy: "character", chunkSize: 1_000, chunkOverlap: 200 },
              generation: { mode: "qa", model: { provider: "transformers", modelId: "google/flan-t5-base" } },
            },
            split: { trainRatio: 0.8, testRatio: 0.2, shuffle: true },
            output: { format: "parquet" },
            generationModelId: "google/flan-t5-base",
            summary: {
              sourceDocumentCount: 1,
              normalizedDocumentCount: 1,
              skippedDocumentCount: 0,
              chunkCount: 2,
              generatedExampleCount: 10,
              trainRowCount: 8,
              testRowCount: 2,
            },
          },
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            trainRowCount: 8,
            testRowCount: 2,
          },
        },
      });
      await Promise.resolve();
    });
  });

  it("surfaces warning when model default settings resolution fails", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={{
            ...settingsClient,
            resolveModelDefault: vi.fn().mockRejectedValue(new Error("settings failed")),
          }}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts: async () => ({ ok: false, error: { code: "internal", message: "failed" } }),
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Using built-in model defaults because settings could not be loaded.");
  });

  it("surfaces warning when Hugging Face namespace settings cannot be read", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={{
            ...settingsClient,
            readSettings: vi.fn().mockRejectedValue(new Error("read failed")),
          }}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts: async () => ({ ok: false, error: { code: "internal", message: "failed" } }),
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Hugging Face namespace default could not be loaded.");
  });

  it("keeps submit behavior stable when rerendered with a new options object shape", async () => {
    const prepareTrainingDatasetFromArtifacts = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        outputs: {
          local: {
            train: { sourceKind: "runtime", storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 8 } },
            test: { sourceKind: "runtime", storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 2 } },
          },
        },
        provenance: {
          sourceArtifactIds: ["artifact-1"],
          recipe: {
            normalization: { targetFormat: "markdown" },
            chunking: { strategy: "character", chunkSize: 1_000, chunkOverlap: 200 },
            generation: { mode: "qa", model: { provider: "transformers", modelId: "Qwen/Qwen2.5-1.5B-Instruct" } },
          },
          split: { trainRatio: 0.8, testRatio: 0.2, shuffle: true },
          output: { format: "parquet" },
          generationModelId: "Qwen/Qwen2.5-1.5B-Instruct",
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            trainRowCount: 8,
            testRowCount: 2,
          },
        },
        summary: {
          sourceDocumentCount: 1,
          normalizedDocumentCount: 1,
          skippedDocumentCount: 0,
          chunkCount: 2,
          generatedExampleCount: 10,
          trainRowCount: 8,
          testRowCount: 2,
        },
      },
    });
    const onPrepared = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          onPrepared={onPrepared}
          settingsClient={settingsClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          onPrepared={onPrepared}
          settingsClient={settingsClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(prepareTrainingDatasetFromArtifacts).toHaveBeenCalledTimes(1);
    expect(onPrepared).toHaveBeenCalledTimes(1);
  });
});
