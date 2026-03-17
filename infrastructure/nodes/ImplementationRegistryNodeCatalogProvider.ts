import { NodeCatalogProvider } from "../../application/ports/NodeCatalogProvider";
import { NodeDefinition, NodeDefinitionCapabilityProfile } from "../../domain/nodes/NodeDefinition";
import type { INodeDefinition } from "../../domain/nodes/interfaces/INodeDefinition";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";

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
        description: `Auto-registered from ${descriptor.providerId} node registry.`,
        category: toCategoryLabel(descriptor.providerId),
        executionKind: "generic",
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
