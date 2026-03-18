import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";

function createProvider(): ImplementationRegistryNodeCatalogProvider {
  return new ImplementationRegistryNodeCatalogProvider(
    new LangChainNodeImplementationRegistry()
  );
}

describe("LangChain node catalog definitions", () => {
  it("provides meaningful descriptions and workflow ports", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    expect(definitions.length).toBeGreaterThan(0);

    for (const definition of definitions) {
      expect(definition.description).toBeTruthy();
      expect(definition.description).not.toContain("Auto-registered from");
      expect(
        definition.inputPorts.length > 0 || definition.outputPorts.length > 0
      ).toBeTrue();
    }
  });

  it("maps known langchain nodes to expected workflow connectivity", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const prompt = definitions.find((definition) => definition.type === "langchain.prompt-template");
    const splitter = definitions.find((definition) => definition.type === "langchain.text-splitter");
    const parser = definitions.find((definition) => definition.type === "langchain.output-parser");
    const retrieval = definitions.find((definition) => definition.type === "langchain.retrieval-query");

    expect(prompt?.outputPorts.some((port) => port.id === "prompt")).toBeTrue();
    expect(splitter?.inputPorts.some((port) => port.id === "text")).toBeTrue();
    expect(splitter?.outputPorts.some((port) => port.id === "chunks")).toBeTrue();
    expect(parser?.inputPorts.some((port) => port.id === "output")).toBeTrue();
    expect(parser?.outputPorts.some((port) => port.id === "parsed")).toBeTrue();
    expect(retrieval?.outputPorts.some((port) => port.id === "matches")).toBeTrue();
  });

  it("adds configurable properties for core and newly added langchain nodes", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const expectsPropertiesFor = [
      "langchain.document-to-chunks",
      "langchain.chat-prompt",
      "langchain.simple-chain",
      "langchain.context-merger",
      "langchain.embedding-generator",
      "langchain.vector-store-upsert",
      "langchain.retrieval-query",
      "langchain.reranker",
      "langchain.answer-synthesizer",
    ];

    for (const type of expectsPropertiesFor) {
      const definition = definitions.find((item) => item.type === type);
      expect(definition).toBeDefined();
      expect(definition?.properties.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("captures range metadata and recommended defaults for ranged properties", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const simpleChain = definitions.find((definition) => definition.type === "langchain.simple-chain");
    const temperature = simpleChain?.properties.find((property) => property.id === "temperature");
    const maxTokens = simpleChain?.properties.find((property) => property.id === "max-tokens");
    const chunker = definitions.find((definition) => definition.type === "langchain.document-to-chunks");
    const chunkSize = chunker?.properties.find((property) => property.id === "chunk-size");

    expect(temperature?.defaultValue).toBe(0.7);
    expect(temperature?.constraints?.range).toEqual({
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.7,
      clamp: true,
    });
    expect(maxTokens?.defaultValue).toBe(512);
    expect(maxTokens?.constraints?.range?.max).toBe(4096);
    expect(chunkSize?.defaultValue).toBe(1000);
    expect(chunkSize?.constraints?.range?.min).toBe(100);
  });
});
