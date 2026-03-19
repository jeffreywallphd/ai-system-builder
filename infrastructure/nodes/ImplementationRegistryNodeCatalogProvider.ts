import { CompositeNodeCatalogProvider } from "../../application/nodes/CompositeNodeCatalogProvider";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../../domain/nodes/NodeDefinition";
import type { INodeDefinition } from "../../domain/nodes/interfaces/INodeDefinition";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";
import { getLangChainNodeCatalogMetadata } from "./langchain/LangChainNodeCatalogMetadata";
import { getSharedNodeCatalogMetadata } from "./shared/SharedNodeCatalogMetadata";

export class ImplementationRegistryNodeCatalogProvider extends CompositeNodeCatalogProvider {
  constructor(registry: INodeImplementationRegistry) {
    super({
      definitions: toNodeDefinitions(registry),
    });
  }
}

function toNodeDefinitions(
  registry: INodeImplementationRegistry
): ReadonlyArray<INodeDefinition> {
  return Object.freeze(
    registry.listImplementations().map((implementation) => {
      const descriptor = implementation.descriptor;
      const metadata =
        getLangChainNodeCatalogMetadata(descriptor.nodeTypeId) ??
        getSharedNodeCatalogMetadata(descriptor.nodeTypeId);

      return new NodeDefinition({
        id: descriptor.nodeTypeId,
        type: descriptor.nodeTypeId,
        title: descriptor.title,
        description:
          metadata?.description ??
          `Registered runtime node from ${descriptor.providerId}.`,
        category: (descriptor.metadata?.category as string | undefined) ?? toCategoryLabel(descriptor.providerId),
        executionKind: "generic",
        inputPorts: metadata?.inputPorts ?? [],
        outputPorts: metadata?.outputPorts ?? [],
        properties: metadata?.properties ?? [],
        capabilities: new NodeDefinitionCapabilityProfile({
          tasks: ["generic"],
          runtimes: ["generic"],
          allowsAnyRuntime: true,
        }),
      });
    })
  );
}

function toCategoryLabel(providerId: string): string {
  return providerId
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
