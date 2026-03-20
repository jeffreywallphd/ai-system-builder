import type { McpServerDescriptor } from "../../application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerStatus } from "../../application/mcp/models/McpServerStatus";
import type { McpToolDescriptor } from "../../application/mcp/models/McpToolDescriptor";
import { McpService } from "../services/McpService";

export interface McpStoreState {
  readonly configuredServers: ReadonlyArray<McpServerDescriptor>;
  readonly discoveredServers: ReadonlyArray<McpServerDescriptor>;
  readonly selectedServerId?: string;
  readonly selectedServerStatus?: McpServerStatus;
  readonly selectedServerTools: ReadonlyArray<McpToolDescriptor>;
  readonly selectedToolId?: string;
  readonly selectedToolDescriptor?: McpToolDescriptor;
  readonly toolSearchQuery: string;
  readonly searchCriteria?: McpServerSearchCriteria;
  readonly searchQuery: string;
  readonly isLoadingConfigured: boolean;
  readonly isSearching: boolean;
  readonly isMutating: boolean;
  readonly isLoadingTools: boolean;
  readonly error?: string;
}

export type McpStoreListener = (state: McpStoreState) => void;

const defaultState: McpStoreState = Object.freeze({
  configuredServers: Object.freeze([]),
  discoveredServers: Object.freeze([]),
  selectedServerId: undefined,
  selectedServerStatus: undefined,
  selectedServerTools: Object.freeze([]),
  selectedToolId: undefined,
  selectedToolDescriptor: undefined,
  toolSearchQuery: "",
  searchCriteria: undefined,
  searchQuery: "",
  isLoadingConfigured: false,
  isSearching: false,
  isMutating: false,
  isLoadingTools: false,
  error: undefined,
});

export class McpStore {
  private state: McpStoreState = defaultState;
  private readonly listeners = new Set<McpStoreListener>();

  constructor(private readonly mcpService: McpService) {}

  public getState(): McpStoreState {
    return this.state;
  }

