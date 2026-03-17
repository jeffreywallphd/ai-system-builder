import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";

describe("LangChain node catalog definitions", () => {
  it("provides meaningful descriptions and workflow ports", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new LangChainNodeImplementationRegistry()
    );

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
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new LangChainNodeImplementationRegistry()
    );

    const definitions = await provider.getAllDefinitions();

    const prompt = definitions.find((definition) => definition.type === "langchain.prompt-template");
    const splitter = definitions.find((definition) => definition.type === "langchain.text-splitter");
    const parser = definitions.find((definition) => definition.type === "langchain.output-parser");

    expect(prompt?.outputPorts.length).toBeGreaterThan(0);
    expect(splitter?.inputPorts.length).toBeGreaterThan(0);
    expect(splitter?.outputPorts.length).toBeGreaterThan(0);
    expect(parser?.inputPorts.length).toBeGreaterThan(0);
    expect(parser?.outputPorts.length).toBeGreaterThan(0);
  });
  it("adds configurable properties for key langchain workflow nodes", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new LangChainNodeImplementationRegistry()
    );

    const definitions = await provider.getAllDefinitions();

    const expectsPropertiesFor = [
      "langchain.document-to-chunks",
      "langchain.chat-prompt",
      "langchain.simple-chain",
      "langchain.context-merger",
    ];

    for (const type of expectsPropertiesFor) {
      const definition = definitions.find((item) => item.type === type);
      expect(definition).toBeDefined();
      expect(definition?.properties.length ?? 0).toBeGreaterThan(0);
    }
  });

});
