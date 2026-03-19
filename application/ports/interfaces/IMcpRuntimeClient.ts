import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpServerConnectionRequest } from "../../mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../mcp/models/McpServerConnectionResult";
import type { McpServerSearchCriteria } from "../../mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../mcp/models/McpServerSearchResult";
import type { McpToolDescriptor } from "../../mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "../../mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../mcp/models/McpToolExecutionResult";

export interface IMcpRuntimeClient {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listServers(): Promise<McpServerSearchResult>;
  searchServers(criteria?: McpServerSearchCriteria): Promise<McpServerSearchResult>;
  connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult>;
  disconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  listTools(): Promise<ReadonlyArray<McpToolDescriptor>>;
  executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult>;
}
