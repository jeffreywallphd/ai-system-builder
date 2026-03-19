import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";
import { getLangChainNodeCatalogMetadata } from "../langchain/LangChainNodeCatalogMetadata";
import { LangChainNodeImplementationRegistry } from "../langchain/LangChainNodeImplementationRegistry";

function createProvider(): ImplementationRegistryNodeCatalogProvider {
  return new ImplementationRegistryNodeCatalogProvider(
    new LangChainNodeImplementationRegistry()
  );
}

const requiredTierOneNodes = [
  {
    type: "langchain.prompt_template",
    title: "Build Prompt",
    requiredInputs: ["variables"],
    requiredOutputs: ["prompt"],
    expectedProperties: ["template", "inputVariables"],
  },
  {
    type: "langchain.chat_prompt",
    title: "Build Chat Input",
    requiredInputs: ["system", "user", "context", "history"],
    requiredOutputs: ["messages"],
    expectedProperties: ["includeContext", "includeHistory"],
  },
  {
    type: "langchain.llm_chat",
    title: "Generate AI Response",
    requiredInputs: ["messages", "prompt"],
    requiredOutputs: ["response", "raw"],
    expectedProperties: ["model", "temperature", "maxTokens", "topP"],
  },
  {
    type: "langchain.text_splitter",
    title: "Split Text into Chunks",
    requiredInputs: ["text"],
    requiredOutputs: ["chunks"],
    expectedProperties: ["chunkSize", "chunkOverlap"],
  },
  {
    type: "langchain.embeddings",
    title: "Convert Text to Meaning Vectors",
    requiredInputs: ["texts"],
    requiredOutputs: ["embeddings"],
    expectedProperties: ["model", "normalize"],
  },
  {
    type: "langchain.retriever",
    title: "Find Relevant Information",
    requiredInputs: ["query", "embeddings", "vectorStore"],
    requiredOutputs: ["documents"],
    expectedProperties: ["topK"],
  },
  {
    type: "langchain.reranker",
    title: "Improve Search Results",
    requiredInputs: ["query", "documents"],
    requiredOutputs: ["documents"],
    expectedProperties: ["model", "topK"],
  },
  {
    type: "langchain.output_parser",
    title: "Format AI Output",
    requiredInputs: ["text"],
    requiredOutputs: ["parsed"],
    expectedProperties: ["format", "schema"],
  },
  {
    type: "langchain.memory",
    title: "Remember Conversation",
    requiredInputs: ["messages", "sessionId"],
    requiredOutputs: ["history"],
    expectedProperties: ["maxMessages"],
  },
  {
    type: "langchain.document_loader",
    title: "Load Document",
    requiredInputs: ["source"],
    requiredOutputs: ["documents"],
    expectedProperties: ["type", "encoding"],
  },
] as const;

