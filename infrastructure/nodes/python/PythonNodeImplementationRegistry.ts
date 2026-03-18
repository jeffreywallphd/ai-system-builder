import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

function pythonImplementation(nodeTypeId: string, title: string): INodeRuntimeImplementation {
  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId,
      title,
      executionStyles: ["python-node", "hybrid"],
      metadata: {
        bridgeProvider: "langchain",
        tier: "tier-1-llm",
      },
    }),
  };
}

const PYTHON_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  pythonImplementation("langchain.prompt_template", "Python Build Prompt Adapter"),
  pythonImplementation("langchain.chat_prompt", "Python Build Chat Input Adapter"),
  pythonImplementation("langchain.llm_chat", "Python Generate AI Response Adapter"),
  pythonImplementation("langchain.text_splitter", "Python Text Splitter Adapter"),
  pythonImplementation("langchain.embeddings", "Python Embeddings Adapter"),
  pythonImplementation("langchain.retriever", "Python Retriever Adapter"),
  pythonImplementation("langchain.reranker", "Python Reranker Adapter"),
  pythonImplementation("langchain.output_parser", "Python Output Parser Adapter"),
  pythonImplementation("langchain.memory", "Python Message History Adapter"),
  pythonImplementation("langchain.document_loader", "Python Document Loader Adapter"),

  pythonImplementation("langchain.prompt-template", "Python Prompt Template Adapter"),
  pythonImplementation("langchain.text-splitter", "Python Text Splitter Adapter"),
  pythonImplementation("langchain.document-to-chunks", "Python Document To Chunks Adapter"),
  pythonImplementation("langchain.chat-prompt", "Python Chat Prompt Adapter"),
  pythonImplementation("langchain.simple-chain", "Python Simple Chain Adapter"),
  pythonImplementation("langchain.context-merger", "Python Context Merger Adapter"),
  pythonImplementation("langchain.output-parser", "Python Output Parser Adapter"),
  pythonImplementation("langchain.embedding-generator", "Python Embedding Generator Adapter"),
  pythonImplementation("langchain.vector-store-upsert", "Python Vector Store Upsert Adapter"),
  pythonImplementation("langchain.retrieval-query", "Python Retrieval Query Adapter"),
]);

export class PythonNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "python", implementations: PYTHON_IMPLEMENTATIONS });
  }
}
