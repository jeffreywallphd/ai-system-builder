import type { IMcpServerCatalog } from "@application/ports/interfaces/IMcpServerCatalog";
import type { IMcpConfiguredServerRepository } from "@application/ports/interfaces/IMcpConfiguredServerRepository";
import type { McpConnectionStatus } from "@application/mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "@application/mcp/models/McpServerDescriptor";
import type { McpServerStatus } from "@application/mcp/models/McpServerStatus";

export class ConfiguredMcpServerCatalog implements IMcpServerCatalog {
  constructor(
    private readonly runtimeCatalog: IMcpServerCatalog,
    private readonly repository: IMcpConfiguredServerRepository,
  ) {}

  public async getConnectionStatus(): Promise<McpConnectionStatus> {
    return this.runtimeCatalog.getConnectionStatus();
  }

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    const persistedServers = await this.repository.listConfiguredServers();
    let runtimeServers: ReadonlyArray<McpServerDescriptor> = Object.freeze([]);

    try {
      runtimeServers = await this.runtimeCatalog.listConfiguredServers();
    } catch {
      runtimeServers = Object.freeze([]);
    }

    const merged = new Map<string, McpServerDescriptor>();

    for (const server of persistedServers) {
      merged.set(server.id, server);
    }

    for (const server of runtimeServers) {
      const persisted = merged.get(server.id);
      merged.set(
        server.id,
        Object.freeze({
          ...persisted,
          ...server,
          capabilities: Object.freeze({ ...(persisted?.capabilities ?? {}), ...(server.capabilities ?? {}) }),
          metadata: Object.freeze({ ...(persisted?.metadata ?? {}), ...(server.metadata ?? {}) }),
        }),
      );
    }

    return Object.freeze([...merged.values()].sort((left, right) => left.name.localeCompare(right.name)));
  }

  public async getServerStatus(serverId: string): Promise<McpServerStatus> {
    try {
      return await this.runtimeCatalog.getServerStatus(serverId);
    } catch {
      const configured = (await this.repository.listConfiguredServers()).find(
        (server) => server.id === serverId.trim(),
      );

      if (!configured) {
        throw new Error(`Unknown MCP server '${serverId.trim()}'.`);
      }

      return Object.freeze({
        serverId: configured.id,
        name: configured.name,
        transport: configured.transport,
        configured: true,
        enabled: configured.enabled ?? true,
        state: configured.status === "error" ? "error" : "disconnected",
        connected: configured.connected ?? false,
        checkedAt: configured.checkedAt ?? new Date().toISOString(),
        connectedAt: configured.connectedAt,
        disconnectedAt: configured.disconnectedAt,
        toolCount: configured.toolCount,
        resourceCount: configured.resourceCount,
        capabilities: Object.freeze({ ...(configured.capabilities ?? {}) }),
        errorMessage: configured.errorMessage,
        metadata: configured.metadata ? Object.freeze({ ...configured.metadata }) : undefined,
      });
    }
  }
}

