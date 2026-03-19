import type { IMcpServerManager } from "../ports/interfaces/IMcpServerManager";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IConnectMcpServerRequest {
  readonly serverId: string;
}

export class ConnectMcpServerUseCase {
  constructor(private readonly serverManager: IMcpServerManager) {}

  public async execute(request: IConnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Connecting an MCP server requires a serverId.");
    }

    return this.serverManager.connectServer({ serverId });
  }
}
