import type { McpServerConnectionRequest } from "../../mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../mcp/models/McpServerConnectionResult";

export interface IMcpServerManager {
  connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult>;
  disconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  reconnectServer(serverId: string): Promise<McpServerConnectionResult>;
}
