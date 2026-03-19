import type { IMcpRuntimeClient } from "../ports/interfaces/IMcpRuntimeClient";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IDisconnectMcpServerRequest {
  readonly serverId: string;
}

export class DisconnectMcpServerUseCase {
  constructor(private readonly runtimeClient: IMcpRuntimeClient) {}

  public async execute(request: IDisconnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Disconnecting an MCP server requires a serverId.");
    }

    return this.runtimeClient.disconnectServer(serverId);
  }
}
