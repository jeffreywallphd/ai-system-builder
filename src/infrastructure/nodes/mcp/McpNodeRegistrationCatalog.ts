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

interface IMcpNodeCatalogMetadataProjection {
  readonly group: string;
  readonly tags: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly supportsAuthoringView: boolean;
  readonly supportsToolView: boolean;
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
  readonly isVisibleInBasicMode?: boolean;
  readonly projection: IMcpNodeCatalogMetadataProjection;
}

const DEFAULT_EXECUTION_STYLES: ReadonlyArray<NodeExecutionStyle> = Object.freeze([
  "python-node",
  "hybrid",
]);

export const MCP_NODE_REGISTRATIONS: ReadonlyArray<IMcpNodeRegistrationDescriptor> =
  Object.freeze([
    {
      nodeTypeId: "mcp.server_select",
      executionStyles: DEFAULT_EXECUTION_STYLES,
      category: "MCP / Infrastructure",
    },
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
  projection?: Partial<NonNullable<NodeProperty<TValue>["projection"]>>;
  isEditable?: boolean;
}): NodeProperty<TValue> {
  return new NodeProperty<TValue>({
    id: params.id,
    name: params.name,
    description: params.description,
    type: params.type,
    value: params.value,
    defaultValue: params.defaultValue,
    isEditable: params.isEditable,
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
      ...params.projection,
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
  isVisibleInBasicMode?: boolean;
  projection: IMcpNodeCatalogMetadataProjection;
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
    isVisibleInBasicMode: params.isVisibleInBasicMode,
    projection: params.projection,
  });
}

const infrastructureProjection = Object.freeze({
  group: "MCP",
  tags: Object.freeze(["mcp", "server", "infrastructure"]),
  keywords: Object.freeze(["model context protocol", "server handle", "connect mcp server"]),
  supportsAuthoringView: true,
  supportsToolView: false,
});

