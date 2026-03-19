import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "../../mcp/models/McpResourceDescriptor";
import type { McpToolDescriptor } from "../../mcp/models/McpToolDescriptor";

export interface IMcpToolCatalog {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listTools(): Promise<ReadonlyArray<McpToolDescriptor>>;
  listResources?(): Promise<ReadonlyArray<McpResourceDescriptor>>;
}
