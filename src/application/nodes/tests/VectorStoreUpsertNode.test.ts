import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "@infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { LangChainNodeImplementationRegistry } from "@infrastructure/nodes/langchain/LangChainNodeImplementationRegistry";
import { LangChainNodeExecutor } from "@infrastructure/interpreted/execution/LangChainNodeExecutor";

function createProvider() {
  return new ImplementationRegistryNodeCatalogProvider(new LangChainNodeImplementationRegistry());
}

describe("VectorStoreUpsertNode", () => {
  it("registers knowledge-base metadata and bridges vector store output", async () => {
    const provider = createProvider();
    const definition = await provider.getDefinitionByType("langchain.vector_store_upsert");
    expect(definition?.title).toBe("Save to Knowledge Base");
    expect(definition?.category).toBe("LangChain / Knowledge");
    expect(definition?.getOutputPort("vectorStore")?.compatibility.valueTypes).toEqual(["vector-store"]);

    const node = definition!.createInstance("upsert-1")
      .withPropertyValue("storeType", "memory")
      .withPropertyValue("collectionName", "kb");

    const executor = new LangChainNodeExecutor({
      pythonRuntimeClient: {
        health: async () => ({ status: "ok", runtime: "python" }),
        executeWorkflow: async () => ({ executionId: "wf", workflowId: "wf", status: "completed", nodeResults: {} }),
        executeNode: async () => ({
          executionId: "exec-1",
          nodeId: "upsert-1",
          status: "completed",
          outputs: {
            vectorStore: {
              storeType: "memory",
              collectionName: "kb",
              records: [{ id: "doc-1", content: "Alpha", metadata: { source: "kb" } }],
            },
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
        documents: [{ id: "doc-1", text: "Alpha", metadata: { source: "kb" } }],
        embeddings: [[0.1, 0.2]],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.vectorStore).toEqual({
      storeType: "memory",
      collectionName: "kb",
      records: [{ id: "doc-1", content: "Alpha", metadata: { source: "kb" } }],
    });
  });
});

