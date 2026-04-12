import type { AddConfiguredMcpServerUseCase } from "@application/mcp/AddConfiguredMcpServerUseCase";
import type { ConnectMcpServerUseCase } from "@application/mcp/ConnectMcpServerUseCase";
import type { CreateLocalMcpServerUseCase } from "@application/mcp/CreateLocalMcpServerUseCase";
import type { DisconnectMcpServerUseCase } from "@application/mcp/DisconnectMcpServerUseCase";
import type { GenerateLocalMcpToolDraftUseCase } from "@application/mcp/GenerateLocalMcpToolDraftUseCase";
import type { GetMcpConnectionStatusUseCase } from "@application/mcp/GetMcpConnectionStatusUseCase";
import type { GetMcpServerStatusUseCase } from "@application/mcp/GetMcpServerStatusUseCase";
import type { GetMcpToolDescriptorUseCase } from "@application/mcp/GetMcpToolDescriptorUseCase";
import type { ListConfiguredMcpServersUseCase } from "@application/mcp/ListConfiguredMcpServersUseCase";
import type { ReconnectMcpServerUseCase } from "@application/mcp/ReconnectMcpServerUseCase";
import type { SearchMcpServersUseCase } from "@application/mcp/SearchMcpServersUseCase";
import type { SearchMcpToolsUseCase } from "@application/mcp/SearchMcpToolsUseCase";
import type { LocalMcpToolDraft } from "@application/mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "@application/mcp/models/LocalMcpServerCreateResult";
import type { McpServerConnectionResult } from "@application/mcp/models/McpServerConnectionResult";
import type { McpConnectionStatus } from "@application/mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "@application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "@application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "@application/mcp/models/McpServerSearchResult";
import type { McpServerStatus } from "@application/mcp/models/McpServerStatus";
import type { McpToolDescriptor } from "@application/mcp/models/McpToolDescriptor";
import type { McpToolSearchQuery } from "@application/mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "@application/mcp/models/McpToolSearchResult";

export class McpService {
  constructor(
    private readonly listConfiguredMcpServersUseCase: Pick<ListConfiguredMcpServersUseCase, "execute">,
    private readonly searchMcpServersUseCase: Pick<SearchMcpServersUseCase, "execute">,
    private readonly addConfiguredMcpServerUseCase: Pick<AddConfiguredMcpServerUseCase, "execute">,
    private readonly getMcpConnectionStatusUseCase: Pick<GetMcpConnectionStatusUseCase, "execute">,
    private readonly getMcpServerStatusUseCase: Pick<GetMcpServerStatusUseCase, "execute">,
    private readonly connectMcpServerUseCase: Pick<ConnectMcpServerUseCase, "execute">,
    private readonly disconnectMcpServerUseCase: Pick<DisconnectMcpServerUseCase, "execute">,
    private readonly reconnectMcpServerUseCase: Pick<ReconnectMcpServerUseCase, "execute">,
    private readonly searchMcpToolsUseCase: Pick<SearchMcpToolsUseCase, "execute">,
    private readonly getMcpToolDescriptorUseCase: Pick<GetMcpToolDescriptorUseCase, "execute">,
    private readonly createLocalMcpServerUseCase: Pick<CreateLocalMcpServerUseCase, "execute">,
    private readonly generateLocalMcpToolDraftUseCase: Pick<GenerateLocalMcpToolDraftUseCase, "execute">,
  ) {}

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    return this.listConfiguredMcpServersUseCase.execute();
  }

  public async searchServers(criteria?: McpServerSearchCriteria): Promise<McpServerSearchResult> {
    return this.searchMcpServersUseCase.execute({ criteria });
  }

  public async addConfiguredServer(server: McpServerDescriptor): Promise<McpServerDescriptor> {
    return this.addConfiguredMcpServerUseCase.execute({ server });
  }

  public async getConnectionStatus(): Promise<McpConnectionStatus> {
    return this.getMcpConnectionStatusUseCase.execute();
  }

  public async getServerStatus(serverId: string): Promise<McpServerStatus> {
    return this.getMcpServerStatusUseCase.execute({ serverId });
  }

  public async connectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.connectMcpServerUseCase.execute({ serverId });
  }

  public async reconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.reconnectMcpServerUseCase.execute({ serverId });
  }

  public async disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.disconnectMcpServerUseCase.execute({ serverId });
  }

  public async searchTools(query?: McpToolSearchQuery): Promise<McpToolSearchResult> {
    return this.searchMcpToolsUseCase.execute({ query });
  }

  public async getToolDescriptor(toolId: string): Promise<McpToolDescriptor | undefined> {
    return this.getMcpToolDescriptorUseCase.execute({ toolId });
  }

  public async createLocalServer(draft: LocalMcpToolDraft): Promise<LocalMcpServerCreateResult> {
    return this.createLocalMcpServerUseCase.execute({ draft });
  }

  public async generateLocalToolDraft(prompt: string, currentDraft: LocalMcpToolDraft) {
    return this.generateLocalMcpToolDraftUseCase.execute({
      prompt,
      serverId: currentDraft.serverId,
      serverName: currentDraft.serverName,
      toolName: currentDraft.toolName,
      toolTitle: currentDraft.toolTitle,
      toolDescription: currentDraft.toolDescription,
    });
  }
}

