import { describe, expect, it } from "bun:test";
import { ComfyNodeCatalogProvider } from "../ComfyNodeCatalogProvider";

describe("ComfyNodeCatalogProvider", () => {
  const provider = new ComfyNodeCatalogProvider({
    KSampler: {
      category: "sampling",
      display_name: "K Sampler",
      input: {
        required: {
          model: ["MODEL"],
          steps: ["INT", { default: 10, min: 1 }],
        },
      },
      output: ["IMAGE"],
      output_name: ["image"],
    },
  });

  it("maps comfy object info into node definitions", async () => {
    const all = await provider.getAllDefinitions();
    expect(all.length).toBe(1);
    expect(all[0].type).toBe("KSampler");
    expect(all[0].inputPorts.length).toBe(1);
    expect(all[0].properties.length).toBe(1);
  });

  it("supports filtering and lookups", async () => {
    expect((await provider.searchDefinitions({ query: "sampler" })).length).toBe(1);
    expect((await provider.getDefinitionByType("ksampler"))?.id).toBe("KSampler");
    expect((await provider.getCategories())[0]).toBe("sampling");
  });
});
