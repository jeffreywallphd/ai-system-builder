import { NodeCatalogProvider } from "../../application/ports/NodeCatalogProvider";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../../domain/nodes/NodeDefinition";
import type { INodeDefinition } from "../../domain/nodes/interfaces/INodeDefinition";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";
import { getLangChainNodeCatalogMetadata } from "./langchain/LangChainNodeCatalogMetadata";

export class ImplementationRegistryNodeCatalogProvider extends NodeCatalogProvider {
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

      return new NodeDefinition({
        id: descriptor.nodeTypeId,
        type: descriptor.nodeTypeId,
        title: descriptor.title,
        description:
          getLangChainNodeCatalogMetadata(descriptor.nodeTypeId)?.description ??
          `Registered runtime node from ${descriptor.providerId}.`,
        category: toCategoryLabel(descriptor.providerId),
        executionKind: "generic",
        inputPorts:
          getLangChainNodeCatalogMetadata(descriptor.nodeTypeId)?.inputPorts ?? [],
        outputPorts:
          getLangChainNodeCatalogMetadata(descriptor.nodeTypeId)?.outputPorts ?? [],
        properties:
          getLangChainNodeCatalogMetadata(descriptor.nodeTypeId)?.properties ?? [],
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
