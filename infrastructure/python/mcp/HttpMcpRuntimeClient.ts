import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpServerConnectionRequest } from "../../../application/mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../../application/mcp/models/McpServerConnectionResult";
import type { McpServerSearchCriteria } from "../../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../../application/mcp/models/McpServerSearchResult";
import type { McpToolDescriptor } from "../../../application/mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "../../../application/mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../../application/mcp/models/McpToolExecutionResult";
import { PythonRuntimeError } from "../client/PythonRuntimeError";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

export class HttpMcpRuntimeClient implements IMcpRuntimeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly eventSink?: IRuntimeEventSink;

  constructor(
    config: PythonRuntimeConfig,
    fetchImpl: typeof fetch = fetch,
    eventSink?: IRuntimeEventSink
  ) {
    if (!config.baseUrl) {
      throw new PythonRuntimeError("Python runtime baseUrl is required.");
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
    this.authToken = config.authToken;
    this.fetchImpl = fetchImpl;
    this.eventSink = eventSink;
  }

  public async getConnectionStatus(): Promise<McpConnectionStatus> {
    this.emit("info", "MCP status check started.", { eventType: "mcp-status-check" });

    try {
      const status = await this.request<McpConnectionStatus>("GET", "/mcp/status");
      this.emit("success", "MCP status check completed.", {
        eventType: "mcp-status-check",
        state: status.state,
        enabled: status.enabled,
      });
      return status;
    } catch (error) {
      this.emitError("MCP status check failed.", error, "mcp-connection-failure");
      throw error;
    }
  }

  public async listServers(): Promise<McpServerSearchResult> {
    this.emit("info", "MCP server discovery started.", { eventType: "mcp-server-discovery" });

    try {
      const payload = await this.request<McpServerSearchResult>("GET", "/mcp/servers");
      this.emit("success", "MCP server discovery completed.", {
        eventType: "mcp-server-discovery",
        serverCount: payload.servers.length,
      });
      return payload;
    } catch (error) {
      this.emitError("MCP server discovery failed.", error, "mcp-server-discovery");
      throw error;
    }
  }

  public async searchServers(criteria: McpServerSearchCriteria = {}): Promise<McpServerSearchResult> {
    this.emit("info", "MCP server search started.", {
      eventType: "mcp-server-search",
      query: criteria.query ?? "",
    });

    try {
      const params = new URLSearchParams();
      if (criteria.query?.trim()) {
        params.set("query", criteria.query.trim());
      }
      if (criteria.limit !== undefined) {
        params.set("limit", String(criteria.limit));
      }
      for (const status of criteria.statuses ?? []) {
        params.append("status", status);
      }
      for (const transport of criteria.transports ?? []) {
        params.append("transport", transport);
      }

      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const payload = await this.request<McpServerSearchResult>("GET", `/mcp/servers/search${suffix}`);
      this.emit("success", "MCP server search completed.", {
        eventType: "mcp-server-search",
        query: payload.query,
        serverCount: payload.servers.length,
      });
      return payload;
    } catch (error) {
      this.emitError("MCP server search failed.", error, "mcp-server-search", {
        query: criteria.query ?? "",
      });
      throw error;
    }
  }

  public async connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult> {
    const action = request.reconnect ? "reconnect" : "connect";
    this.emit("info", `MCP server ${action} started.`, {
      eventType: "mcp-server-connect",
      serverId: request.serverId,
      reconnect: request.reconnect === true,
    });

    try {
      const payload = await this.request<McpServerConnectionResult>("POST", "/mcp/servers/connect", request);
      this.emit("success", `MCP server ${payload.action} completed.`, {
        eventType: "mcp-server-connect",
        serverId: payload.server.id,
        serverStatus: payload.server.status,
      });
      return payload;
    } catch (error) {
      this.emitError("MCP server connect request failed.", error, "mcp-server-connect", {
        serverId: request.serverId,
        reconnect: request.reconnect === true,
      });
      throw error;
    }
  }

  public async disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    this.emit("info", "MCP server disconnect started.", {
      eventType: "mcp-server-disconnect",
      serverId,
    });

    try {
      const payload = await this.request<McpServerConnectionResult>("POST", "/mcp/servers/disconnect", { serverId });
      this.emit("success", "MCP server disconnect completed.", {
        eventType: "mcp-server-disconnect",
        serverId: payload.server.id,
        serverStatus: payload.server.status,
      });
      return payload;
    } catch (error) {
      this.emitError("MCP server disconnect request failed.", error, "mcp-server-disconnect", {
        serverId,
      });
      throw error;
    }
  }

  public async listTools(): Promise<ReadonlyArray<McpToolDescriptor>> {
    try {
      const payload = await this.request<{ readonly tools: ReadonlyArray<McpToolDescriptor> }>("GET", "/mcp/tools");
      return payload.tools;
    } catch (error) {
      this.emitError("MCP tool discovery request failed.", error, "mcp-connection-failure");
      throw error;
    }
  }

  public async executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    try {
      return await this.request<McpToolExecutionResult>("POST", "/mcp/tools/execute", request);
    } catch (error) {
      this.emitError("MCP tool execution request failed.", error, "mcp-connection-failure", {
        serverId: request.serverId,
        toolName: request.toolName,
      });
      throw error;
    }
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(this.authToken ? { authorization: `Bearer ${this.authToken}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as Readonly<Record<string, unknown>>;

      if (!response.ok) {
        throw new PythonRuntimeError(`Python runtime MCP request failed (${response.status}).`, {
          statusCode: response.status,
          details: payload,
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof PythonRuntimeError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new PythonRuntimeError(`Python runtime MCP request timed out after ${this.timeoutMs}ms.`);
      }

      throw new PythonRuntimeError("Python runtime MCP request failed.", {
        details: { cause: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private emit(
    severity: "debug" | "info" | "warning" | "error" | "success",
    message: string,
    details?: Readonly<Record<string, unknown>>
  ): void {
    this.eventSink?.emit({
      source: RuntimeEventSources.pythonRuntime,
      severity,
      message,
      details,
    });
  }

  private emitError(
    message: string,
    error: unknown,
    eventType: string,
    details?: Readonly<Record<string, unknown>>
  ): void {
    this.emit("error", message, {
      eventType,
      ...(details ?? {}),
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
