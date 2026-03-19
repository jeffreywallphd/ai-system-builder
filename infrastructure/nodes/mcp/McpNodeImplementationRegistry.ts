import {
  buildMcpNodeCatalogDescriptor,
  MCP_NODE_REGISTRATIONS,
} from "./McpNodeRegistrationCatalog";
import { NodeImplementationDescriptor } from "../shared/NodeImplementationDescriptor";
import { NodeImplementationRegistry } from "../shared/NodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "../shared/INodeRuntimeImplementation";

function mcpImplementation(nodeTypeId: string): INodeRuntimeImplementation {
  const registration = MCP_NODE_REGISTRATIONS.find(
    (candidate) => candidate.nodeTypeId === nodeTypeId,
  );

  if (!registration) {
    throw new Error(`Missing MCP registration for ${nodeTypeId}.`);
  }

  const nodeDefinition = buildMcpNodeCatalogDescriptor(
    registration.nodeTypeId,
    registration.category,
  );

  if (!nodeDefinition) {
    throw new Error(`Missing MCP catalog metadata for ${nodeTypeId}.`);
  }

  const isInfrastructureNode = registration.nodeTypeId === "mcp.server_select";

  return {
    descriptor: new NodeImplementationDescriptor({
      providerId: "mcp",
      runtimeId: "python",
      nodeTypeId: registration.nodeTypeId,
      title: nodeDefinition.title,
      executionStyles: registration.executionStyles,
      metadata: {
        bridgeProvider: "python-mcp-runtime",
        category: registration.category,
        boundary: "python",
        infrastructureBoundary: isInfrastructureNode ? "selection" : "tool-usage",
        isAdvancedInfrastructure: isInfrastructureNode,
      },
      nodeDefinition,
    }),
  };
}

const MCP_IMPLEMENTATIONS: ReadonlyArray<INodeRuntimeImplementation> = Object.freeze(
  MCP_NODE_REGISTRATIONS.map((registration) => mcpImplementation(registration.nodeTypeId)),
);

export class McpNodeImplementationRegistry extends NodeImplementationRegistry {
  constructor() {
    super({
      providerId: "mcp",
      implementations: MCP_IMPLEMENTATIONS,
    });
  }
}
