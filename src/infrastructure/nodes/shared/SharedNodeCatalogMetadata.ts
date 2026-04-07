import { NodePort, NodePortCompatibilityProfile } from "@domain/nodes/NodePort";
import { NodeProperty } from "@domain/nodes/NodeProperty";
import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type { NodePortValueType } from "@domain/nodes/interfaces/INodePort";

interface ISharedNodeCatalogMetadata {
  readonly description: string;
  readonly inputPorts: INodeDefinition["inputPorts"];
  readonly outputPorts: INodeDefinition["outputPorts"];
  readonly properties: INodeDefinition["properties"];
}

function inputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>,
  isOptional = false
): NodePort {
  return new NodePort({
    id,
    name,
    direction: "input",
    compatibility: new NodePortCompatibilityProfile({ valueTypes, isOptional }),
  });
}

function outputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>
): NodePort {
  return new NodePort({
    id,
    name,
    direction: "output",
    compatibility: new NodePortCompatibilityProfile({ valueTypes }),
  });
}

export const SHARED_NODE_CATALOG_METADATA: Readonly<
  Record<string, ISharedNodeCatalogMetadata>
> = Object.freeze({
  "shared.document-uploader": Object.freeze({
    description:
      "Uploads a local document and emits a structured document payload for downstream processing.",
    inputPorts: Object.freeze([]),
    outputPorts: Object.freeze([outputPort("document", "Document", ["document"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "document",
        name: "Document",
        description: "Choose a text-based file to load into the workflow.",
        type: "file",
        value: null,
        constraints: { required: true },
      }),
    ]),
  }),
  "shared.chunk-displayer": Object.freeze({
    description:
      "Displays chunk arrays so you can inspect indexed chunk content directly on the canvas.",
    inputPorts: Object.freeze([inputPort("chunks", "Chunks", ["chunks", "json"])]),
    outputPorts: Object.freeze([]),
    properties: Object.freeze([]),
  }),
});

export function getSharedNodeCatalogMetadata(
  nodeTypeId: string
): ISharedNodeCatalogMetadata | undefined {
  return SHARED_NODE_CATALOG_METADATA[nodeTypeId];
}

