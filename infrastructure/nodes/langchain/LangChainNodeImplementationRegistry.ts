import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

function langChainImplementation(
  nodeTypeId: string,
  title: string,
  executionStyles: ReadonlyArray<"interpreted-node" | "python-node" | "hybrid"> = [
    "interpreted-node",
    "python-node",
  ]
): INodeRuntimeImplementation {
  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId,
      title,
      executionStyles,
      metadata: {
        category: "LangChain",
        tier: "tier-1-llm",
      },
    }),
  };
}

const LANGCHAIN_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  langChainImplementation("langchain.prompt_template", "Build Prompt"),
  langChainImplementation("langchain.chat_prompt", "Build Chat Input"),
  langChainImplementation("langchain.llm_chat", "Generate AI Response", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.text_splitter", "Split Text into Chunks"),
  langChainImplementation("langchain.embeddings", "Convert Text to Meaning Vectors", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.retriever", "Find Relevant Information", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.reranker", "Improve Search Results", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.output_parser", "Format AI Output"),
  langChainImplementation("langchain.memory", "Remember Conversation"),
  langChainImplementation("langchain.document_loader", "Load Document"),

  langChainImplementation("langchain.prompt-template", "Build Prompt"),
  langChainImplementation("langchain.text-splitter", "Split Text into Chunks"),
  langChainImplementation("langchain.document-to-chunks", "Chunk Document"),
  langChainImplementation("langchain.chat-prompt", "Build Chat Prompt"),
  langChainImplementation("langchain.simple-chain", "Run Simple Chain", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.output-parser", "Format Output"),
  langChainImplementation("langchain.context-merger", "Merge Context"),
  langChainImplementation("langchain.embedding-generator", "Generate Embeddings", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.vector-store-upsert", "Prepare Vector Store Records", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.retrieval-query", "Retrieve Matches", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
  langChainImplementation("langchain.answer-synthesizer", "Synthesize Answer", [
    "interpreted-node",
    "python-node",
    "hybrid",
  ]),
]);

export class LangChainNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "langchain", implementations: LANGCHAIN_IMPLEMENTATIONS });
  }
}
