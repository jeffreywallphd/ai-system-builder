import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

const PYTHON_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.prompt-template",
      title: "Python Prompt Template Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.text-splitter",
      title: "Python Text Splitter Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.document-to-chunks",
      title: "Python Document To Chunks Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.chat-prompt",
      title: "Python Chat Prompt Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.simple-chain",
      title: "Python Simple Chain Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.context-merger",
      title: "Python Context Merger Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
  {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: "langchain.output-parser",
      title: "Python Output Parser Adapter",
      executionStyles: ["python-node", "hybrid"],
      metadata: { bridgeProvider: "langchain" },
    }),
  },
]);

export class PythonNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "python", implementations: PYTHON_IMPLEMENTATIONS });
  }
}
