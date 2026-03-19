import type { ConnectMcpServerUseCase } from "../../application/mcp/ConnectMcpServerUseCase";
import type { DisconnectMcpServerUseCase } from "../../application/mcp/DisconnectMcpServerUseCase";
import type { GetMcpServerStatusUseCase } from "../../application/mcp/GetMcpServerStatusUseCase";
import type { ListConfiguredMcpServersUseCase } from "../../application/mcp/ListConfiguredMcpServersUseCase";
import { ListMcpToolsUseCase } from "../../application/mcp/ListMcpToolsUseCase";
import type { IListMcpToolsResult } from "../../application/mcp/ListMcpToolsUseCase";
import type { ReconnectMcpServerUseCase } from "../../application/mcp/ReconnectMcpServerUseCase";
import type { SearchMcpServersUseCase } from "../../application/mcp/SearchMcpServersUseCase";
import type { McpServerConnectionResult } from "../../application/mcp/models/McpServerConnectionResult";
import type { McpServerDescriptor } from "../../application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../application/mcp/models/McpServerSearchResult";
import type { McpServerStatus } from "../../application/mcp/models/McpServerStatus";

export class McpService {
  constructor(
    private readonly listMcpToolsUseCase: ListMcpToolsUseCase,
    private readonly listConfiguredMcpServersUseCase: Pick<ListConfiguredMcpServersUseCase, "execute">,
    private readonly searchMcpServersUseCase: Pick<SearchMcpServersUseCase, "execute">,
    private readonly getMcpServerStatusUseCase: Pick<GetMcpServerStatusUseCase, "execute">,
    private readonly connectMcpServerUseCase: Pick<ConnectMcpServerUseCase, "execute">,
    private readonly disconnectMcpServerUseCase: Pick<DisconnectMcpServerUseCase, "execute">,
    private readonly reconnectMcpServerUseCase: Pick<ReconnectMcpServerUseCase, "execute">,
  ) {}

  public async getRuntimeSnapshot(): Promise<IListMcpToolsResult> {
    return this.listMcpToolsUseCase.execute();
  }

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    return this.listConfiguredMcpServersUseCase.execute();
  }

  public async searchServers(criteria?: McpServerSearchCriteria): Promise<McpServerSearchResult> {
    return this.searchMcpServersUseCase.execute({ criteria });
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
}
