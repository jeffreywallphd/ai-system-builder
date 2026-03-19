import type { INodeCatalogDefinitionDescriptor } from "../shared/NodeCatalogDefinitionDescriptor";
import { toNodeCatalogDefinitionDescriptor } from "../shared/NodeCatalogDefinitionDescriptor";
import type { NodeExecutionStyle } from "../shared/NodeImplementationDescriptor";
import { getLangChainNodeCatalogMetadata } from "./LangChainNodeCatalogMetadata";

export interface ILangChainNodeRegistrationDescriptor {
  readonly nodeTypeId: string;
  readonly executionStyles: ReadonlyArray<NodeExecutionStyle>;
  readonly category: string;
}

const DEFAULT_EXECUTION_STYLES: ReadonlyArray<NodeExecutionStyle> = Object.freeze([
  "interpreted-node",
  "python-node",
]);

export const LANGCHAIN_NODE_REGISTRATIONS: ReadonlyArray<ILangChainNodeRegistrationDescriptor> =
  Object.freeze([
    { nodeTypeId: "langchain.prompt_template", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain" },
    { nodeTypeId: "langchain.chat_prompt", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain" },
    { nodeTypeId: "langchain.llm_chat", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain" },
    { nodeTypeId: "langchain.text_splitter", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain" },
    { nodeTypeId: "langchain.embeddings", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain" },
    { nodeTypeId: "langchain.retriever", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain" },
    { nodeTypeId: "langchain.reranker", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain" },
    { nodeTypeId: "langchain.output_parser", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain / Structured Output" },
    { nodeTypeId: "langchain.message_history", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain / Memory" },
    { nodeTypeId: "langchain.document_loader", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain" },
    { nodeTypeId: "langchain.document_to_chunks", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain" },
    { nodeTypeId: "langchain.vector_store_upsert", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Knowledge" },
    { nodeTypeId: "langchain.similarity_search", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Knowledge" },
    { nodeTypeId: "langchain.context_formatter", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Text" },
    { nodeTypeId: "langchain.tool_definition", executionStyles: DEFAULT_EXECUTION_STYLES, category: "LangChain / Tools" },
    { nodeTypeId: "langchain.tool_call_executor", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain" },
    { nodeTypeId: "langchain.agent", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain" },
    { nodeTypeId: "langchain.summarization", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Text" },
    { nodeTypeId: "langchain.combine_summaries", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Text" },
    { nodeTypeId: "langchain.knowledge_base_retriever", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Knowledge" },
    { nodeTypeId: "langchain.retrieval_qa", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Knowledge" },
    { nodeTypeId: "langchain.chat_prompt_builder", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "LangChain / Prompting" },
    { nodeTypeId: "langchain.prompt-template", executionStyles: DEFAULT_EXECUTION_STYLES, category: "Legacy LangChain" },
    { nodeTypeId: "langchain.text-splitter", executionStyles: DEFAULT_EXECUTION_STYLES, category: "Legacy LangChain" },
    { nodeTypeId: "langchain.document-to-chunks", executionStyles: DEFAULT_EXECUTION_STYLES, category: "Legacy LangChain" },
    { nodeTypeId: "langchain.chat-prompt", executionStyles: DEFAULT_EXECUTION_STYLES, category: "Legacy LangChain" },
    { nodeTypeId: "langchain.simple-chain", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "Legacy LangChain" },
    { nodeTypeId: "langchain.output-parser", executionStyles: DEFAULT_EXECUTION_STYLES, category: "Legacy LangChain" },
    { nodeTypeId: "langchain.context-merger", executionStyles: DEFAULT_EXECUTION_STYLES, category: "Legacy LangChain" },
    { nodeTypeId: "langchain.embedding-generator", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "Legacy LangChain" },
    { nodeTypeId: "langchain.vector-store-upsert", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "Legacy LangChain" },
    { nodeTypeId: "langchain.retrieval-query", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "Legacy LangChain" },
    { nodeTypeId: "langchain.answer-synthesizer", executionStyles: ["interpreted-node", "python-node", "hybrid"], category: "Legacy LangChain" },
  ]);

export function buildLangChainNodeCatalogDescriptor(
  nodeTypeId: string,
  category?: string
): INodeCatalogDefinitionDescriptor | undefined {
  const metadata = getLangChainNodeCatalogMetadata(nodeTypeId);
  if (!metadata) {
    return undefined;
  }

  return toNodeCatalogDefinitionDescriptor({
    title: metadata.nonTechnicalName,
    description: metadata.description,
    category,
    inputPorts: metadata.inputPorts,
    outputPorts: metadata.outputPorts,
    properties: metadata.properties,
    technicalName: metadata.technicalName,
    technicalDescription: metadata.technicalDescription,
    projection: metadata.projection,
  });
}
