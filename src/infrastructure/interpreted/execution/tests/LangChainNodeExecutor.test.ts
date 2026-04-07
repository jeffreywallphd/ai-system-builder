import { describe, expect, it } from "bun:test";
import { makeNode } from "@domain/workflows/tests/testUtils";
import { Node } from "@domain/nodes/Node";
import { NodeDefinition } from "@domain/nodes/NodeDefinition";
import { NodeProperty } from "@domain/nodes/NodeProperty";
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

  it("injects assembled workflow context into prompt template variables", async () => {
    const node = makeLangChainNode("n-prompt-context", "langchain.prompt_template", [
      new NodeProperty({ id: "template", name: "Template", type: "multiline-text", value: "Rules: {contextInstructions}\nQuestion: {topic}" }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { variables: { topic: "workflow nodes" } },
      executionMetadata: {
        workflowContext: {
          inspection: { finalPromptText: "Stay concise and cite sources." },
          assembledContext: { promptText: "Stay concise and cite sources." },
        },
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.prompt).toContain("Stay concise and cite sources.");
    expect(result.outputs.context).toBe("Stay concise and cite sources.");
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


  it("uses assembled workflow context when chat prompt nodes do not receive direct context input", async () => {
    const node = makeLangChainNode("n-chat-context", "langchain.chat_prompt", [
      new NodeProperty({ id: "includeContext", name: "Include Context", type: "boolean", value: true }),
      new NodeProperty({ id: "includeHistory", name: "Include History", type: "boolean", value: false }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        system: "Be helpful.",
        user: "Answer the question.",
      },
      executionMetadata: {
        workflowContext: {
          promptText: "Persona:\nUse the saved style guide.",
          inspection: { id: "inspection" },
        },
      },
    });

    expect(result.outputs.messages).toContainEqual({
      role: "system",
      content: "Context:\nPersona:\nUse the saved style guide.",
    });
    expect(result.outputs.inspection).toEqual({ id: "inspection" });
  });


  it("injects workflow context into simple agent system prompts", async () => {
    const node = makeLangChainNode("n-agent", "langchain.simple_agent", [
      new NodeProperty({ id: "systemPrompt", name: "System Prompt", type: "multiline-text", value: "Be helpful." }),
      new NodeProperty({ id: "maxIterations", name: "Max Iterations", type: "integer", value: 2 }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        input: "Summarize the workflow",
        tools: [{ name: "echo", description: "Echo the user input back." }],
      },
      executionMetadata: {
        workflowContext: {
          inspection: { finalPromptText: "Use project terminology." },
          assembledContext: { promptText: "Use project terminology." },
        },
      },
    });

    expect(result.status).toBe("completed");
    expect((result.outputs.messages as Array<{ role: string; content: string }>)[0]?.content).toContain("Use project terminology.");
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

  it("executes output parser nodes with schema-aware reports and key-value parsing", async () => {
    const node = makeLangChainNode("n-parse", "langchain.output_parser", [
      new NodeProperty({ id: "format", name: "Format", type: "select", value: "key_value" }),
      new NodeProperty({ id: "coerceNumbers", name: "Coerce Numbers", type: "boolean", value: true }),
      new NodeProperty({ id: "trimCodeFence", name: "Trim Code Fence", type: "boolean", value: true }),
      new NodeProperty({
        id: "schema",
        name: "Schema",
        type: "json",
        value: { type: "object", properties: { priority: { type: "number" } } },
      }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        text: "```json\npriority: 3\nstatus: ready\n```",
        schema: { required: ["priority"] },
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toEqual({
      parsed: { priority: 3, status: "ready" },
      parsed_output: { priority: 3, status: "ready" },
      raw_output: "```json\npriority: 3\nstatus: ready\n```",
      parseReport: {
        format: "key_value",
        usedFallback: false,
        schema: {
          type: "object",
          properties: { priority: { type: "number" } },
          required: ["priority"],
        },
        extractedKeys: ["priority", "status"],
      },
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

  it("stores session-oriented message history with seed support", async () => {
    const node = makeLangChainNode("n-memory", "langchain.message_history", [
      new NodeProperty({ id: "maxMessages", name: "Max Messages", type: "integer", value: 3 }),
      new NodeProperty({ id: "seedStrategy", name: "Seed Strategy", type: "select", value: "on-miss" }),
      new NodeProperty({ id: "dedupeConsecutive", name: "Dedupe Consecutive", type: "boolean", value: true }),
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
        seedHistory: [{ role: "system", content: "You are a helpful assistant." }],
        messages: [
          { role: "user", content: "Hello" },
          { role: "user", content: "Hello" },
        ],
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
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
    expect(second.outputs.historyState).toEqual({
      sessionId: "session-1",
      storedMessageCount: 3,
      seededMessageCount: 0,
      appendedMessageCount: 1,
    });
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

  it("chunks structured documents while preserving metadata", async () => {
    const node = makeLangChainNode("n-doc-chunks", "langchain.document_to_chunks", [
      new NodeProperty({ id: "chunkSize", name: "Chunk Size", type: "integer", value: 8 }),
      new NodeProperty({ id: "chunkOverlap", name: "Chunk Overlap", type: "integer", value: 2 }),
      new NodeProperty({
        id: "preserveMetadata",
        name: "Preserve Metadata",
        type: "boolean",
        value: true,
      }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [
          {
            id: "doc-1",
            text: "abcdefghijk",
            metadata: { source: "kb", title: "Guide" },
          },
        ],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.chunks).toEqual([
      {
        id: "doc-1-chunk-1",
        text: "abcdefgh",
        metadata: { source: "kb", title: "Guide", sourceDocumentId: "doc-1", chunkIndex: 0 },
      },
      {
        id: "doc-1-chunk-2",
        text: "ghijk",
        metadata: { source: "kb", title: "Guide", sourceDocumentId: "doc-1", chunkIndex: 1 },
      },
    ]);
  });

  it("formats retrieved documents into prompt-ready context", async () => {
    const node = makeLangChainNode("n-format-context", "langchain.context_formatter", [
      new NodeProperty({ id: "template", name: "Template", type: "multiline-text", value: "Doc {index}: {content}" }),
      new NodeProperty({ id: "maxLength", name: "Max Length", type: "integer", value: 100 }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [
          { id: "d1", text: "Alpha" },
          { id: "d2", text: "Beta" },
          { id: "d3", text: "Gamma" },
        ],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.context).toBe("Doc 1: Alpha\n\nDoc 2: Beta\n\nDoc 3: Gamma");
    expect(result.outputs.budget).toEqual(
      expect.objectContaining({ wasTrimmed: false, includedCharacterCount: 39 })
    );
    expect(result.outputs.filtering).toEqual(
      expect.objectContaining({ visibilityMode: "advanced" })
    );
  });

  it("applies filtering and budgeting controls in context formatter nodes", async () => {
    const node = makeLangChainNode("n-format-context-qc", "langchain.context_formatter", [
      new NodeProperty({ id: "template", name: "Template", type: "multiline-text", value: "{content}" }),
      new NodeProperty({ id: "maxLength", name: "Max Length", type: "integer", value: 8 }),
      new NodeProperty({ id: "visibilityMode", name: "Visibility Mode", type: "select", value: "basic" }),
      new NodeProperty({ id: "excludeSources", name: "Exclude Sources", type: "generic", value: ["memory-bank"] }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [
          { id: "d1", text: "Alpha", metadata: { source: "knowledge-base" } },
          { id: "d2", text: "Beta", metadata: { visibility: "advanced", source: "knowledge-base" } },
          { id: "d3", text: "Gamma", metadata: { source: "memory-bank" } },
          { id: "d4", text: "DeltaDelta", metadata: { source: "knowledge-base" } },
        ],
      },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.context).toBe("Alpha\n\nD");
    expect(result.outputs.fragments).toEqual([
      expect.objectContaining({ id: "d1", content: "Alpha" }),
      expect.objectContaining({ id: "d4", content: "D" }),
    ]);
    expect(result.outputs.filtering.decisions).toEqual([
      expect.objectContaining({ id: "d1", action: "included" }),
      expect.objectContaining({ id: "d2", action: "excluded-by-visibility" }),
      expect.objectContaining({ id: "d3", action: "excluded-by-source" }),
      expect.objectContaining({ id: "d4", action: "included" }),
    ]);
    expect(result.outputs.budget).toEqual(
      expect.objectContaining({ wasTrimmed: true, includedCharacterCount: 8 })
    );
  });

  it("supports vector upsert and similarity search scaffolds", async () => {
    const upsertNode = makeLangChainNode("n-upsert", "langchain.vector_store_upsert", [
      new NodeProperty({ id: "storeType", name: "Store Type", type: "select", value: "memory" }),
      new NodeProperty({ id: "collectionName", name: "Collection Name", type: "text", value: "kb" }),
    ]);
    const searchNode = makeLangChainNode("n-search", "langchain.similarity_search", [
      new NodeProperty({ id: "k", name: "Top K", type: "integer", value: 1 }),
      new NodeProperty({ id: "scoreThreshold", name: "Score Threshold", type: "number", value: 0 }),
    ]);
    const executor = new LangChainNodeExecutor();

    const upsertResult = await executor.executeNode({
      workflow: {} as never,
      node: upsertNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [
          { id: "d1", text: "workflow canvas editor", metadata: { source: "kb" } },
          { id: "d2", text: "vector database basics", metadata: { source: "kb" } },
        ],
        embeddings: [
          [0.1, 0.2],
          [0.2, 0.3],
        ],
      },
    });

    const searchResult = await executor.executeNode({
      workflow: {} as never,
      node: searchNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        query: "workflow canvas",
        vectorStore: upsertResult.outputs.vectorStore,
      },
    });

    expect(upsertResult.status).toBe("completed");
    expect(upsertResult.outputs.vectorStore).toEqual({
      storeType: "memory",
      collectionName: "kb",
      records: [
        {
          id: "d1",
          content: "workflow canvas editor",
          metadata: { source: "kb" },
          embedding: [0.1, 0.2],
        },
        {
          id: "d2",
          content: "vector database basics",
          metadata: { source: "kb" },
          embedding: [0.2, 0.3],
        },
      ],
    });
    expect(searchResult.status).toBe("completed");
    expect(searchResult.outputs.documents).toEqual([
      {
        id: "d1",
        text: "workflow canvas editor",
        metadata: { source: "kb", score: 1 },
      },
    ]);
  });

  it("defines and executes tools deterministically", async () => {
    const toolNode = makeLangChainNode("n-tool", "langchain.tool_definition", [
      new NodeProperty({ id: "toolName", name: "Tool Name", type: "text", value: "search_docs" }),
      new NodeProperty({
        id: "description",
        name: "Description",
        type: "multiline-text",
        value: "Search project documents.",
      }),
      new NodeProperty({
        id: "inputSchemaSource",
        name: "Input Schema Source",
        type: "select",
        value: "merge",
      }),
      new NodeProperty({
        id: "inputSchema",
        name: "Input Schema",
        type: "json",
        value: {
          type: "object",
          properties: { limit: { type: "number" } },
        },
      }),
      new NodeProperty({ id: "strictSchema", name: "Strict Schema", type: "boolean", value: true }),
      new NodeProperty({ id: "displayName", name: "Display Name", type: "text", value: "Search Docs" }),
    ]);
    const executorNode = makeLangChainNode("n-tool-run", "langchain.tool_execution", [
      new NodeProperty({
        id: "failOnMissingArgs",
        name: "Fail On Missing Arguments",
        type: "boolean",
        value: true,
      }),
      new NodeProperty({ id: "stringifyResult", name: "Stringify Result", type: "boolean", value: true }),
    ]);
    const executor = new LangChainNodeExecutor();

    const toolResult = await executor.executeNode({
      workflow: {} as never,
      node: toolNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    });

    const runResult = await executor.executeNode({
      workflow: {} as never,
      node: executorNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        tool: toolResult.outputs.tool,
        toolCall: { name: "search_docs", arguments: { query: "nodes" } },
      },
    });

    expect(toolResult.status).toBe("completed");
    expect(toolResult.outputs.tool).toEqual({
      name: "search_docs",
      displayName: "Search Docs",
      description: "Search project documents.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      strictSchema: true,
      handler: undefined,
    });
    expect(toolResult.outputs.toolManifest).toEqual({
      name: "search_docs",
      displayName: "Search Docs",
      description: "Search project documents.",
      strictSchema: true,
      schemaSource: "merge",
      hasHandler: false,
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    });
    expect(runResult.status).toBe("completed");
    expect(runResult.outputs.toolCall).toEqual({
      name: "search_docs",
      arguments: { query: "nodes" },
    });
    expect(runResult.outputs.toolResult).toEqual({
      toolName: "search_docs",
      arguments: { query: "nodes" },
      missingRequiredArguments: [],
      status: "completed",
      output: "Search project documents. :: nodes",
    });
    expect(runResult.outputs.resultText).toContain("\"toolName\": \"search_docs\"");
  });

  it("runs agent and summarization tier 2 nodes with bounded outputs", async () => {
    const agentNode = makeLangChainNode("n-agent", "langchain.simple_agent", [
      new NodeProperty({ id: "model", name: "Model", type: "text", value: "agent-model" }),
      new NodeProperty({ id: "systemPrompt", name: "System Prompt", type: "multiline-text", value: "Be helpful." }),
      new NodeProperty({ id: "temperature", name: "Temperature", type: "slider", value: 0.3 }),
      new NodeProperty({ id: "maxIterations", name: "Max Iterations", type: "integer", value: 5 }),
      new NodeProperty({ id: "useMemory", name: "Use Memory", type: "boolean", value: true }),
      new NodeProperty({ id: "verbose", name: "Verbose", type: "boolean", value: false }),
    ]);
    const summaryNode = makeLangChainNode("n-summary", "langchain.summarization", [
      new NodeProperty({ id: "strategy", name: "Strategy", type: "select", value: "stuff" }),
    ]);
    const combineNode = makeLangChainNode("n-combine", "langchain.combine_summaries", [
      new NodeProperty({ id: "method", name: "Method", type: "select", value: "concatenate" }),
    ]);
    const knowledgeBaseNode = makeLangChainNode("n-kb", "langchain.knowledge_base_retriever", [
      new NodeProperty({ id: "topK", name: "Top K", type: "integer", value: 1 }),
      new NodeProperty({ id: "scoreThreshold", name: "Score Threshold", type: "number", value: 0 }),
    ]);
    const executor = new LangChainNodeExecutor();

    const agentResult = await executor.executeNode({
      workflow: {} as never,
      node: agentNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        input: "Find workflow help.",
        tools: [{ name: "search_docs", description: "Search documents." }],
        history: [{ role: "user", content: "Hello" }],
      },
    });

    const summaryResult = await executor.executeNode({
      workflow: {} as never,
      node: summaryNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        documents: [{ id: "d1", text: "A long workflow explanation for new users." }],
        model: "summary-model",
      },
    });

    const combineResult = await executor.executeNode({
      workflow: {} as never,
      node: combineNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        summaries: ["First summary", "Second summary"],
      },
    });

    const knowledgeBaseResult = await executor.executeNode({
      workflow: {} as never,
      node: knowledgeBaseNode,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        query: "workflow",
        knowledgeBase: {
          documents: [
            { id: "kb-1", text: "workflow editor help", metadata: { source: "kb" } },
            { id: "kb-2", text: "image tools", metadata: { source: "kb" } },
          ],
        },
      },
    });

    expect(agentResult.status).toBe("completed");
    expect(agentResult.outputs.response).toContain("[agent-model] Find workflow help.");
    expect(agentResult.outputs.response).toContain("Used tool 'search_docs'");
    expect(agentResult.outputs.toolCalls).toEqual([
      {
        name: "search_docs",
        arguments: { input: "Find workflow help." },
      },
    ]);
    expect(agentResult.outputs.toolResults).toEqual([
      {
        toolName: "search_docs",
        arguments: { input: "Find workflow help." },
        missingRequiredArguments: [],
        status: "completed",
        output: "Search documents. :: Find workflow help.",
      },
    ]);

    expect(summaryResult.status).toBe("completed");
    expect(summaryResult.outputs.summary).toBe("[summary-model] Summary: A long workflow explanation for new users.");

    expect(combineResult.status).toBe("completed");
    expect(combineResult.outputs.combinedSummary).toBe("First summary\n\nSecond summary");

    expect(knowledgeBaseResult.status).toBe("completed");
    expect(knowledgeBaseResult.outputs.documents).toEqual([
      {
        id: "kb-1",
        text: "workflow editor help",
        metadata: { source: "kb", score: 1 },
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

