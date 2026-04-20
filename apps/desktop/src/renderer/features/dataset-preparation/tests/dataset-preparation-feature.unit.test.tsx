import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatasetPreparationFeature } from "../components/DatasetPreparationFeature";

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
            output: { format: "jsonl" },
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

    expect(prepareTrainingDatasetFromArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      sourceArtifactIds: ["artifact-1"],
      output: { format: "jsonl" },
    }), expect.objectContaining({
      requestId: expect.stringMatching(/^dataset-preparation-/),
    }));
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


});
