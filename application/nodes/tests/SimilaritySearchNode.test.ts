import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "../../../infrastructure/nodes/langchain/LangChainNodeImplementationRegistry";
import { LangChainNodeExecutor } from "../../../infrastructure/interpreted/execution/LangChainNodeExecutor";

function createProvider() {
  return new ImplementationRegistryNodeCatalogProvider(new LangChainNodeImplementationRegistry());
}

describe("SimilaritySearchNode", () => {
  it("accepts only vector-store handles and normalizes document outputs", async () => {
    const provider = createProvider();
    const definition = await provider.getDefinitionByType("langchain.similarity_search");
    expect(definition?.title).toBe("Search Knowledge Base");
    expect(definition?.getInputPort("vectorStore")?.compatibility.valueTypes).toEqual(["vector-store"]);

    const node = definition!.createInstance("search-1").withPropertyValue("k", 2);
    const executor = new LangChainNodeExecutor({
      pythonRuntimeClient: {
        health: async () => ({ status: "ok", runtime: "python" }),
        executeWorkflow: async () => ({ executionId: "wf", workflowId: "wf", status: "completed", nodeResults: {} }),
        executeNode: async () => ({
          executionId: "exec-1",
          nodeId: "search-1",
          status: "completed",
          outputs: {
            documents: [{ content: "Alpha", metadata: { score: 0.9 } }],
          },
        }),
      },
    });

    const result = await executor.executeNode({
      workflow: { id: "wf" } as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        query: "alpha",
        vectorStore: { storeType: "memory", collectionName: "kb", records: [] },
      },
    });

    expect(result.outputs.documents).toEqual([{ id: "doc-1", text: "Alpha", metadata: { score: 0.9 } }]);
  });
});