  public subscribe(listener: McpStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async refreshConfigured(): Promise<void> {
    this.patch({ isLoadingConfigured: true, error: undefined });

    try {
      const configuredServers = await this.mcpService.listConfiguredServers();
      const selectedServerId = this.resolveSelectedServerId(configuredServers, this.state.discoveredServers);
      const selectedServerStatus = selectedServerId
        ? await this.loadStatusSafely(selectedServerId)
        : undefined;

      this.patch({
        configuredServers: Object.freeze([...configuredServers]),
        selectedServerId,
        selectedServerStatus,
        isLoadingConfigured: false,
      });

      await this.refreshSelectedTools(selectedServerId);
    } catch (error) {
      this.patch({
        isLoadingConfigured: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async search(criteria: McpServerSearchCriteria = {}): Promise<void> {
    const normalizedCriteria = Object.freeze({
      ...criteria,
      query: criteria.query?.trim() || undefined,
    });

    this.patch({
      isSearching: true,
      searchCriteria: normalizedCriteria,
      searchQuery: normalizedCriteria.query ?? "",
      error: undefined,
    });

    try {
      const result = await this.mcpService.searchServers(normalizedCriteria);
      const selectedServerId = this.resolveSelectedServerId(this.state.configuredServers, result.servers);
      const selectedServerStatus = selectedServerId
        ? await this.loadStatusSafely(selectedServerId)
        : undefined;

      this.patch({
        discoveredServers: Object.freeze([...result.servers]),
        selectedServerId,
        selectedServerStatus,
        isSearching: false,
      });

      await this.refreshSelectedTools(selectedServerId);
    } catch (error) {
      this.patch({
        isSearching: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async initialize(): Promise<void> {
    const results = await Promise.allSettled([
      this.refreshConfigured(),
      this.search({ query: this.state.searchQuery || undefined }),
    ]);

    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejected) {
      throw rejected.reason;
    }
  }

  public async addConfiguredServer(serverId: string): Promise<void> {
    const server = this.getServerById(serverId);
    if (!server) {
      throw new Error(`Unable to add MCP server '${serverId}' because it is not in the current results.`);
    }

    this.patch({ isMutating: true, error: undefined });

    try {
      await this.mcpService.addConfiguredServer({
        ...server,
        status: server.status === "connected" ? server.status : "disconnected",
        connected: server.connected ?? false,
      });
      await this.refreshConfigured();
      this.selectServer(server.id);
      this.patch({ isMutating: false });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async connect(serverId: string, reconnect = false): Promise<void> {
    this.patch({ isMutating: true, error: undefined });

    try {
      if (reconnect) {
        await this.mcpService.reconnectServer(serverId);
      } else {
        await this.mcpService.connectServer(serverId);
      }

      await this.refreshConfigured();
      await this.refreshSelectedStatus(serverId);
      await this.refreshSelectedTools(serverId);
      this.patch({ isMutating: false });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async disconnect(serverId: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });

    try {
      await this.mcpService.disconnectServer(serverId);
      await this.refreshConfigured();
      await this.refreshSelectedStatus(serverId);
      await this.refreshSelectedTools(serverId);
      this.patch({ isMutating: false });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public selectServer(serverId: string | undefined): void {
    const normalizedId = serverId?.trim() || undefined;
    this.patch({ selectedServerId: normalizedId, selectedToolId: undefined, selectedToolDescriptor: undefined });

    if (!normalizedId) {
      this.patch({ selectedServerStatus: undefined, selectedServerTools: Object.freeze([]), toolSearchQuery: "" });
      return;
    }

    void Promise.all([
      this.refreshSelectedStatus(normalizedId),
      this.refreshSelectedTools(normalizedId),
    ]).catch(() => undefined);
  }

  public async searchTools(query: string): Promise<void> {
    const normalizedQuery = query.trim();
    this.patch({ toolSearchQuery: normalizedQuery });
    await this.refreshSelectedTools(this.state.selectedServerId, normalizedQuery);
  }

  public async selectTool(toolId: string | undefined): Promise<void> {
    const normalizedId = toolId?.trim() || undefined;
    this.patch({ selectedToolId: normalizedId });

    if (!normalizedId) {
      this.patch({ selectedToolDescriptor: undefined });
      return;
    }

    try {
      const descriptor = await this.mcpService.getToolDescriptor(normalizedId);
      this.patch({ selectedToolDescriptor: descriptor });
    } catch (error) {
      this.patch({ error: toErrorMessage(error) });
      throw error;
    }
  }

  public getSelectedServer(): McpServerDescriptor | undefined {
    return this.getServerById(this.state.selectedServerId);
  }

  private async refreshSelectedStatus(serverId: string): Promise<void> {
    const selectedServerStatus = await this.loadStatusSafely(serverId);
    this.patch({
      selectedServerId: serverId.trim(),
      selectedServerStatus,
    });
  }

  private async refreshSelectedTools(serverId?: string, query = this.state.toolSearchQuery): Promise<void> {
    const normalizedServerId = serverId?.trim();
    if (!normalizedServerId) {
      this.patch({
        selectedServerTools: Object.freeze([]),
        selectedToolId: undefined,
        selectedToolDescriptor: undefined,
        isLoadingTools: false,
      });
      return;
    }

    this.patch({ isLoadingTools: true, toolSearchQuery: query, error: undefined });

    try {
      const result = await this.mcpService.searchTools({
        query: query.trim() || undefined,
        serverIds: [normalizedServerId],
      });
      const selectedToolId = this.resolveSelectedToolId(result.tools);
      const selectedToolDescriptor = selectedToolId
        ? await this.mcpService.getToolDescriptor(selectedToolId)
        : undefined;

      this.patch({
        selectedServerTools: Object.freeze([...result.tools]),
        selectedToolId,
        selectedToolDescriptor,
        isLoadingTools: false,
      });
    } catch (error) {
      this.patch({
        isLoadingTools: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  private async loadStatusSafely(serverId: string): Promise<McpServerStatus | undefined> {
    try {
      return await this.mcpService.getServerStatus(serverId);
    } catch {
      return undefined;
    }
  }

  private getServerById(serverId?: string): McpServerDescriptor | undefined {
    if (!serverId) {
      return undefined;
    }

    return [...this.state.configuredServers, ...this.state.discoveredServers].find(
      (server) => server.id === serverId,
    );
  }

  private resolveSelectedServerId(
    configuredServers: ReadonlyArray<McpServerDescriptor>,
    discoveredServers: ReadonlyArray<McpServerDescriptor>,
  ): string | undefined {
    const candidates = [...configuredServers, ...discoveredServers];
    const current = this.state.selectedServerId;

    if (current && candidates.some((server) => server.id === current)) {
      return current;
    }

    return candidates[0]?.id;
  }

  private resolveSelectedToolId(tools: ReadonlyArray<McpToolDescriptor>): string | undefined {
    const current = this.state.selectedToolId;
    if (current && tools.some((tool) => tool.id === current)) {
      return current;
    }

    return tools[0]?.id;
  }

  private patch(patch: Partial<McpStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      configuredServers: patch.configuredServers
        ? Object.freeze([...patch.configuredServers])
        : this.state.configuredServers,
      discoveredServers: patch.discoveredServers
        ? Object.freeze([...patch.discoveredServers])
        : this.state.discoveredServers,
      selectedServerTools: patch.selectedServerTools
        ? Object.freeze([...patch.selectedServerTools])
        : this.state.selectedServerTools,
      searchCriteria: "searchCriteria" in patch
        ? (patch.searchCriteria ? Object.freeze({ ...patch.searchCriteria }) : undefined)
        : this.state.searchCriteria,
      selectedServerStatus: "selectedServerStatus" in patch ? patch.selectedServerStatus : this.state.selectedServerStatus,
      selectedToolDescriptor: "selectedToolDescriptor" in patch ? patch.selectedToolDescriptor : this.state.selectedToolDescriptor,
      searchQuery: patch.searchQuery ?? this.state.searchQuery,
      toolSearchQuery: patch.toolSearchQuery ?? this.state.toolSearchQuery,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MCP page error.";
}
