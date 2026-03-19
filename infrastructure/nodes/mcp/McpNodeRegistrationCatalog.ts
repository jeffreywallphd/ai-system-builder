import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { INodeDefinition } from "../../../domain/nodes/interfaces/INodeDefinition";
import type { NodePortValueType } from "../../../domain/nodes/interfaces/INodePort";
import type {
  NodePropertyType,
  NodePropertyValue,
} from "../../../domain/nodes/interfaces/INodeProperty";
import type { INodeCatalogDefinitionDescriptor } from "../shared/NodeCatalogDefinitionDescriptor";
import { toNodeCatalogDefinitionDescriptor } from "../shared/NodeCatalogDefinitionDescriptor";
import type { NodeExecutionStyle } from "../shared/NodeImplementationDescriptor";

export interface IMcpNodeRegistrationDescriptor {
  readonly nodeTypeId: string;
  readonly executionStyles: ReadonlyArray<NodeExecutionStyle>;
  readonly category: string;
}

interface IMcpNodeCatalogMetadata {
  readonly technicalName: string;
  readonly nonTechnicalName: string;
  readonly technicalDescription: string;
  readonly description: string;
  readonly inputPorts: INodeDefinition["inputPorts"];
  readonly outputPorts: INodeDefinition["outputPorts"];
  readonly properties: INodeDefinition["properties"];
  readonly executionKind: INodeDefinition["executionKind"];
}

const DEFAULT_EXECUTION_STYLES: ReadonlyArray<NodeExecutionStyle> = Object.freeze([
  "python-node",
  "hybrid",
]);

export const MCP_NODE_REGISTRATIONS: ReadonlyArray<IMcpNodeRegistrationDescriptor> =
  Object.freeze([
    {
      nodeTypeId: "mcp.tool_catalog",
      executionStyles: DEFAULT_EXECUTION_STYLES,
      category: "MCP / Tools",
    },
    {
      nodeTypeId: "mcp.tool_call",
      executionStyles: DEFAULT_EXECUTION_STYLES,
      category: "MCP / Tools",
    },
  ]);

function inputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>,
  isOptional = false,
  description?: string,
): NodePort {
  return new NodePort({
    id,
    name,
    description,
    direction: "input",
    compatibility: new NodePortCompatibilityProfile({
      valueTypes,
      isOptional,
    }),
  });
}

function outputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>,
  description?: string,
): NodePort {
  return new NodePort({
    id,
    name,
    description,
    direction: "output",
    compatibility: new NodePortCompatibilityProfile({
      valueTypes,
    }),
  });
}

function property<TValue extends NodePropertyValue>(params: {
  id: string;
  name: string;
  type: NodePropertyType;
  value: TValue;
  defaultValue?: TValue;
  description: string;
  required?: boolean;
  isAdvanced?: boolean;
  order?: number;
}): NodeProperty<TValue> {
  return new NodeProperty<TValue>({
    id: params.id,
    name: params.name,
    description: params.description,
    type: params.type,
    value: params.value,
    defaultValue: params.defaultValue,
    isAdvanced: params.isAdvanced ?? false,
    order: params.order ?? 0,
    constraints: params.required ? { required: true } : undefined,
    projection: {
      label: params.name,
      description: params.description,
      group: "Configuration",
      order: params.order ?? 0,
      authorVisibility: params.isAdvanced ? "advanced" : "basic",
      toolVisibility: params.isAdvanced ? "advanced" : "basic",
      exposeInAuthorForm: true,
      exposeInTool: true,
      fieldTypeHint: params.type,
    },
  });
}

function metadata(params: {
  technicalName: string;
  nonTechnicalName: string;
  technicalDescription: string;
  description: string;
  inputPorts: INodeDefinition["inputPorts"];
  outputPorts: INodeDefinition["outputPorts"];
  properties: INodeDefinition["properties"];
  executionKind: INodeDefinition["executionKind"];
}): IMcpNodeCatalogMetadata {
  return Object.freeze({
    technicalName: params.technicalName,
    nonTechnicalName: params.nonTechnicalName,
    technicalDescription: params.technicalDescription,
    description: params.description,
    inputPorts: params.inputPorts,
    outputPorts: params.outputPorts,
    properties: params.properties,
    executionKind: params.executionKind,
  });
}

