import { CompositeNodeCatalogProvider } from "@application/nodes/CompositeNodeCatalogProvider";
import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type { INodeImplementationRegistry } from "./shared/INodeImplementationRegistry";
import {
  createFallbackNodeCatalogDefinitionDescriptor,
  createNodeDefinitionFromCatalogDescriptor,
  toCategoryLabel,
} from "./shared/NodeCatalogDefinitionDescriptor";

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
      const catalog =
        descriptor.nodeDefinition ??
        createFallbackNodeCatalogDefinitionDescriptor({
          title: descriptor.title,
          providerId: descriptor.providerId,
          category: (descriptor.metadata?.category as string | undefined) ??
            toCategoryLabel(descriptor.providerId),
        });

      return createNodeDefinitionFromCatalogDescriptor({
        nodeTypeId: descriptor.nodeTypeId,
        catalog,
        fallbackCategory:
          (descriptor.metadata?.category as string | undefined) ??
          toCategoryLabel(descriptor.providerId),
      });
    })
  );
}

