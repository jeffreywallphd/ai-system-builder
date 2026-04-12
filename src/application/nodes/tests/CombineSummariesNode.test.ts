import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "@infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "@infrastructure/nodes/langchain/LangChainNodeImplementationRegistry";
import { LangChainNodeExecutor } from "@infrastructure/interpreted/execution/LangChainNodeExecutor";

function createProvider() {
  return new ImplementationRegistryNodeCatalogProvider(new LangChainNodeImplementationRegistry());
}

describe("CombineSummariesNode", () => {
  it("requires a many-valued summaries input and returns combinedSummary", async () => {
    const provider = createProvider();
    const definition = await provider.getDefinitionByType("langchain.combine_summaries");
    expect(definition?.getInputPort("summaries")?.cardinality).toBe("many");
    expect(definition?.getOutputPort("combinedSummary")?.compatibility.valueTypes).toEqual(["text"]);

    const node = definition!.createInstance("combine-1").withPropertyValue("method", "reduce");
    const executor = new LangChainNodeExecutor();

    const result = await executor.executeNode({
      workflow: { id: "wf" } as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        summaries: ["First summary", "Second summary"],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.combinedSummary).toBe("First summary Second summary");
  });
});

