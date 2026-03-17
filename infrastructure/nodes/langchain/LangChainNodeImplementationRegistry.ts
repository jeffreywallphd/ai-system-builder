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
]);

export class LangChainNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "langchain", implementations: LANGCHAIN_IMPLEMENTATIONS });
  }
}
