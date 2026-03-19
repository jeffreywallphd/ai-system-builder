import type { IMcpRuntimeClient } from "../ports/interfaces/IMcpRuntimeClient";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IConnectMcpServerRequest {
  readonly serverId: string;
  readonly reconnect?: boolean;
}

export class ConnectMcpServerUseCase {
  constructor(private readonly runtimeClient: IMcpRuntimeClient) {}

  public async execute(request: IConnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Connecting an MCP server requires a serverId.");
    }

    return this.runtimeClient.connectServer({
      serverId,
      reconnect: request.reconnect === true,
    });
  }
}