const toolProjection = Object.freeze({
  group: "MCP",
  tags: Object.freeze(["mcp", "tools", "capabilities"]),
  keywords: Object.freeze(["model context protocol", "tool discovery", "tool execution"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

const MCP_NODE_CATALOG_METADATA: Readonly<Record<string, IMcpNodeCatalogMetadata>> =
  Object.freeze({
    "mcp.server_select": metadata({
      technicalName: "mcp.server_select",
      nonTechnicalName: "Choose MCP Server",
      technicalDescription:
        "Resolves a configured MCP server into a reusable workflow server handle and, when enabled, establishes the runtime connection.",
      description:
        "Choose one configured MCP server so downstream MCP nodes can discover tools and run them without embedding server lifecycle details everywhere.",
      inputPorts: Object.freeze([
        inputPort(
          "selection",
          "Selection",
          ["json", "text"],
          true,
          "Optional server selection input, such as a server id string or a previously selected server descriptor.",
        ),
      ]),
      outputPorts: Object.freeze([
        outputPort(
          "serverHandle",
          "Server Handle",
          ["json", "workflow-state"],
          "Reusable handle describing the configured MCP server selection and current connection state.",
        ),
        outputPort(
          "connectionStatus",
          "Connection Status",
          ["json", "workflow-state"],
          "Current MCP runtime connection status after selecting the configured server.",
        ),
      ]),
      properties: Object.freeze([
        property({
          id: "serverId",
          name: "Server Id",
          type: "text",
          value: "",
          description: "Configured MCP server id to select when no upstream selection input is connected.",
          required: true,
          isAdvanced: true,
          order: 0,
        }),
        property({
          id: "autoConnect",
          name: "Auto Connect",
          type: "boolean",
          value: true,
          defaultValue: true,
          description: "Automatically connect the selected configured MCP server before emitting the server handle.",
          isAdvanced: true,
          order: 1,
        }),
        property({
          id: "allowReconnect",
          name: "Allow Reconnect",
          type: "boolean",
          value: true,
          defaultValue: true,
          description: "Allow reconnect attempts when the selected MCP server is disconnected or in an error state.",
          isAdvanced: true,
          order: 2,
        }),
      ]),
      executionKind: "selector",
      isVisibleInBasicMode: false,
      projection: infrastructureProjection,
    }),
    "mcp.tool_catalog": metadata({
      technicalName: "mcp.tool_catalog",
      nonTechnicalName: "List MCP Tools",
      technicalDescription:
        "Lists tool capability descriptors for one selected MCP server so workflows can browse or choose runnable MCP tools.",
      description:
        "Discover the MCP tools available on the selected server before choosing one for the next workflow step.",
      inputPorts: Object.freeze([
        inputPort(
          "serverHandle",
          "Server Handle",
          ["json", "workflow-state"],
          false,
          "Server handle from Choose MCP Server that scopes tool discovery to one configured MCP server.",
        ),
      ]),
      outputPorts: Object.freeze([
        outputPort(
          "tools",
          "Tools",
          ["json"],
          "Capability-aligned MCP tool descriptors for the selected server.",
        ),
      ]),
      properties: Object.freeze([
        property({
          id: "searchQuery",
          name: "Search Query",
          type: "text",
          value: "",
          defaultValue: "",
          description: "Optional text filter applied to the selected server's discovered MCP tools.",
          order: 0,
        }),
        property({
          id: "includeHiddenTools",
          name: "Include Hidden Tools",
          type: "boolean",
          value: false,
          defaultValue: false,
          description: "Include tools marked hidden in MCP metadata or annotations when supported by the server descriptor.",
          isAdvanced: true,
          order: 1,
        }),
      ]),
      executionKind: "source",
      projection: toolProjection,
    }),
    "mcp.tool_call": metadata({
      technicalName: "mcp.tool_call",
      nonTechnicalName: "Run MCP Tool",
      technicalDescription:
        "Executes a selected MCP tool against the chosen server using structured workflow arguments and returns the runtime result.",
      description:
        "Run a selected MCP tool from a workflow using a chosen server handle and structured arguments.",
      inputPorts: Object.freeze([
        inputPort(
          "serverHandle",
          "Server Handle",
          ["json", "workflow-state"],
          false,
          "Server handle from Choose MCP Server that scopes tool execution to one configured MCP server.",
        ),
        inputPort(
          "tool",
          "Tool",
          ["json", "text"],
          false,
          "Selected MCP tool descriptor, capability descriptor, or tool name to execute on the chosen server.",
        ),
        inputPort(
          "arguments",
          "Arguments",
          ["json"],
          false,
          "Structured arguments object passed to the selected MCP tool.",
        ),
      ]),
      outputPorts: Object.freeze([
        outputPort(
          "toolResult",
          "Tool Result",
          ["json", "tool-result"],
          "The full MCP tool execution result payload.",
        ),
        outputPort(
          "resultText",
          "Result Text",
          ["text"],
          "Optional string representation of the MCP tool output for easy downstream display or prompting.",
        ),
      ]),
      properties: Object.freeze([
        property({
          id: "serverId",
          name: "Server",
          type: "select",
          value: "",
          defaultValue: "",
          description: "Configured MCP server used when no incoming server handle is connected.",
          required: true,
          order: 0,
        }),
        property({
          id: "toolName",
          name: "Tool",
          type: "select",
          value: "",
          defaultValue: "",
          description: "Discovered MCP tool to execute on the selected configured server when no tool input is connected.",
          required: true,
          order: 1,
        }),
        property({
          id: "toolId",
          name: "Installed Tool Id",
          type: "text",
          value: "",
          defaultValue: "",
          description: "Stable installed MCP tool id aligned with registry identity for dependency tracking and execution-time validation.",
          isAdvanced: true,
          isEditable: false,
          order: 2,
          projection: {
            authorVisibility: "hidden",
            toolVisibility: "hidden",
            exposeInAuthorForm: false,
            exposeInTool: false,
          },
        }),
        property({
          id: "toolDescriptor",
          name: "Tool Descriptor",
          type: "json",
          value: {},
          defaultValue: {},
          description: "Persisted MCP tool descriptor snapshot used to materialize authoring fields from the selected tool schema.",
          isAdvanced: true,
          isEditable: false,
          order: 3,
          projection: {
            authorVisibility: "hidden",
            toolVisibility: "hidden",
            exposeInAuthorForm: false,
            exposeInTool: false,
          },
        }),
        property({
          id: "stringifyResult",
          name: "Stringify Result",
          type: "boolean",
          value: true,
          defaultValue: true,
          description: "Produce a text rendering of structured MCP tool output for downstream text-oriented nodes.",
          order: 100,
        }),
        property({
          id: "failOnMissingArgs",
          name: "Fail On Missing Args",
          type: "boolean",
          value: true,
          defaultValue: true,
          description: "Validate required MCP tool arguments before execution and fail fast when any are missing.",
          isAdvanced: true,
          order: 101,
        }),
      ]),
      executionKind: "utility",
      projection: toolProjection,
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
    isVisibleInBasicMode: metadata.isVisibleInBasicMode,
    projection: metadata.projection,
  });
}
