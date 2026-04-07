import { describe, expect, it, mock } from "bun:test";
import { BrowserHuggingFaceModelDownloader } from "../BrowserHuggingFaceModelDownloader";
import { makeModel } from "../../../../src/domain/services/tests/testUtils";

describe("BrowserHuggingFaceModelDownloader", () => {
  it("downloads the selected artifact through the browser and reports size", async () => {
    const clicks: string[] = [];
    const appendChild = mock(() => undefined);
    const removeChild = mock(() => undefined);

    const originalDocument = globalThis.document;
    const originalUrl = globalThis.URL;

    Object.assign(globalThis, {
      document: {
        body: { appendChild, removeChild },
        createElement: () => ({
          click: () => clicks.push("clicked"),
          style: {},
        }),
      },
      URL: {
        createObjectURL: () => "blob:test",
        revokeObjectURL: () => undefined,
      },
    });

    try {
      const downloader = new BrowserHuggingFaceModelDownloader({
        apiClient: {
          listModelFiles: async () => [
            {
              path: "weights/model.safetensors",
              sizeBytes: 3,
              sha256: undefined,
              downloadUrl: "https://example.test/model.safetensors",
            },
          ],
          downloadToBuffer: async () => new Uint8Array([1, 2, 3]),
        } as never,
      });

      const model = makeModel("model-1", {
        source: { type: "huggingface", repository: "org/model-1" },
        artifact: {
          name: "weights/model.safetensors",
          accessMethod: "remote-download",
          location: "weights/model.safetensors",
          format: "safetensors",
        },
      } as never);

      const result = await downloader.download({
        model,
        destination: "downloads/model-1",
        source: { provider: "huggingface", repository: "org/model-1" },
      });

      expect(result.status).toBe("completed");
      expect(result.sizeBytes).toBe(3);
      expect(result.destination).toBe("downloads/model-1/model.safetensors");
      expect(clicks).toEqual(["clicked"]);
      expect(appendChild).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalled();
    } finally {
      Object.assign(globalThis, { document: originalDocument, URL: originalUrl });
    }
  });
});
