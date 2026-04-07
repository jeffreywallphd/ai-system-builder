import type { McpToolDefinitionSource } from "@domain/mcp/InstalledMcpTool";
import type { McpToolDefinition } from "@domain/mcp/McpToolCapability";

export interface IMcpToolDefinitionSourceLoader {
  load(source: McpToolDefinitionSource): Promise<McpToolDefinition>;
}

