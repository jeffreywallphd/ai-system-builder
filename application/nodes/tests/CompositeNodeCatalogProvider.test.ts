import { describe, expect, it } from "bun:test";
import { CompositeNodeCatalogProvider } from "../CompositeNodeCatalogProvider";
import { makeNodeDefinition } from "../../ports/tests/testUtils";

describe("CompositeNodeCatalogProvider", () => {
  const text2img = makeNodeDefinition("n1", {
    title: "Text to Image",
    category: "generation",
    capabilities: { tasks: ["text-to-image"], runtimes: ["comfyui"], allowsAnyRuntime: false },
  });
  const modelAware = makeNodeDefinition("n2", {
    title: "Model Switch",
    category: "utility",
    properties: [{ bindingProfile: { isModelSelector: true, modalities: ["text"] } } as any],
    capabilities: { tasks: ["utility"], runtimes: ["vllm"], allowsAnyRuntime: true },
    isVisibleInBasicMode: false,
  });

  it("returns sorted definitions without mutating frozen arrays", async () => {
    const catalog = new CompositeNodeCatalogProvider({ definitions: [text2img, modelAware] });
    await expect(catalog.getAllDefinitions()).resolves.toEqual([modelAware, text2img]);
  });

  it("supports rich criteria filtering for single-definition catalogs", async () => {
    const catalog = new CompositeNodeCatalogProvider({ definitions: [modelAware] });

    expect((await catalog.searchDefinitions({ query: "model" })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ categories: ["utility"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ tasks: ["utility"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ runtimes: ["comfyui"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ modalities: ["text"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ basicModeOnly: true }))).toEqual([]);
    expect((await catalog.searchDefinitions({ modelAwareOnly: true })).map((d) => d.id)).toEqual(["n2"]);
  });

  it("gets by id/type, categories, and immutable with* operations", async () => {
    const base = new CompositeNodeCatalogProvider({ definitions: [text2img] });
    const withDef = base.withDefinition(modelAware);
    const withProv = base.withProvider({
      getAllDefinitions: async () => [modelAware],
      searchDefinitions: async () => [modelAware],
      getDefinitionById: async () => modelAware,
      getDefinitionByType: async () => modelAware,
      getCategories: async () => ["utility"],
    });

    expect((await base.getDefinitionByType(text2img.type))?.id).toBe("n1");
    expect((await base.getDefinitionById("N1"))?.id).toBe("n1");
    expect(await base.getCategories()).toEqual(["generation"]);
    expect(withDef).toBeInstanceOf(CompositeNodeCatalogProvider);
    expect(withProv).toBeInstanceOf(CompositeNodeCatalogProvider);
  });

  it("deduplicates aggregated definitions by favoring richer variants and preserves category listing", async () => {
    const duplicate = makeNodeDefinition("n1", {
      title: "Text to Image (Legacy)",
      category: "generation",
      isVisibleInBasicMode: false,
    });
    const utility = makeNodeDefinition("n3", {
      title: "Cleanup",
      category: "utility",
    });

    const catalog = new CompositeNodeCatalogProvider({
      definitions: [duplicate],
      providers: [
        {
          getAllDefinitions: async () => [text2img, utility],
          searchDefinitions: async () => [],
          getDefinitionById: async () => undefined,
          getDefinitionByType: async () => undefined,
          getCategories: async () => ["generation", "utility"],
        },
      ],
    });

    await expect(catalog.getAllDefinitions()).resolves.toEqual([utility, text2img]);
    await expect(catalog.getCategories()).resolves.toEqual(["generation", "utility"]);
  });
});
