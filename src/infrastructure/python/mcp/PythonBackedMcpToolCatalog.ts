import type { IMcpToolCatalog } from "../../../application/ports/interfaces/IMcpToolCatalog";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { toRuntimeDiagnosticDetails } from "../../../application/runtime/RuntimeDiagnostics";
import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "../../../application/mcp/models/McpResourceDescriptor";
import {
  normalizeMcpToolDescriptor,
  type McpToolDescriptor,
} from "../../../application/mcp/models/McpToolDescriptor";
import type { McpToolSearchQuery } from "../../../application/mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "../../../application/mcp/models/McpToolSearchResult";

export class PythonBackedMcpToolCatalog implements IMcpToolCatalog {
  constructor(
    private readonly client: IMcpRuntimeClient,
    private readonly eventSink?: IRuntimeEventSink
  ) {}

  public async getConnectionStatus(): Promise<McpConnectionStatus> {
    return this.client.getConnectionStatus();
  }

  public async listTools(): Promise<ReadonlyArray<McpToolDescriptor>> {
    this.emit("info", "MCP tool discovery started.", { eventType: "mcp-tool-discovery" });

    try {
      const tools = await this.client.listTools();
      const normalizedTools = Object.freeze(tools.map((tool) => normalizeMcpToolDescriptor(tool)));
      this.emit("success", "MCP tool discovery completed.", {
        eventType: "mcp-tool-discovery",
        toolCount: normalizedTools.length,
      });
      return normalizedTools;
    } catch (error) {
      this.emit("error", "MCP tool discovery failed.", toRuntimeDiagnosticDetails(error, {
        subsystem: "mcp-runtime",
        className: "PythonBackedMcpToolCatalog",
        methodName: "listTools",
        operation: "mcp-tool-discovery",
      }, {
        eventType: "mcp-tool-discovery",
      }));
      throw error;
    }
  }

  public async searchTools(query: McpToolSearchQuery = {}): Promise<McpToolSearchResult> {
    this.emit("info", "MCP tool search started.", {
      eventType: "mcp-tool-search",
      query: query.query ?? "",
    });

    try {
      const result = await this.client.searchTools(query);
      const normalizedTools = Object.freeze(result.tools.map((tool) => normalizeMcpToolDescriptor(tool)));
      this.emit("success", "MCP tool search completed.", {
        eventType: "mcp-tool-search",
        toolCount: normalizedTools.length,
      });
      return Object.freeze({ ...result, tools: normalizedTools });
    } catch (error) {
      this.emit("error", "MCP tool search failed.", toRuntimeDiagnosticDetails(error, {
        subsystem: "mcp-runtime",
        className: "PythonBackedMcpToolCatalog",
        methodName: "searchTools",
        operation: "mcp-tool-search",
        details: query,
      }, {
        eventType: "mcp-tool-search",
      }));
      throw error;
    }
  }

  public async getToolDescriptor(toolId: string): Promise<McpToolDescriptor | undefined> {
    this.emit("info", "MCP tool descriptor lookup started.", {
      eventType: "mcp-tool-descriptor",
      toolId,
    });

    try {
      const descriptor = await this.client.getToolDescriptor(toolId);
      const normalizedDescriptor = descriptor ? normalizeMcpToolDescriptor(descriptor) : undefined;
      this.emit("success", "MCP tool descriptor lookup completed.", {
        eventType: "mcp-tool-descriptor",
        toolId,
        found: normalizedDescriptor !== undefined,
      });
      return normalizedDescriptor;
    } catch (error) {
      this.emit("error", "MCP tool descriptor lookup failed.", toRuntimeDiagnosticDetails(error, {
        subsystem: "mcp-runtime",
        className: "PythonBackedMcpToolCatalog",
        methodName: "getToolDescriptor",
        operation: "mcp-tool-descriptor",
        details: { toolId },
      }, {
        eventType: "mcp-tool-descriptor",
        toolId,
      }));
      throw error;
    }
  }

  public async listResources(): Promise<ReadonlyArray<McpResourceDescriptor>> {
    if (typeof this.client.listResources !== "function") {
      return Object.freeze([]);
    }

    return this.client.listResources();
  }

  private emit(
    severity: "info" | "success" | "error",
    message: string,
    details: Readonly<Record<string, unknown>>
  ): void {
    this.eventSink?.emit({
      source: RuntimeEventSources.pythonRuntime,
      severity,
      message,
      details,
    });
  }
}
