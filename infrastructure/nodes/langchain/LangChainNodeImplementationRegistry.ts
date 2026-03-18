import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

const LANGCHAIN_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.prompt-template",
      title: "LangChain Prompt Template",
      executionStyles: ["interpreted-node", "python-node"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.text-splitter",
      title: "LangChain Text Splitter",
      executionStyles: ["interpreted-node", "python-node"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.document-to-chunks",
      title: "LangChain Document To Chunks",
      executionStyles: ["interpreted-node", "python-node"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.chat-prompt",
      title: "LangChain Chat Prompt",
      executionStyles: ["interpreted-node", "python-node"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.simple-chain",
      title: "LangChain Simple Chain",
      executionStyles: ["interpreted-node", "python-node", "hybrid"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.output-parser",
      title: "LangChain Output Parser",
      executionStyles: ["interpreted-node", "python-node"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.context-merger",
      title: "LangChain Context Merger",
      executionStyles: ["interpreted-node", "python-node"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.embedding-generator",
      title: "LangChain Embedding Generator",
      executionStyles: ["interpreted-node", "python-node", "hybrid"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.vector-store-upsert",
      title: "LangChain Vector Store Upsert",
      executionStyles: ["interpreted-node", "python-node", "hybrid"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.retrieval-query",
      title: "LangChain Retrieval Query",
      executionStyles: ["interpreted-node", "python-node", "hybrid"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.reranker",
      title: "LangChain Reranker",
      executionStyles: ["interpreted-node", "python-node", "hybrid"],
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: "langchain.answer-synthesizer",
      title: "LangChain Answer Synthesizer",
      executionStyles: ["interpreted-node", "python-node", "hybrid"],
    }),
  },
]);

export class LangChainNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "langchain", implementations: LANGCHAIN_IMPLEMENTATIONS });
  }
}
