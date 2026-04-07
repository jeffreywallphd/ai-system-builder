import type { IMcpConfiguredServerRepository } from "../../../application/ports/interfaces/IMcpConfiguredServerRepository";
import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";

const defaultStorageKey = "ai-loom-studio.mcp-configured-servers";

export class LocalStorageMcpConfiguredServerRepository implements IMcpConfiguredServerRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return Object.freeze([]);
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<McpServerDescriptor>;
      return Object.freeze(parsed.map((server) => Object.freeze({
        ...server,
        args: server.args ? Object.freeze([...server.args]) : undefined,
        env: server.env ? Object.freeze({ ...server.env }) : undefined,
        capabilities: Object.freeze({ ...(server.capabilities ?? {}) }),
        metadata: server.metadata ? Object.freeze({ ...server.metadata }) : undefined,
      })));
    } catch {
      return Object.freeze([]);
    }
  }

  public async saveConfiguredServer(server: McpServerDescriptor): Promise<McpServerDescriptor> {
    const current = await this.listConfiguredServers();
    const next = Object.freeze([
      ...current.filter((candidate) => candidate.id !== server.id),
      server,
    ]);

    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return server;
  }
}
