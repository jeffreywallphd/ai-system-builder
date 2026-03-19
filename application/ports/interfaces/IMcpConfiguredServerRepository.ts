import type { McpServerDescriptor } from "../../mcp/models/McpServerDescriptor";

export interface IMcpConfiguredServerRepository {
  listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>>;
  saveConfiguredServer(server: McpServerDescriptor): Promise<McpServerDescriptor>;
}
