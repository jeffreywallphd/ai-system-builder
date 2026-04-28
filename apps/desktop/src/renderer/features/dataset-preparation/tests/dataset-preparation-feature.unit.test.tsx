import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatasetPreparationFeature } from "../components/DatasetPreparationFeature";
import { resetDatasetPreparationPageStateForTests } from "../hooks/useDatasetPreparationFeature";

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
    resetDatasetPreparationPageStateForTests();
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
              dataset: { sourceKind: "runtime", storage: { key: "stored-dataset", mediaType: "application/x-ndjson", sizeBytes: 10 } },
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
              datasetRowCount: 10,
              trainRowCount: 10,
              testRowCount: 0,
            },
          },
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            datasetRowCount: 10,
            trainRowCount: 10,
            testRowCount: 0,
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Dataset preparation model defaults");
    const modelOverridesToggle = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Model override defaults"));
    await act(async () => {
      modelOverridesToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
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
    expect(container.textContent).toContain("stored-dataset");
  });

  it("shows error state when preparation fails", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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

  it("uses default Hugging Face namespace when only dataset repository name is provided", async () => {
    settingsClient.readSettings.mockResolvedValueOnce({
      values: [{ key: "huggingface.defaultNamespace", value: "OpenFinAL" }],
    });
    const prepareTrainingDatasetFromArtifacts = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        outputs: {},
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
            chunkCount: 1,
            generatedExampleCount: 1,
            datasetRowCount: 1,
            trainRowCount: 1,
            testRowCount: 0,
          },
        },
        summary: {
          sourceDocumentCount: 1,
          normalizedDocumentCount: 1,
          skippedDocumentCount: 0,
          chunkCount: 1,
          generatedExampleCount: 1,
          datasetRowCount: 1,
          trainRowCount: 1,
          testRowCount: 0,
        },
      },
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={settingsClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    const sourceCheckbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      sourceCheckbox.click();
    });

    const publishCheckbox = Array.from(container.querySelectorAll("input[type='checkbox']"))
      .find((input) => (input.parentElement?.textContent ?? "").includes("Publish to Hugging Face")) as HTMLInputElement;
    await act(async () => {
      publishCheckbox.click();
    });

    const repositoryInput = container.querySelector("input[placeholder='your-dataset-repo']") as HTMLInputElement;
    await act(async () => {
      repositoryInput.value = "AISysBuilderTest";
      repositoryInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Namespace: OpenFinAL");
    expect(prepareTrainingDatasetFromArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      output: expect.objectContaining({
        destinations: expect.objectContaining({
          huggingFace: expect.objectContaining({
            repository: "OpenFinAL/AISysBuilderTest",
          }),
        }),
      }),
    }), expect.any(Object));
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
        loadedModels: [],
        activeTaskCount: 1,
        logs: [{
          timestamp: new Date(Date.now() + 1_000).toISOString(),
          level: "warn",
          message: "Python runtime stderr: Fetching 14 files: 43%|####2 | 6/14 [00:00<00:00, 11.15it/s]",
        }],
      }),
      controlRuntime: vi.fn(),
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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
              dataset: { sourceKind: "runtime", storage: { key: "stored-dataset", mediaType: "application/x-ndjson", sizeBytes: 10 } },
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
              datasetRowCount: 10,
              trainRowCount: 10,
              testRowCount: 0,
            },
          },
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            datasetRowCount: 10,
            trainRowCount: 10,
            testRowCount: 0,
          },
        },
      });
      await Promise.resolve();
    });
  });

  it("shows stop training while preparation is active and stops the Python runtime", async () => {
    let rejectPreparation: ((error: Error) => void) | undefined;
    const prepareTrainingDatasetFromArtifacts = vi.fn(() => new Promise<any>((_resolve, reject) => {
      rejectPreparation = reject;
    }));
    const runtimeStatusClient = {
      readStatus: vi.fn().mockResolvedValue({
        supervisorStatus: "ready",
        healthy: true,
        runtimeStatus: "ready",
        capabilities: ["prepare-training-dataset"],
        loadedModels: [],
        activeTaskCount: 1,
        logs: [],
      }),
      controlRuntime: vi.fn().mockResolvedValue({
        supervisorStatus: "stopped",
        healthy: false,
        runtimeStatus: "stopped",
        capabilities: [],
        loadedModels: [],
        activeTaskCount: 0,
        logs: [],
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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

    expect(container.textContent).toContain("Stop training");

    const stopButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Stop training") as HTMLButtonElement;
    await act(async () => {
      stopButton.click();
      await Promise.resolve();
    });

    expect(runtimeStatusClient.controlRuntime).toHaveBeenCalledWith("stop");

    await act(async () => {
      rejectPreparation?.(new Error("runtime stopped"));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Training stopped.");
  });

  it("keeps loading status when transport fails but runtime task is still active", async () => {
    const runtimeStatusClient = {
      readStatus: vi.fn().mockResolvedValue({
        supervisorStatus: "ready",
        healthy: true,
        runtimeStatus: "ready",
        capabilities: ["prepare-training-dataset"],
        loadedModels: [],
        activeTaskCount: 1,
        logs: [],
      }),
      controlRuntime: vi.fn(),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          runtimeStatusClient={runtimeStatusClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts: async () => {
              throw new Error("fetch failed");
            },
          }}
        />,
      );
      await Promise.resolve();
    });

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("still running in the background");
    expect(container.textContent).toContain("Tracking Python runtime progress");
    expect(container.textContent).not.toContain("fetch failed");
  });

  it("retains in-progress status and locks form controls across remounts", async () => {
    let resolvePreparation: ((value: { ok: true; value: any }) => void) | undefined;
    const prepareTrainingDatasetFromArtifacts = vi.fn(() => new Promise<{ ok: true; value: any }>((resolve) => {
      resolvePreparation = resolve;
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={settingsClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
    });

    const modelOverridesToggle = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Model override defaults")) as HTMLButtonElement;
    await act(async () => {
      modelOverridesToggle.click();
    });
    expect(container.textContent).toContain("Inference mode");

    const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Stop training");
    expect(container.querySelector("fieldset")?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      root?.unmount();
    });
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          settingsClient={settingsClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts,
          }}
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Checking model");
    expect(container.textContent).toContain("Stop training");
    expect(container.querySelector("fieldset")?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      resolvePreparation?.({
        ok: true,
        value: {
          outputs: {
            local: {
              dataset: { sourceKind: "runtime", storage: { key: "stored-dataset", mediaType: "application/x-ndjson", sizeBytes: 10 } },
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
              datasetRowCount: 10,
              trainRowCount: 10,
              testRowCount: 0,
            },
          },
          summary: {
            sourceDocumentCount: 1,
            normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            datasetRowCount: 10,
            trainRowCount: 10,
            testRowCount: 0,
          },
        },
      });
      await Promise.resolve();
    });
  });

  it("shows reconnecting status after progress poll failure and recovers chunk progress updates", async () => {
    vi.useFakeTimers();
    let resolvePreparation: ((value: { ok: true; value: any }) => void) | undefined;
    const prepareTrainingDatasetFromArtifacts = vi.fn(() => new Promise<{ ok: true; value: any }>((resolve) => {
      resolvePreparation = resolve;
    }));
    const runtimeStatusClient = {
      readStatus: vi.fn()
        .mockResolvedValueOnce({
          supervisorStatus: "ready",
          healthy: true,
          runtimeStatus: "ready",
          capabilities: ["prepare-training-dataset"],
          loadedModels: [],
          activeTaskCount: 0,
          logs: [],
        })
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValue({
          supervisorStatus: "ready",
          healthy: true,
          runtimeStatus: "ready",
          capabilities: ["prepare-training-dataset"],
          loadedModels: [],
          activeTaskCount: 1,
          logs: [{
            timestamp: new Date().toISOString(),
            level: "info" as const,
            message: "{\"event\":\"runtime.dataset_preparation.generation.progress\",\"processedChunkCount\":1,\"totalChunkCount\":4}",
          }],
        }),
      controlRuntime: vi.fn(),
    };

    try {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);

      await act(async () => {
        root?.render(
          <DatasetPreparationFeature
            runtimeStatusClient={runtimeStatusClient}
            client={{
              browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
              prepareTrainingDatasetFromArtifacts,
            }}
          />,
        );
        await Promise.resolve();
      });

      const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
      await act(async () => {
        checkbox.click();
      });
      const form = container.querySelector("form") as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      expect(container.textContent).toContain("Reconnecting to progress monitor...");

      await act(async () => {
        vi.advanceTimersByTime(800);
        await Promise.resolve();
      });
      expect(container.textContent).toContain("Processing chunk 2/4...");

      await act(async () => {
        resolvePreparation?.({
          ok: true,
          value: {
            outputs: {},
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
                chunkCount: 4,
                generatedExampleCount: 4,
                datasetRowCount: 4,
                trainRowCount: 3,
                testRowCount: 1,
              },
            },
            summary: {
              sourceDocumentCount: 1,
              normalizedDocumentCount: 1,
              skippedDocumentCount: 0,
              chunkCount: 4,
              generatedExampleCount: 4,
              datasetRowCount: 4,
              trainRowCount: 3,
              testRowCount: 1,
            },
          },
        });
        await Promise.resolve();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows unload model when a model is loaded and no training is active", async () => {
    const runtimeStatusClient = {
      readStatus: vi.fn().mockResolvedValue({
        supervisorStatus: "ready",
        healthy: true,
        runtimeStatus: "ready",
        capabilities: ["prepare-training-dataset", "unload-model"],
        loadedModels: [{
          provider: "transformers" as const,
          modelId: "google/flan-t5-base",
          inferenceMode: "text2text" as const,
          localPath: "/models/google/flan-t5-base",
        }],
        activeTaskCount: 0,
        logs: [],
      }),
      controlRuntime: vi.fn().mockResolvedValue({
        supervisorStatus: "ready",
        healthy: true,
        runtimeStatus: "ready",
        capabilities: ["prepare-training-dataset", "unload-model"],
        loadedModels: [],
        activeTaskCount: 0,
        logs: [],
      }),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          runtimeStatusClient={runtimeStatusClient}
          client={{
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
            prepareTrainingDatasetFromArtifacts: async () => ({ ok: false, error: { code: "internal", message: "failed" } }),
          }}
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Unload model");

    const unloadButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Unload model") as HTMLButtonElement;
    await act(async () => {
      unloadButton.click();
      await Promise.resolve();
    });

    expect(runtimeStatusClient.controlRuntime).toHaveBeenCalledWith("unload-model");
    expect(container.textContent).toContain("Model unloaded from memory.");
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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
              dataset: { sourceKind: "runtime", storage: { key: "stored-dataset", mediaType: "application/x-ndjson", sizeBytes: 10 } },
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
              datasetRowCount: 10,
              trainRowCount: 10,
              testRowCount: 0,
          },
        },
        summary: {
          sourceDocumentCount: 1,
          normalizedDocumentCount: 1,
            skippedDocumentCount: 0,
            chunkCount: 2,
            generatedExampleCount: 10,
            datasetRowCount: 10,
            trainRowCount: 10,
            testRowCount: 0,
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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
            browseSourceArtifacts: async () => [{ artifactId: "artifact-1", label: "artifact-1.jsonl", storageKey: "uploads/artifact-1.jsonl" }],
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
