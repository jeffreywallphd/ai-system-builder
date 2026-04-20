import { describe, expect, it, vi } from "vitest";

import { createDesktopDatasetPreparationClient } from "../api/desktopDatasetPreparationClient";

describe("desktop dataset preparation client", () => {
  it("maps success response from preload bridge", async () => {
    const hostWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
    hostWindow.window ??= {} as Window & typeof globalThis;
    const prepareTemplatedDatasetFromArtifacts = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        result: {
          train: { sourceKind: "runtime", storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 8 } },
          test: { sourceKind: "runtime", storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 2 } },
          trainRowCount: 8,
          testRowCount: 2,
        },
      },
    });

    hostWindow.window.desktopApi = {
      uploadArtifact: async () => ({ ok: false }),
      getArtifactUploadPolicy: async () => ({ ok: false }),
      browseArtifacts: async () => ({ ok: true, value: { items: [{ artifactId: "artifact-1", storageKey: "stored/a1.jsonl", artifactFamily: "structured-text" }] } }),
      readArtifactDetail: async () => ({ ok: false }),
      readArtifactContentDescriptor: async () => ({ ok: false }),
      readArtifactViewerMedia: async () => ({ ok: false }),
      publishArtifactToRepo: async () => ({ ok: false }),
      verifyPublishedArtifactBacking: async () => ({ ok: false }),
      registerArtifactFromRepo: async () => ({ ok: false }),
      localizeArtifactFromRepo: async () => ({ ok: false }),
      prepareTemplatedDatasetFromArtifacts,
    };

    const client = createDesktopDatasetPreparationClient();
    const browseResult = await client.browseSourceArtifacts();
    const response = await client.prepareTemplatedDatasetFromArtifacts({
      sourceArtifactIds: ["artifact-1"],
      template: "Prompt: {{text}}",
      split: { trainRatio: 0.8, testRatio: 0.2 },
      outputFormat: "jsonl",
    }, {
      requestId: "req-123",
    });

    expect(browseResult).toEqual([{ artifactId: "artifact-1", storageKey: "stored/a1.jsonl", label: "stored/a1.jsonl" }]);
    expect(response.ok).toBe(true);
    expect(prepareTemplatedDatasetFromArtifacts).toHaveBeenCalledWith(expect.any(Object), { requestId: "req-123" });
  });

  it("maps failure response from preload bridge", async () => {
    const hostWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
    hostWindow.window ??= {} as Window & typeof globalThis;
    hostWindow.window.desktopApi = {
      uploadArtifact: async () => ({ ok: false }),
      getArtifactUploadPolicy: async () => ({ ok: false }),
      browseArtifacts: async () => ({ ok: true, value: { items: [] } }),
      readArtifactDetail: async () => ({ ok: false }),
      readArtifactContentDescriptor: async () => ({ ok: false }),
      readArtifactViewerMedia: async () => ({ ok: false }),
      publishArtifactToRepo: async () => ({ ok: false }),
      verifyPublishedArtifactBacking: async () => ({ ok: false }),
      registerArtifactFromRepo: async () => ({ ok: false }),
      localizeArtifactFromRepo: async () => ({ ok: false }),
      prepareTemplatedDatasetFromArtifacts: async () => ({ ok: false, error: { code: "validation", message: "bad input" } }),
    };

    const client = createDesktopDatasetPreparationClient();
    const response = await client.prepareTemplatedDatasetFromArtifacts({
      sourceArtifactIds: [],
      template: "",
      split: { trainRatio: 0.8, testRatio: 0.2 },
      outputFormat: "jsonl",
    });

    expect(response).toEqual({
      ok: false,
      error: { code: "validation", message: "bad input" },
    });
  });
});
