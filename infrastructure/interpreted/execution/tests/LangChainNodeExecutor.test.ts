import { describe, expect, it } from "bun:test";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { Node } from "../../../../domain/nodes/Node";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

function makeLangChainNode(id: string, type: string, properties: ReadonlyArray<NodeProperty> = []): Node {
  return new Node({
    id,
    definition: new NodeDefinition({
      id: `def-${id}`,
      type,
      title: type,
      category: "utility",
      executionKind: "generic",
      properties,
      inputPorts: [],
      outputPorts: [],
    }),
  });
}

describe("LangChainNodeExecutor", () => {
  it("returns scaffold outputs for generic nodes", async () => {
    const node = makeNode({ id: "n1" });
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { in: "value" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toHaveProperty("result");
  });

  it("executes context merger nodes with deterministic merged output", async () => {
    const node = makeLangChainNode("n-context", "langchain.context-merger", [
      new NodeProperty({ id: "merge-strategy", name: "Merge Strategy", type: "select", value: "concat-text" }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { primary: "one", secondary: "two" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toEqual({
      merged: { text: "one\n\ntwo" },
      merged_context: "one\n\ntwo",
      block_count: 2,
    });
  });

  it("executes output parser nodes and falls back to JSON-shaped output", async () => {
    const node = makeLangChainNode("n-parse", "langchain.output-parser", [
      new NodeProperty({ id: "format", name: "Format", type: "select", value: "json" }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { output: "not-json" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toEqual({
      parsed: { text: "not-json" },
      parsed_output: { text: "not-json" },
      raw_output: "not-json",
    });
  });

  it("executes embedding generation nodes", async () => {
    const node = makeLangChainNode("n-embed", "langchain.embedding-generator", [
      new NodeProperty({ id: "dimensions", name: "Dimensions", type: "integer", value: 4 }),
      new NodeProperty({ id: "normalize-vectors", name: "Normalize Vectors", type: "boolean", value: true }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { text: "hello world" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toHaveProperty("embedding");
    expect((result.outputs.embedding as { dimensions: number }).dimensions).toBe(4);
  });

  it("executes retrieval and reranking nodes with deterministic scores", async () => {
    const retrievalNode = makeLangChainNode("n-retrieve", "langchain.retrieval-query", [
      new NodeProperty({ id: "top-k", name: "Top K", type: "integer", value: 2 }),
      new NodeProperty({ id: "min-score", name: "Minimum Score", type: "slider", value: 0 }),
    ]);
    const rerankerNode = makeLangChainNode("n-rerank", "langchain.reranker", [
      new NodeProperty({ id: "top-n", name: "Top N", type: "integer", value: 1 }),
    ]);
    const executor = new LangChainNodeExecutor();

    const retrievalResult = await executor.executeNode({
      workflow: {} as never,
      node: retrievalNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        query: "workflow canvas",
        dataset: [
          { index: 0, text: "workflow canvas editor" },
          { index: 1, text: "image generation pipeline" },
        ],
      },
    });

    const rerankResult = await executor.executeNode({
      workflow: {} as never,
      node: rerankerNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        query: "workflow canvas",
        candidates: retrievalResult.outputs.matches,
      },
    });

    expect(retrievalResult.status).toBe("completed");
    expect((retrievalResult.outputs.matches as Array<unknown>).length).toBe(2);
    expect(rerankResult.status).toBe("completed");
    expect((rerankResult.outputs.reranked as Array<unknown>).length).toBe(1);
  });

  it("executes answer synthesis nodes and emits citations", async () => {
    const node = makeLangChainNode("n-answer", "langchain.answer-synthesizer", [
      new NodeProperty({ id: "response-style", name: "Response Style", type: "select", value: "concise" }),
      new NodeProperty({ id: "max-sources", name: "Max Sources", type: "integer", value: 2 }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        question: "How does the workflow editor help?",
        context: [
          { index: 0, text: "The workflow editor lets users add nodes on a canvas." },
          { index: 1, text: "The inspector shows configurable node properties." },
        ],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toHaveProperty("answer");
    expect((result.outputs.citations as Array<unknown>).length).toBe(2);
  });
});
