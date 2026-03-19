import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";
import {
  createFallbackNodeCatalogDefinitionDescriptor,
  toNodeCatalogDefinitionDescriptor,
} from "../shared/NodeCatalogDefinitionDescriptor";
import { getSharedNodeCatalogMetadata } from "../shared/SharedNodeCatalogMetadata";

function sharedImplementation(
  nodeTypeId: string,
  title: string,
  category: string
): INodeRuntimeImplementation {
  const metadata = getSharedNodeCatalogMetadata(nodeTypeId);
  const nodeDefinition = metadata
    ? toNodeCatalogDefinitionDescriptor({
        title,
        description: metadata.description,
        category,
        inputPorts: metadata.inputPorts,
        outputPorts: metadata.outputPorts,
        properties: metadata.properties,
      })
    : createFallbackNodeCatalogDefinitionDescriptor({
        title,
        providerId: "local",
        category,
      });

  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "local",
      runtimeId: "local",
      nodeTypeId,
      title,
      executionStyles: ["interpreted-node", "generic"],
      metadata: { category },
      nodeDefinition,
    }),
  };
}

const LOCAL_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze([
  sharedImplementation("shared.document-uploader", "Document Uploader", "input"),
  sharedImplementation("shared.chunk-displayer", "Chunk Displayer", "output"),
  sharedImplementation("local.noop", "Local No-op Node", "utility"),
]);

export class LocalNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({ providerId: "local", implementations: LOCAL_IMPLEMENTATIONS });
  }
}
