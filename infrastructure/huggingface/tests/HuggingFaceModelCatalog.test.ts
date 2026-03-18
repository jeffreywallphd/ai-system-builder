import { describe, expect, it } from "bun:test";
import { HuggingFaceModelCatalog } from "../HuggingFaceModelCatalog";

describe("HuggingFaceModelCatalog", () => {
  it("maps search results into installable catalog items with repository files", async () => {
    const apiClient = {
      searchModels: async () => [
        { id: "org/model-a", author: "org", pipeline_tag: "text-generation", tags: ["license:mit"] },
      ],
      getModelInfo: async () => ({
        id: "org/model-a",
        author: "org",
        sha: "main",
        pipeline_tag: "text-generation",
        tags: ["language:en"],
      }),
      listModelFiles: async () => [
        { path: "weights/model.safetensors", sizeBytes: 12, sha256: "abc", downloadUrl: "https://x/model.safetensors" },
        { path: "config.json", sizeBytes: 2, sha256: undefined, downloadUrl: "https://x/config.json" },
      ],
    };

    const catalog = new HuggingFaceModelCatalog({ apiClient: apiClient as never });
    const result = await catalog.search({ query: "model" });
    expect(result.items.length).toBe(1);
    expect(result.items[0].provider).toBe("huggingface");
    expect(result.items[0].model.source.type).toBe("huggingface");
    expect(result.items[0].model.artifact.location).toBe("weights/model.safetensors");
    expect(result.items[0].model.additionalArtifacts.map((artifact) => artifact.location)).toEqual([
      "config.json",
    ]);
  });
});