const MCP_NODE_CATALOG_METADATA: Readonly<Record<string, IMcpNodeCatalogMetadata>> =
  Object.freeze({
    "mcp.tool_catalog": metadata({
      technicalName: "mcp.tool_catalog",
      nonTechnicalName: "List MCP Tools",
      technicalDescription:
        "Queries the Python-backed MCP runtime for currently connected tool descriptors and connection status.",
      description:
        "See which MCP tools are available before choosing one for the next workflow step.",
      inputPorts: Object.freeze([]),
      outputPorts: Object.freeze([
        outputPort(
          "tools",
          "Tools",
          ["json"],
          "Discovered MCP tool descriptors, including names, schemas, and server IDs.",
        ),
        outputPort(
          "toolCount",
          "Tool Count",
          ["number"],
          "How many MCP tools are currently available.",
        ),
        outputPort(
          "status",
          "Status",
          ["json"],
          "Current MCP connection status reported by the Python runtime.",
        ),
      ]),
      properties: Object.freeze([]),
      executionKind: "source",
    }),
    "mcp.tool_call": metadata({
      technicalName: "mcp.tool_call",
      nonTechnicalName: "Run MCP Tool",
      technicalDescription:
        "Executes a specific MCP tool through the Python-backed MCP runtime using a descriptor or explicit tool name plus arguments.",
      description:
        "Run an MCP tool from a workflow and capture both its raw result and the structured output it returns.",
      inputPorts: Object.freeze([
        inputPort(
          "tool",
          "Tool",
          ["json", "text"],
          true,
          "Optional MCP tool descriptor or tool name supplied by an upstream node.",
        ),
        inputPort(
          "arguments",
          "Arguments",
          ["json"],
          true,
          "Optional structured arguments passed to the selected MCP tool.",
        ),
      ]),
      outputPorts: Object.freeze([
        outputPort(
          "result",
          "Result",
          ["json", "tool-result"],
          "The full MCP tool execution result payload.",
        ),
        outputPort(
          "structuredContent",
          "Structured Content",
          ["json"],
          "Structured MCP tool output, when the tool provides one.",
        ),
        outputPort(
          "resultText",
          "Result Text",
          ["text"],
          "A text summary extracted from the MCP tool result content.",
        ),
      ]),
      properties: Object.freeze([
        property({
          id: "serverId",
          name: "Server Id",
          type: "text",
          value: "",
          description:
            "Configured MCP server ID to use when no upstream descriptor provides one.",
          required: true,
          order: 0,
        }),
        property({
          id: "toolName",
          name: "Tool Name",
          type: "text",
          value: "",
          description:
            "Fallback MCP tool name used when no upstream descriptor or tool input is connected.",
          order: 1,
        }),
      ]),
      executionKind: "utility",
    }),
  });

export function buildMcpNodeCatalogDescriptor(
  nodeTypeId: string,
  category?: string,
): INodeCatalogDefinitionDescriptor | undefined {
  const metadata = MCP_NODE_CATALOG_METADATA[nodeTypeId];
  if (!metadata) {
    return undefined;
  }

  return toNodeCatalogDefinitionDescriptor({
    title: metadata.nonTechnicalName,
    description: metadata.description,
    category,
    executionKind: metadata.executionKind,
    inputPorts: metadata.inputPorts,
    outputPorts: metadata.outputPorts,
    properties: metadata.properties,
    technicalName: metadata.technicalName,
    technicalDescription: metadata.technicalDescription,
    projection: {
      group: "Integrations",
      tags: Object.freeze(["mcp", "tools", "python-runtime"]),
      keywords: Object.freeze(["mcp", "model context protocol", "tools"]),
      supportsAuthoringView: true,
      supportsToolView: false,
    },
  });
}
