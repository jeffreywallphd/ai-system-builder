import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpToolExecutor } from "../../../application/ports/interfaces/IMcpToolExecutor";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { toRuntimeDiagnosticDetails } from "../../../application/runtime/RuntimeDiagnostics";
import type { McpToolExecutionRequest } from "../../../application/mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../../application/mcp/models/McpToolExecutionResult";

export class PythonBackedMcpToolExecutor implements IMcpToolExecutor {
  constructor(
    private readonly client: IMcpRuntimeClient,
    private readonly eventSink?: IRuntimeEventSink
  ) {}

  public async executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    this.eventSink?.emit({
      source: RuntimeEventSources.pythonRuntime,
      severity: "info",
      message: "MCP tool execution started.",
      details: {
        eventType: "mcp-tool-execution-start",
        serverId: request.serverId,
        toolName: request.toolName,
      },
    });

    try {
      const result = await this.client.executeTool(request);
      this.eventSink?.emit({
        source: RuntimeEventSources.pythonRuntime,
        severity: result.status === "completed" ? "success" : "error",
        message:
          result.status === "completed"
            ? "MCP tool execution completed."
            : "MCP tool execution failed.",
        details: {
          eventType:
            result.status === "completed"
              ? "mcp-tool-execution-success"
              : "mcp-tool-execution-failure",
          executionId: result.executionId,
          serverId: result.serverId,
          toolName: result.toolName,
          errorMessage: result.errorMessage,
        },
      });
      return result;
    } catch (error) {
      this.eventSink?.emit({
        source: RuntimeEventSources.pythonRuntime,
        severity: "error",
        message: "MCP tool execution failed.",
        details: toRuntimeDiagnosticDetails(error, {
          subsystem: "mcp-runtime",
          className: "PythonBackedMcpToolExecutor",
          methodName: "executeTool",
          operation: "mcp-tool-execution",
          details: request,
        }, {
          eventType: "mcp-tool-execution-failure",
          serverId: request.serverId,
          toolName: request.toolName,
        }),
      });
      throw error;
    }
  }
}
