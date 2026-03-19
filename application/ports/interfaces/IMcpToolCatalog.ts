import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "../../mcp/models/McpResourceDescriptor";
import type { McpToolDescriptor } from "../../mcp/models/McpToolDescriptor";
import type { McpToolSearchQuery } from "../../mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "../../mcp/models/McpToolSearchResult";

export interface IMcpToolCatalog {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listTools(): Promise<ReadonlyArray<McpToolDescriptor>>;
  searchTools?(query?: McpToolSearchQuery): Promise<McpToolSearchResult>;
  getToolDescriptor?(toolId: string): Promise<McpToolDescriptor | undefined>;
  listResources?(): Promise<ReadonlyArray<McpResourceDescriptor>>;
}
