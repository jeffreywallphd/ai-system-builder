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

  it("formats prompt template nodes with variable input", async () => {
    const node = makeLangChainNode("n-prompt", "langchain.prompt_template", [
      new NodeProperty({ id: "template", name: "Template", type: "multiline-text", value: "Explain {topic}." }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { variables: { topic: "workflow nodes" } },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.prompt).toBe("Explain workflow nodes.");
  });

  it("assembles chat prompts with optional history and context", async () => {
    const node = makeLangChainNode("n-chat", "langchain.chat_prompt", [
      new NodeProperty({ id: "includeContext", name: "Include Context", type: "boolean", value: true }),
      new NodeProperty({ id: "includeHistory", name: "Include History", type: "boolean", value: true }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        system: "Be concise.",
        user: "Summarize the graph.",
        context: "The workflow has three nodes.",
        history: [{ role: "assistant", content: "Ready when you are." }],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.messages).toEqual([
      { role: "system", content: "Be concise." },
      { role: "assistant", content: "Ready when you are." },
      { role: "system", content: "Context:\nThe workflow has three nodes." },
      { role: "user", content: "Summarize the graph." },
    ]);
  });

  it("executes llm chat nodes with deterministic response metadata", async () => {
    const node = makeLangChainNode("n-llm", "langchain.llm_chat", [
      new NodeProperty({ id: "model", name: "Model", type: "text", value: "demo-model" }),
      new NodeProperty({ id: "temperature", name: "Temperature", type: "slider", value: 0.2 }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { messages: [{ role: "user", content: "Write a summary." }] },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.response).toBe("[demo-model] user: Write a summary.");
    expect(result.outputs.raw).toEqual({
      model: "demo-model",
      temperature: 0.2,
      maxTokens: undefined,
      topP: undefined,
      inputMode: "messages",
      messageCount: 1,
    });
  });

  it("splits text using the Tier 1 text splitter", async () => {
    const node = makeLangChainNode("n-split", "langchain.text_splitter", [
      new NodeProperty({ id: "chunkSize", name: "Chunk Size", type: "integer", value: 5 }),
      new NodeProperty({ id: "chunkOverlap", name: "Chunk Overlap", type: "integer", value: 1 }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { text: "abcdefghij" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.chunks).toEqual(["abcde", "efghi", "ij"]);
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
    const node = makeLangChainNode("n-parse", "langchain.output_parser", [
      new NodeProperty({ id: "format", name: "Format", type: "select", value: "json" }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { text: "not-json" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toEqual({
      parsed: { text: "not-json" },
      parsed_output: { text: "not-json" },
      raw_output: "not-json",
    });
  });

  it("executes embedding generation nodes", async () => {
    const node = makeLangChainNode("n-embed", "langchain.embeddings", [
      new NodeProperty({ id: "dimensions", name: "Dimensions", type: "integer", value: 4 }),
      new NodeProperty({ id: "normalize", name: "Normalize", type: "boolean", value: true }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { texts: ["hello world"] },
    });

    expect(result.status).toBe("completed");
    expect((result.outputs.embeddings as Array<unknown>).length).toBe(1);
    expect((result.outputs.embedding as { dimensions: number }).dimensions).toBe(4);
  });

  it("retrieves and reranks documents with deterministic scores", async () => {
    const retrievalNode = makeLangChainNode("n-retrieve", "langchain.retriever", [
      new NodeProperty({ id: "topK", name: "Top K", type: "integer", value: 2 }),
    ]);
    const rerankerNode = makeLangChainNode("n-rerank", "langchain.reranker", [
      new NodeProperty({ id: "model", name: "Model", type: "text", value: "demo-reranker" }),
      new NodeProperty({ id: "topK", name: "Top K", type: "integer", value: 1 }),
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
        vectorStore: [
          { id: "d1", text: "workflow canvas editor", metadata: { source: "kb" } },
          { id: "d2", text: "image generation pipeline", metadata: { source: "kb" } },
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
        documents: retrievalResult.outputs.documents,
      },
    });

    expect(retrievalResult.status).toBe("completed");
    expect((retrievalResult.outputs.documents as Array<unknown>).length).toBe(2);
    expect(rerankResult.status).toBe("completed");
    expect((rerankResult.outputs.documents as Array<unknown>).length).toBe(1);
  });

  it("stores message history by session", async () => {
    const node = makeLangChainNode("n-memory", "langchain.memory", [
      new NodeProperty({ id: "maxMessages", name: "Max Messages", type: "integer", value: 2 }),
    ]);
    const executor = new LangChainNodeExecutor();

    const first = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        sessionId: "session-1",
        messages: [{ role: "user", content: "Hello" }],
      },
    });

    const second = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        sessionId: "session-1",
        messages: [{ role: "assistant", content: "Hi there" }],
      },
    });

    expect(first.status).toBe("completed");
    expect(second.outputs.history).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("loads documents from a source string", async () => {
    const node = makeLangChainNode("n-loader", "langchain.document_loader", [
      new NodeProperty({ id: "type", name: "Type", type: "select", value: "text" }),
      new NodeProperty({ id: "encoding", name: "Encoding", type: "text", value: "utf-8" }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        source: "Important document text.",
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.documents).toEqual([
      {
        id: "text-document",
        text: "Important document text.",
        metadata: { type: "text", encoding: "utf-8" },
      },
    ]);
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
