import {
  buildLangChainNodeCatalogDescriptor,
  LANGCHAIN_NODE_REGISTRATIONS,
} from "../langchain/LangChainNodeRegistrationCatalog";
import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

function pythonImplementation(nodeTypeId: string): INodeRuntimeImplementation {
  const registration = LANGCHAIN_NODE_REGISTRATIONS.find(
    (candidate) => candidate.nodeTypeId === nodeTypeId
  );

  if (!registration) {
    throw new Error(`Missing Python bridge registration for ${nodeTypeId}.`);
  }

  const nodeDefinition = buildLangChainNodeCatalogDescriptor(
    registration.nodeTypeId,
    registration.category
  );

  if (!nodeDefinition) {
    throw new Error(`Missing bridged node catalog metadata for ${nodeTypeId}.`);
  }

  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "python",
      runtimeId: "python",
      nodeTypeId: registration.nodeTypeId,
      title: `Python ${nodeDefinition.title} Adapter`,
      executionStyles: ["python-node", "hybrid"],
      metadata: {
        bridgeProvider: "langchain",
        tier: "tier-1-llm",
        category: registration.category,
      },
      nodeDefinition,
    }),
  };
}

const PYTHON_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze(
  LANGCHAIN_NODE_REGISTRATIONS.map((registration) =>
    pythonImplementation(registration.nodeTypeId)
  )
);

export class PythonNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "python", implementations: PYTHON_IMPLEMENTATIONS });
  }
}
