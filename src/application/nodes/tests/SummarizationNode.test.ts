import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "@infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "@infrastructure/nodes/langchain/LangChainNodeImplementationRegistry";
import { LangChainNodeExecutor } from "@infrastructure/interpreted/execution/LangChainNodeExecutor";

function createProvider() {
  return new ImplementationRegistryNodeCatalogProvider(new LangChainNodeImplementationRegistry());
}

describe("SummarizationNode", () => {
  it("requires documents and model ports and returns summary text", async () => {
    const provider = createProvider();
    const definition = await provider.getDefinitionByType("langchain.summarization");
    expect(definition?.getInputPort("documents")?.compatibility.isOptional).toBeFalse();
    expect(definition?.getInputPort("model")?.compatibility.isOptional).toBeFalse();

    const node = definition!.createInstance("summary-1").withPropertyValue("strategy", "refine");
    const executor = new LangChainNodeExecutor();

    const result = await executor.executeNode({
      workflow: { id: "wf" } as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [{ id: "d1", text: "Alpha Beta Gamma" }],
        model: "summary-model",
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.summary).toBe("[summary-model] Refined summary: Alpha Beta Gamma");
  });
});

