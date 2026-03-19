import type { IMcpServerManager } from "../ports/interfaces/IMcpServerManager";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IDisconnectMcpServerRequest {
  readonly serverId: string;
}

export class DisconnectMcpServerUseCase {
  constructor(private readonly serverManager: IMcpServerManager) {}

  public async execute(request: IDisconnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Disconnecting an MCP server requires a serverId.");
    }

    return this.serverManager.disconnectServer(serverId);
  }
}
