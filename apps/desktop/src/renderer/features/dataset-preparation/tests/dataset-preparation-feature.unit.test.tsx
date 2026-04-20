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
    const prepareTemplatedDatasetFromArtifacts = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      return {
        ok: true,
        value: {
          train: { sourceKind: "runtime", storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 8 } },
          test: { sourceKind: "runtime", storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 2 } },
          trainRowCount: 8,
          testRowCount: 2,
        },
      };
    });

    window.desktopApi = {
      browseArtifacts: vi.fn().mockResolvedValue({
        ok: true,
        value: { items: [{ storageKey: "artifact-1", artifactFamily: "structured-text", originalName: "artifact-1.jsonl" }] },
      }),
      uploadArtifact: async () => ({ ok: false }),
      getArtifactUploadPolicy: async () => ({ ok: false }),
      readArtifactDetail: async () => ({ ok: false }),
      readArtifactContentDescriptor: async () => ({ ok: false }),
      readArtifactViewerMedia: async () => ({ ok: false }),
      publishArtifactToRepo: async () => ({ ok: false }),
      verifyPublishedArtifactBacking: async () => ({ ok: false }),
      registerArtifactFromRepo: async () => ({ ok: false }),
      localizeArtifactFromRepo: async () => ({ ok: false }),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          client={{ prepareTemplatedDatasetFromArtifacts }}
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

    expect(prepareTemplatedDatasetFromArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      sourceArtifactIds: ["artifact-1"],
      outputFormat: "jsonl",
    }));
    expect(container.textContent).toContain("stored-train");
    expect(container.textContent).toContain("stored-test");
  });

  it("shows error state when preparation fails", async () => {
    window.desktopApi = {
      browseArtifacts: vi.fn().mockResolvedValue({
        ok: true,
        value: { items: [{ storageKey: "artifact-1", artifactFamily: "structured-text", originalName: "artifact-1.jsonl" }] },
      }),
      uploadArtifact: async () => ({ ok: false }),
      getArtifactUploadPolicy: async () => ({ ok: false }),
      readArtifactDetail: async () => ({ ok: false }),
      readArtifactContentDescriptor: async () => ({ ok: false }),
      readArtifactViewerMedia: async () => ({ ok: false }),
      publishArtifactToRepo: async () => ({ ok: false }),
      verifyPublishedArtifactBacking: async () => ({ ok: false }),
      registerArtifactFromRepo: async () => ({ ok: false }),
      localizeArtifactFromRepo: async () => ({ ok: false }),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <DatasetPreparationFeature
          client={{ prepareTemplatedDatasetFromArtifacts: async () => ({ ok: false, error: { code: "internal", message: "failed" } }) }}
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
