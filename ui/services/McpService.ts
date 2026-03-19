import type { ConnectMcpServerUseCase } from "../../application/mcp/ConnectMcpServerUseCase";
import type { DisconnectMcpServerUseCase } from "../../application/mcp/DisconnectMcpServerUseCase";
import type { GetMcpServerStatusUseCase } from "../../application/mcp/GetMcpServerStatusUseCase";
import { ListMcpToolsUseCase } from "../../application/mcp/ListMcpToolsUseCase";
import type { IListMcpToolsResult } from "../../application/mcp/ListMcpToolsUseCase";
import type { SearchMcpServersUseCase } from "../../application/mcp/SearchMcpServersUseCase";
import type { McpServerConnectionResult } from "../../application/mcp/models/McpServerConnectionResult";
import type { McpServerDescriptor } from "../../application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../application/mcp/models/McpServerSearchResult";

export class McpService {
  constructor(
    private readonly listMcpToolsUseCase: ListMcpToolsUseCase,
    private readonly searchMcpServersUseCase: Pick<SearchMcpServersUseCase, "execute">,
    private readonly getMcpServerStatusUseCase: Pick<GetMcpServerStatusUseCase, "execute">,
    private readonly connectMcpServerUseCase: Pick<ConnectMcpServerUseCase, "execute">,
    private readonly disconnectMcpServerUseCase: Pick<DisconnectMcpServerUseCase, "execute">
  ) {}

  public async getRuntimeSnapshot(): Promise<IListMcpToolsResult> {
    return this.listMcpToolsUseCase.execute();
  }

  public async searchServers(criteria?: McpServerSearchCriteria): Promise<McpServerSearchResult> {
    return this.searchMcpServersUseCase.execute({ criteria });
  }

  public async getServerStatus(serverId: string): Promise<McpServerDescriptor> {
    return this.getMcpServerStatusUseCase.execute({ serverId });
  }

  public async connectServer(serverId: string, reconnect = false): Promise<McpServerConnectionResult> {
    return this.connectMcpServerUseCase.execute({ serverId, reconnect });
  }

  public async disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.disconnectMcpServerUseCase.execute({ serverId });
  }
}
