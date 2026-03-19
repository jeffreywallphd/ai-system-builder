import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "../../mcp/models/McpResourceDescriptor";
import type { McpServerConnectionRequest } from "../../mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../mcp/models/McpServerConnectionResult";
import type { McpServerSearchCriteria } from "../../mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../mcp/models/McpServerSearchResult";
import type { McpToolDescriptor } from "../../mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "../../mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../mcp/models/McpToolExecutionResult";
import type { McpToolSearchQuery } from "../../mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "../../mcp/models/McpToolSearchResult";

export interface IMcpRuntimeClient {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listServers(): Promise<McpServerSearchResult>;
  searchServers(criteria?: McpServerSearchCriteria): Promise<McpServerSearchResult>;
  connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult>;
  disconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  listTools(): Promise<ReadonlyArray<McpToolDescriptor>>;
  searchTools(query?: McpToolSearchQuery): Promise<McpToolSearchResult>;
  getToolDescriptor(toolId: string): Promise<McpToolDescriptor | undefined>;
  listResources?(): Promise<ReadonlyArray<McpResourceDescriptor>>;
  executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult>;
}
