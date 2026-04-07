import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { HuggingFaceModelDownloader } from "../HuggingFaceModelDownloader";

describe("huggingface interactions", () => {
  it("uses apiClient + fileStorage to complete download", async () => {
    const bytes = new TextEncoder().encode("weights");
    const sha = createHash("sha256").update(bytes).digest("hex");

    const downloader = new HuggingFaceModelDownloader({
      apiClient: {
        resolveDownloadFile: async () => ({ path: "weights.bin", downloadUrl: "https://x", sha256: sha }),
        downloadToBuffer: async () => bytes,
      } as never,
      fileStorage: { write: async () => undefined } as never,
    });

    const result = await downloader.download({
      destination: "/tmp/",
      model: { id: "m", kind: "generic", source: { type: "huggingface" }, artifact: { name: "a", accessMethod: "remote-download" } } as never,
      verifyIntegrity: true,
      overwrite: true,
    });

    expect(result.status).toBe("completed");
  });
});
