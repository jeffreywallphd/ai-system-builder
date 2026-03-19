import type { IMcpRuntimeClient } from "../ports/interfaces/IMcpRuntimeClient";
import type { McpServerDescriptor } from "./models/McpServerDescriptor";

export interface IGetMcpServerStatusRequest {
  readonly serverId: string;
}

export class GetMcpServerStatusUseCase {
  constructor(private readonly runtimeClient: IMcpRuntimeClient) {}

  public async execute(request: IGetMcpServerStatusRequest): Promise<McpServerDescriptor> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("MCP server status lookup requires a serverId.");
    }

    const response = await this.runtimeClient.listServers();
    const server = response.servers.find((item) => item.id === serverId);

    if (!server) {
      throw new Error(`Unknown MCP server '${serverId}'.`);
    }

    return server;
  }
}
