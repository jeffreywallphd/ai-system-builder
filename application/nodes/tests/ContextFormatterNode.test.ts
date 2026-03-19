import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "../../../infrastructure/nodes/langchain/LangChainNodeImplementationRegistry";
import { LangChainNodeExecutor } from "../../../infrastructure/interpreted/execution/LangChainNodeExecutor";

function createProvider() {
  return new ImplementationRegistryNodeCatalogProvider(new LangChainNodeImplementationRegistry());
}

describe("ContextFormatterNode", () => {
  it("registers text formatting properties and produces context", async () => {
    const provider = createProvider();
    const definition = await provider.getDefinitionByType("langchain.context_formatter");
    expect(definition?.title).toBe("Prepare Context");
    expect(definition?.category).toBe("LangChain / Text");

    const node = definition!.createInstance("context-1")
      .withPropertyValue("template", "Doc {index}: {content}")
      .withPropertyValue("maxLength", 50);
    const executor = new LangChainNodeExecutor();

    const result = await executor.executeNode({
      workflow: { id: "wf" } as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [
          { id: "d1", text: "Alpha" },
          { id: "d2", text: "Beta" },
        ],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.context).toBe("Doc 1: Alpha\n\nDoc 2: Beta");
  });
});