const requiredTierTwoNodes = [
  {
    type: "langchain.document_to_chunks",
    title: "Prepare Document Chunks",
    requiredInputs: ["documents"],
    requiredOutputs: ["chunks"],
    expectedProperties: ["chunkSize", "chunkOverlap", "preserveMetadata"],
  },
  {
    type: "langchain.vector_store_upsert",
    title: "Save to Knowledge Base",
    requiredInputs: ["documents", "embeddings"],
    requiredOutputs: ["vectorStore"],
    expectedProperties: ["storeType", "collectionName"],
  },
  {
    type: "langchain.similarity_search",
    title: "Search Knowledge Base",
    requiredInputs: ["query", "vectorStore"],
    requiredOutputs: ["documents"],
    expectedProperties: ["k", "scoreThreshold"],
  },
  {
    type: "langchain.context_formatter",
    title: "Prepare Context",
    requiredInputs: ["documents"],
    requiredOutputs: ["context"],
    expectedProperties: ["template", "maxLength"],
  },
  {
    type: "langchain.tool_definition",
    title: "Create AI Tool",
    requiredInputs: ["inputSchema", "toolHandler"],
    requiredOutputs: ["tool"],
    expectedProperties: ["toolName", "description", "strictSchema"],
  },
  {
    type: "langchain.tool_call_executor",
    title: "Run AI Tool",
    requiredInputs: ["tool", "arguments"],
    requiredOutputs: ["toolResult", "resultText"],
    expectedProperties: ["failOnMissingArgs", "stringifyResult"],
  },
  {
    type: "langchain.agent",
    title: "AI Agent",
    requiredInputs: ["messages", "input", "tools", "history"],
    requiredOutputs: ["response", "messages", "toolCalls"],
    expectedProperties: ["model", "systemPrompt", "temperature", "maxIterations", "useMemory", "verbose"],
  },
  {
    type: "langchain.summarization",
    title: "Summarize Text",
    requiredInputs: ["documents", "model"],
    requiredOutputs: ["summary"],
    expectedProperties: ["strategy"],
  },
  {
    type: "langchain.combine_summaries",
    title: "Combine Summaries",
    requiredInputs: ["summaries"],
    requiredOutputs: ["combinedSummary"],
    expectedProperties: ["method"],
  },
  {
    type: "langchain.knowledge_base_retriever",
    title: "Find Relevant Information",
    requiredInputs: ["query", "knowledgeBase"],
    requiredOutputs: ["documents"],
    expectedProperties: ["topK", "searchType", "scoreThreshold"],
  },
  {
    type: "langchain.retrieval_qa",
    title: "Answer from Knowledge Base",
    requiredInputs: ["query", "knowledgeBase", "model"],
    requiredOutputs: ["answer", "sources"],
    expectedProperties: ["strategy", "topK", "includeSources", "systemPrompt"],
  },
  {
    type: "langchain.chat_prompt_builder",
    title: "Build AI Prompt",
    requiredInputs: ["systemMessage", "userMessage", "context"],
    requiredOutputs: ["prompt", "messages"],
    expectedProperties: ["template", "includeContext", "contextLabel", "userLabel"],
  },
] as const;

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

  it("registers every Tier 1 node with the required non-technical title and ports", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    for (const expected of requiredTierOneNodes) {
      const definition = definitions.find((item) => item.type === expected.type);
      expect(definition).toBeDefined();
      expect(definition?.title).toBe(expected.title);
      expect(definition?.description).toBeTruthy();
      expect(definition?.inputPorts.map((port) => port.id)).toEqual(expected.requiredInputs);
      expect(definition?.outputPorts.map((port) => port.id)).toEqual(expected.requiredOutputs);
      expect(definition?.properties.map((property) => property.id)).toEqual(expected.expectedProperties);
    }
  });

  it("registers every Tier 2 node with the required non-technical title and ports", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    for (const expected of requiredTierTwoNodes) {
      const definition = definitions.find((item) => item.type === expected.type);
      expect(definition).toBeDefined();
      expect(definition?.title).toBe(expected.title);
      expect(definition?.description).toBeTruthy();
      expect(definition?.inputPorts.map((port) => port.id)).toEqual(expected.requiredInputs);
      expect(definition?.outputPorts.map((port) => port.id)).toEqual(expected.requiredOutputs);
      expect(definition?.properties.map((property) => property.id)).toEqual(expected.expectedProperties);
    }
  });

  it("stores technical and projection metadata for Tier 1 nodes", () => {
    const llmNode = getLangChainNodeCatalogMetadata("langchain.llm_chat");
    const documentLoader = getLangChainNodeCatalogMetadata("langchain.document_loader");
    const agent = getLangChainNodeCatalogMetadata("langchain.agent");

    expect(llmNode?.technicalName).toBe("langchain.llm_chat");
    expect(llmNode?.technicalDescription).toContain("Invokes a language model");
    expect(llmNode?.description).toContain("Ask the AI");
    expect(llmNode?.projection.group).toBe("Tier 1 LLM");
    expect(llmNode?.projection.supportsAuthoringView).toBeTrue();
    expect(llmNode?.projection.supportsToolView).toBeTrue();
    expect(documentLoader?.projection.keywords).toContain("documents");
    expect(agent?.technicalDescription).toContain("Uses an LLM with tools");
    expect(agent?.description).toContain("tools and memory");
    expect(agent?.projection.group).toBe("Tier 2 LLM");
  });

  it("adds projection-friendly property metadata, defaults, and data types", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const promptTemplate = definitions.find((definition) => definition.type === "langchain.prompt_template");
    const llmChat = definitions.find((definition) => definition.type === "langchain.llm_chat");
    const outputParser = definitions.find((definition) => definition.type === "langchain.output_parser");
    const memory = definitions.find((definition) => definition.type === "langchain.memory");
    const toolDefinition = definitions.find((definition) => definition.type === "langchain.tool_definition");
    const similaritySearch = definitions.find(
      (definition) => definition.type === "langchain.similarity_search"
    );
    const combineSummaries = definitions.find(
      (definition) => definition.type === "langchain.combine_summaries"
    );
    const knowledgeBaseRetriever = definitions.find(
      (definition) => definition.type === "langchain.knowledge_base_retriever"
    );
    const retrievalQa = definitions.find(
      (definition) => definition.type === "langchain.retrieval_qa"
    );
    const chatPromptBuilder = definitions.find(
      (definition) => definition.type === "langchain.chat_prompt_builder"
    );

    const template = promptTemplate?.properties.find((property) => property.id === "template");
    const temperature = llmChat?.properties.find((property) => property.id === "temperature");
    const format = outputParser?.properties.find((property) => property.id === "format");
    const schema = outputParser?.properties.find((property) => property.id === "schema");
    const maxMessages = memory?.properties.find((property) => property.id === "maxMessages");
    const toolName = toolDefinition?.properties.find((property) => property.id === "toolName");
    const strictSchema = toolDefinition?.properties.find(
      (property) => property.id === "strictSchema"
    );
    const scoreThreshold = similaritySearch?.properties.find(
      (property) => property.id === "scoreThreshold"
    );
    const strategy = combineSummaries?.properties.find((property) => property.id === "method");
    const searchType = knowledgeBaseRetriever?.properties.find(
      (property) => property.id === "searchType"
    );
    const retrieverThreshold = knowledgeBaseRetriever?.properties.find(
      (property) => property.id === "scoreThreshold"
    );
    const retrievalStrategy = retrievalQa?.properties.find((property) => property.id === "strategy");
    const includeSources = retrievalQa?.properties.find((property) => property.id === "includeSources");
    const systemPrompt = retrievalQa?.properties.find((property) => property.id === "systemPrompt");
    const builderTemplate = chatPromptBuilder?.properties.find((property) => property.id === "template");
    const includeContext = chatPromptBuilder?.properties.find((property) => property.id === "includeContext");
    const contextLabel = chatPromptBuilder?.properties.find((property) => property.id === "contextLabel");

    expect(template?.type).toBe("multiline-text");
    expect(template?.projection?.label).toBe("Prompt template");
    expect(template?.projection?.fieldTypeHint).toBe("textarea");

    expect(temperature?.defaultValue).toBe(0.7);
    expect(temperature?.constraints?.range).toEqual({
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.7,
      clamp: true,
    });

    expect(format?.type).toBe("select");
    expect(format?.options?.map((option) => option.value)).toEqual(["json", "text", "custom"]);
    expect(schema?.type).toBe("json");
    expect(schema?.projection?.fieldTypeHint).toBe("json-editor");

    expect(maxMessages?.defaultValue).toBe(10);
    expect(maxMessages?.constraints?.range?.max).toBe(100);

    expect(toolName?.constraints?.required).toBeTrue();
    expect(toolName?.projection?.group).toBe("Definition");
    expect(strictSchema?.defaultValue).toBeTrue();

    expect(scoreThreshold?.type).toBe("number");
    expect(scoreThreshold?.projection?.authorVisibility).toBe("advanced");
    expect(scoreThreshold?.constraints?.range).toEqual({
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0,
      clamp: true,
    });

    expect(strategy?.options?.map((option) => option.value)).toEqual([
      "concatenate",
      "reduce",
    ]);

    expect(searchType?.type).toBe("select");
    expect(searchType?.defaultValue).toBe("similarity");
    expect(searchType?.projection?.label).toBe("Search strategy");
    expect(retrieverThreshold?.value).toBeNull();
    expect(retrieverThreshold?.isAdvanced).toBeTrue();

    expect(retrievalStrategy?.type).toBe("select");
    expect(retrievalStrategy?.defaultValue).toBe("stuff");
    expect(includeSources?.defaultValue).toBeTrue();
    expect(systemPrompt?.type).toBe("multiline-text");
    expect(systemPrompt?.projection?.fieldTypeHint).toBe("textarea");

    expect(builderTemplate?.type).toBe("multiline-text");
    expect(includeContext?.defaultValue).toBeTrue();
    expect(contextLabel?.defaultValue).toBe("Context");
  });

  it("stores useful technical and non-technical metadata for the new Tier 2 nodes", () => {
    const knowledgeBaseRetriever = getLangChainNodeCatalogMetadata("langchain.knowledge_base_retriever");
    const retrievalQa = getLangChainNodeCatalogMetadata("langchain.retrieval_qa");
    const chatPromptBuilder = getLangChainNodeCatalogMetadata("langchain.chat_prompt_builder");

    expect(knowledgeBaseRetriever?.technicalDescription).toContain("knowledge base or semantic store");
    expect(knowledgeBaseRetriever?.description).toContain("saved knowledge");
    expect(knowledgeBaseRetriever?.projection.group).toBe("Tier 2 LLM");

    expect(retrievalQa?.technicalDescription).toContain("uses an LLM");
    expect(retrievalQa?.description).toContain("saved knowledge");
    expect(retrievalQa?.projection.tags).toContain("question answering");

    expect(chatPromptBuilder?.technicalDescription).toContain("structured chat prompt");
    expect(chatPromptBuilder?.description).toContain("clean prompt for the AI");
    expect(chatPromptBuilder?.projection.supportsToolView).toBeTrue();
  });

  it("marks optional ports correctly for flexible Tier 1 and Tier 2 nodes", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const chatPrompt = definitions.find((definition) => definition.type === "langchain.chat_prompt");
    const llmChat = definitions.find((definition) => definition.type === "langchain.llm_chat");
    const retriever = definitions.find((definition) => definition.type === "langchain.retriever");
    const similaritySearch = definitions.find(
      (definition) => definition.type === "langchain.similarity_search"
    );
    const agent = definitions.find((definition) => definition.type === "langchain.agent");
    const summarization = definitions.find(
      (definition) => definition.type === "langchain.summarization"
    );
    const retrievalQa = definitions.find(
      (definition) => definition.type === "langchain.retrieval_qa"
    );
    const chatPromptBuilder = definitions.find(
      (definition) => definition.type === "langchain.chat_prompt_builder"
    );

    expect(chatPrompt?.getInputPort("system")?.compatibility.isOptional).toBeTrue();
    expect(chatPrompt?.getInputPort("user")?.compatibility.isOptional).toBeFalse();
    expect(chatPrompt?.getInputPort("history")?.compatibility.isOptional).toBeTrue();

    expect(llmChat?.getInputPort("messages")?.compatibility.isOptional).toBeTrue();
    expect(llmChat?.getInputPort("prompt")?.compatibility.isOptional).toBeTrue();

    expect(retriever?.getInputPort("embeddings")?.compatibility.isOptional).toBeTrue();
    expect(retriever?.getInputPort("vectorStore")?.compatibility.isOptional).toBeFalse();

    expect(similaritySearch?.getInputPort("query")?.compatibility.isOptional).toBeFalse();
    expect(similaritySearch?.getInputPort("vectorStore")?.compatibility.isOptional).toBeFalse();

    expect(agent?.getInputPort("messages")?.compatibility.isOptional).toBeTrue();
    expect(agent?.getInputPort("input")?.compatibility.isOptional).toBeTrue();
    expect(agent?.getInputPort("history")?.compatibility.isOptional).toBeTrue();

    expect(summarization?.getInputPort("documents")?.compatibility.isOptional).toBeFalse();
    expect(summarization?.getInputPort("model")?.compatibility.isOptional).toBeFalse();

    expect(retrievalQa?.getInputPort("model")?.compatibility.isOptional).toBeTrue();
    expect(chatPromptBuilder?.getInputPort("systemMessage")?.compatibility.isOptional).toBeTrue();
    expect(chatPromptBuilder?.getInputPort("userMessage")?.compatibility.isOptional).toBeFalse();
  });
});
