import type { IMcpConfiguredServerRepository } from "../../../application/ports/interfaces/IMcpConfiguredServerRepository";
import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";

export interface IMcpConfiguredServerRepositoryRuntimeClient {
  listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>>;
  upsertServer(server: Readonly<Record<string, unknown>>): Promise<McpServerDescriptor>;
}

export class RuntimeBackedMcpConfiguredServerRepository implements IMcpConfiguredServerRepository {
  constructor(private readonly client: IMcpConfiguredServerRepositoryRuntimeClient) {}

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    return this.client.listConfiguredServers();
  }

  public async saveConfiguredServer(server: McpServerDescriptor): Promise<McpServerDescriptor> {
    return this.client.upsertServer({
      id: server.id,
      name: server.name,
      transport: server.transport,
      sourceType: server.sourceType ?? "external-remote",
      enabled: server.enabled ?? true,
      command: server.command,
      args: server.args,
      url: server.url,
      env: server.env,
      headers: server.headers,
      timeoutMs: server.timeoutMs,
      connectOnStartup: server.connectOnStartup,
      metadata: server.metadata,
    });
  }
}
