import { describe, expect, it } from "bun:test";
import { NodeCatalogProvider } from "../NodeCatalogProvider";
import { makeNodeDefinition } from "./testUtils";

describe("NodeCatalogProvider", () => {
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

  it("currently throws when sorting deduped frozen definitions (regression coverage)", async () => {
    const catalog = new NodeCatalogProvider({ definitions: [text2img, modelAware] });
    expect(catalog.getAllDefinitions()).rejects.toThrow("readonly property");
  });

  it("supports rich criteria filtering for single-definition catalogs", async () => {
    const catalog = new NodeCatalogProvider({ definitions: [modelAware] });

    expect((await catalog.searchDefinitions({ query: "model" })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ categories: ["utility"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ tasks: ["utility"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ runtimes: ["comfyui"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ modalities: ["text"] })).map((d) => d.id)).toEqual(["n2"]);
    expect((await catalog.searchDefinitions({ basicModeOnly: true }))).toEqual([]);
    expect((await catalog.searchDefinitions({ modelAwareOnly: true })).map((d) => d.id)).toEqual(["n2"]);
  });

  it("gets by id/type, categories, and immutable with* operations", async () => {
    const base = new NodeCatalogProvider({ definitions: [text2img] });
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
    expect(withDef).toBeInstanceOf(NodeCatalogProvider);
    expect(withProv).toBeInstanceOf(NodeCatalogProvider);
  });
});
