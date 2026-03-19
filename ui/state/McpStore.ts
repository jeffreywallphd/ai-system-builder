import type { McpConnectionStatus } from "../../application/mcp/models/McpConnectionStatus";
import type { McpToolDescriptor } from "../../application/mcp/models/McpToolDescriptor";
import { McpService } from "../services/McpService";

export interface McpStoreState {
  readonly status?: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly isLoading: boolean;
  readonly error?: string;
}

const defaultState: McpStoreState = Object.freeze({
  tools: Object.freeze([]),
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
      const snapshot = await this.mcpService.getRuntimeSnapshot();
      this.patch({
        status: snapshot.status,
        tools: Object.freeze([...snapshot.tools]),
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

  private patch(patch: Partial<McpStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      tools: patch.tools ? Object.freeze([...patch.tools]) : this.state.tools,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
