import { describe, expect, it } from "bun:test";
import { HuggingFaceModelCatalog } from "../HuggingFaceModelCatalog";

describe("HuggingFaceModelCatalog", () => {
  it("maps search results into installable catalog items", async () => {
    const apiClient = {
      searchModels: async () => [
        { id: "org/model-a", author: "org", pipeline_tag: "text-generation", tags: ["license:mit"] },
      ],
      resolveDownloadFile: async () => ({ path: "model.safetensors", sizeBytes: 12, sha256: "abc", downloadUrl: "https://x" }),
      getModelInfo: async () => ({ id: "org/model-a", pipeline_tag: "text-generation", tags: ["language:en"] }),
    };

    const catalog = new HuggingFaceModelCatalog({ apiClient: apiClient as never });
    const result = await catalog.search({ query: "model" });
    expect(result.items.length).toBe(1);
    expect(result.items[0].provider).toBe("huggingface");
    expect(result.items[0].model.source.type).toBe("huggingface");
  });
});
