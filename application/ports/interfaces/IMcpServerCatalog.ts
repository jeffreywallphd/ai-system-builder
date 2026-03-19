import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "../../mcp/models/McpServerDescriptor";
import type { McpServerStatus } from "../../mcp/models/McpServerStatus";

export interface IMcpServerCatalog {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>>;
  getServerStatus(serverId: string): Promise<McpServerStatus>;
}
