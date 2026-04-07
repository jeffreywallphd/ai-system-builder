import {
  buildLangChainNodeCatalogDescriptor,
  LANGCHAIN_NODE_REGISTRATIONS,
} from "./LangChainNodeRegistrationCatalog";
import { NodeImplementationDescriptor } from "@shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "@shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "@shared/INodeRuntimeImplementation";

function langChainImplementation(nodeTypeId: string): INodeRuntimeImplementation {
  const registration = LANGCHAIN_NODE_REGISTRATIONS.find(
    (candidate) => candidate.nodeTypeId === nodeTypeId
  );

  if (!registration) {
    throw new Error(`Missing LangChain node registration for ${nodeTypeId}.`);
  }

  const nodeDefinition = buildLangChainNodeCatalogDescriptor(
    registration.nodeTypeId,
    registration.category
  );

  if (!nodeDefinition) {
    throw new Error(`Missing LangChain node catalog metadata for ${nodeTypeId}.`);
  }

  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "langchain",
      runtimeId: "langchain",
      nodeTypeId: registration.nodeTypeId,
      title: nodeDefinition.title,
      executionStyles: registration.executionStyles,
      metadata: {
        category: registration.category,
        tier: "tier-1-llm",
      },
      nodeDefinition,
    }),
  };
}

const LANGCHAIN_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze(
  LANGCHAIN_NODE_REGISTRATIONS.map((registration) =>
    langChainImplementation(registration.nodeTypeId)
  )
);

export class LangChainNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "langchain", implementations: LANGCHAIN_IMPLEMENTATIONS });
  }
}

