import type { McpToolExecutionRequest } from "../../mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../mcp/models/McpToolExecutionResult";

export interface IMcpToolExecutor {
  executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult>;
}
