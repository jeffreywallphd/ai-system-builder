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

  it("stores technical and projection metadata for Tier 1 nodes", () => {
    const llmNode = getLangChainNodeCatalogMetadata("langchain.llm_chat");
    const documentLoader = getLangChainNodeCatalogMetadata("langchain.document_loader");

    expect(llmNode?.technicalName).toBe("langchain.llm_chat");
    expect(llmNode?.technicalDescription).toContain("Invokes a language model");
    expect(llmNode?.description).toContain("Ask the AI");
    expect(llmNode?.projection.group).toBe("Tier 1 LLM");
    expect(llmNode?.projection.supportsAuthoringView).toBeTrue();
    expect(llmNode?.projection.supportsToolView).toBeTrue();
    expect(documentLoader?.projection.keywords).toContain("documents");
  });

  it("adds projection-friendly property metadata, defaults, and data types", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const promptTemplate = definitions.find((definition) => definition.type === "langchain.prompt_template");
    const llmChat = definitions.find((definition) => definition.type === "langchain.llm_chat");
    const outputParser = definitions.find((definition) => definition.type === "langchain.output_parser");
    const memory = definitions.find((definition) => definition.type === "langchain.memory");

    const template = promptTemplate?.properties.find((property) => property.id === "template");
    const temperature = llmChat?.properties.find((property) => property.id === "temperature");
    const format = outputParser?.properties.find((property) => property.id === "format");
    const schema = outputParser?.properties.find((property) => property.id === "schema");
    const maxMessages = memory?.properties.find((property) => property.id === "maxMessages");

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
  });

  it("marks optional ports correctly for flexible Tier 1 nodes", async () => {
    const provider = createProvider();
    const definitions = await provider.getAllDefinitions();

    const chatPrompt = definitions.find((definition) => definition.type === "langchain.chat_prompt");
    const llmChat = definitions.find((definition) => definition.type === "langchain.llm_chat");
    const retriever = definitions.find((definition) => definition.type === "langchain.retriever");

    expect(chatPrompt?.getInputPort("system")?.compatibility.isOptional).toBeTrue();
    expect(chatPrompt?.getInputPort("user")?.compatibility.isOptional).toBeFalse();
    expect(chatPrompt?.getInputPort("history")?.compatibility.isOptional).toBeTrue();

    expect(llmChat?.getInputPort("messages")?.compatibility.isOptional).toBeTrue();
    expect(llmChat?.getInputPort("prompt")?.compatibility.isOptional).toBeTrue();

    expect(retriever?.getInputPort("embeddings")?.compatibility.isOptional).toBeTrue();
    expect(retriever?.getInputPort("vectorStore")?.compatibility.isOptional).toBeFalse();
  });
});
