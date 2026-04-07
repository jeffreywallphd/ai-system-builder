import type { McpServerConnectionRequest } from "../../mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../mcp/models/McpServerConnectionResult";
import type { LocalMcpToolDraft } from "../../mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "../../mcp/models/LocalMcpServerCreateResult";

export interface IMcpServerManager {
  connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult>;
  disconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  reconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  createLocalServer(draft: LocalMcpToolDraft): Promise<LocalMcpServerCreateResult>;
}
