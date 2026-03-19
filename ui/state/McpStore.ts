import type { McpConnectionStatus } from "../../application/mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "../../application/mcp/models/McpServerDescriptor";
import type { McpToolDescriptor } from "../../application/mcp/models/McpToolDescriptor";
import { McpService } from "../services/McpService";

export interface McpStoreState {
  readonly status?: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly searchQuery: string;
  readonly isLoading: boolean;
  readonly error?: string;
}

const defaultState: McpStoreState = Object.freeze({
  tools: Object.freeze([]),
  servers: Object.freeze([]),
  searchQuery: "",
  isLoading: false,
});

export class McpStore {
  private state: McpStoreState = defaultState;
  private readonly listeners = new Set<(state: McpStoreState) => void>();

  constructor(private readonly mcpService: McpService) {}

  public getState(): McpStoreState {
    return this.state;
  }

  public subscribe(listener: (state: McpStoreState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async refresh(): Promise<void> {
    this.patch({ isLoading: true, error: undefined });

    try {
      const [snapshot, searchResult] = await Promise.all([
        this.mcpService.getRuntimeSnapshot(),
        this.mcpService.searchServers({ query: this.state.searchQuery || undefined }),
      ]);
      this.patch({
        status: snapshot.status,
        tools: Object.freeze([...snapshot.tools]),
        servers: Object.freeze([...searchResult.servers]),
        isLoading: false,
        error: undefined,
      });
    } catch (error) {
      this.patch({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown MCP runtime error.",
      });
      throw error;
    }
  }

  public async search(query: string): Promise<void> {
    this.patch({ isLoading: true, searchQuery: query, error: undefined });

    try {
      const result = await this.mcpService.searchServers({ query: query || undefined });
      this.patch({
        status: result.status,
        servers: Object.freeze([...result.servers]),
        isLoading: false,
      });
    } catch (error) {
      this.patch({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown MCP runtime error.",
      });
      throw error;
    }
  }

  public async connect(serverId: string, reconnect = false): Promise<void> {
    await this.mcpService.connectServer(serverId, reconnect);
    const descriptor = await this.mcpService.getServerStatus(serverId);
    this.upsertServer(descriptor);
    await this.refresh();
  }

  public async disconnect(serverId: string): Promise<void> {
    await this.mcpService.disconnectServer(serverId);
    const descriptor = await this.mcpService.getServerStatus(serverId);
    this.upsertServer(descriptor);
    await this.refresh();
  }

  private upsertServer(server: McpServerDescriptor): void {
    const next = [...this.state.servers];
    const index = next.findIndex((item) => item.id === server.id);
    if (index >= 0) {
      next[index] = server;
    } else {
      next.push(server);
    }

    this.patch({ servers: Object.freeze(next) });
  }

  private patch(patch: Partial<McpStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      tools: patch.tools ? Object.freeze([...patch.tools]) : this.state.tools,
      servers: patch.servers ? Object.freeze([...patch.servers]) : this.state.servers,
      searchQuery: patch.searchQuery ?? this.state.searchQuery,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
