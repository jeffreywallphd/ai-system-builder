import type { IMcpToolCatalog } from "../../../application/ports/interfaces/IMcpToolCatalog";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpToolDescriptor } from "../../../application/mcp/models/McpToolDescriptor";

export class PythonBackedMcpToolCatalog implements IMcpToolCatalog {
  constructor(
    private readonly client: IMcpRuntimeClient,
    private readonly eventSink?: IRuntimeEventSink
  ) {}

  public async getConnectionStatus(): Promise<McpConnectionStatus> {
    return this.client.getConnectionStatus();
  }

  public async listTools(): Promise<ReadonlyArray<McpToolDescriptor>> {
    this.eventSink?.emit({
      source: RuntimeEventSources.pythonRuntime,
      severity: "info",
      message: "MCP tool discovery started.",
      details: { eventType: "mcp-tool-discovery" },
    });

    try {
      const tools = await this.client.listTools();
      this.eventSink?.emit({
        source: RuntimeEventSources.pythonRuntime,
        severity: "success",
        message: "MCP tool discovery completed.",
        details: { eventType: "mcp-tool-discovery", toolCount: tools.length },
      });
      return tools;
    } catch (error) {
      this.eventSink?.emit({
        source: RuntimeEventSources.pythonRuntime,
        severity: "error",
        message: "MCP tool discovery failed.",
        details: {
          eventType: "mcp-tool-discovery",
          cause: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}
