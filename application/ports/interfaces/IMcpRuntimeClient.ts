import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpToolDescriptor } from "../../mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "../../mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../mcp/models/McpToolExecutionResult";

export interface IMcpRuntimeClient {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listTools(): Promise<ReadonlyArray<McpToolDescriptor>>;
  executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult>;
}
