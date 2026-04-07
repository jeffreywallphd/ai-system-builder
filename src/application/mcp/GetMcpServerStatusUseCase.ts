import type { IMcpServerCatalog } from "../ports/interfaces/IMcpServerCatalog";
import type { McpServerStatus } from "./models/McpServerStatus";

export interface IGetMcpServerStatusRequest {
  readonly serverId: string;
}

export class GetMcpServerStatusUseCase {
  constructor(private readonly catalog: IMcpServerCatalog) {}

  public async execute(request: IGetMcpServerStatusRequest): Promise<McpServerStatus> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("MCP server status lookup requires a serverId.");
    }

    return this.catalog.getServerStatus(serverId);
  }
}
