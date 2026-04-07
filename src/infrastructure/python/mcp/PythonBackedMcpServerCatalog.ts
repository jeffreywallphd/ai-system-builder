import type { IMcpServerCatalog } from "@application/ports/interfaces/IMcpServerCatalog";
import type { McpConnectionStatus } from "@application/mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "@application/mcp/models/McpServerDescriptor";
import type { McpServerStatus } from "@application/mcp/models/McpServerStatus";

export interface IMcpServerCatalogRuntimeClient {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>>;
}

export class PythonBackedMcpServerCatalog implements IMcpServerCatalog {
  constructor(private readonly client: IMcpServerCatalogRuntimeClient) {}

  public async getConnectionStatus(): Promise<McpConnectionStatus> {
    return this.client.getConnectionStatus();
  }

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    return this.client.listConfiguredServers();
  }

  public async getServerStatus(serverId: string): Promise<McpServerStatus> {
    const normalized = serverId.trim();
    if (!normalized) {
      throw new Error("MCP server status lookup requires a serverId.");
    }

    const status = await this.client.getConnectionStatus();
    const serverStatus = status.servers.find((candidate) => candidate.serverId === normalized);
    if (!serverStatus) {
      throw new Error(`Unknown MCP server '${normalized}'.`);
    }

    return serverStatus;
  }
}

