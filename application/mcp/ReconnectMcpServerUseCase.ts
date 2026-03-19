import type { IMcpServerManager } from "../ports/interfaces/IMcpServerManager";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IReconnectMcpServerRequest {
  readonly serverId: string;
}

export class ReconnectMcpServerUseCase {
  constructor(private readonly serverManager: IMcpServerManager) {}

  public async execute(request: IReconnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Reconnecting an MCP server requires a serverId.");
    }

    return this.serverManager.reconnectServer(serverId);
  }
}
