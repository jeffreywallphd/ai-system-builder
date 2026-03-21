import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import {
  bindSafeFetch,
  toRuntimeDiagnosticDetails,
} from "../../../application/runtime/RuntimeDiagnostics";
import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "../../../application/mcp/models/McpResourceDescriptor";
import {
  normalizeMcpToolDescriptor,
  type McpToolDescriptor,
} from "../../../application/mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "../../../application/mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../../application/mcp/models/McpToolExecutionResult";
import type { McpServerConnectionRequest } from "../../../application/mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../../application/mcp/models/McpServerConnectionResult";
import type { McpServerSearchCriteria } from "../../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../../application/mcp/models/McpServerSearchResult";
import type { McpToolSearchQuery } from "../../../application/mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "../../../application/mcp/models/McpToolSearchResult";
import { PythonRuntimeError } from "../client/PythonRuntimeError";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

interface McpCatalogSnapshot {
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly resources: ReadonlyArray<McpResourceDescriptor>;
}

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
      throw new PythonRuntimeError("Python runtime baseUrl is required.", {
        subsystem: "mcp-runtime",
        className: "HttpMcpRuntimeClient",
        methodName: "constructor",
        operation: "configure-mcp-runtime-client",
      });
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
    this.authToken = config.authToken;
    this.fetchImpl = bindSafeFetch(fetchImpl);
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
      return (await this.listCatalogSnapshot()).tools;
    } catch (error) {
      this.emitError("MCP tool discovery request failed.", error, "mcp-connection-failure");
      throw error;
    }
  }

  public async searchTools(query: McpToolSearchQuery = {}): Promise<McpToolSearchResult> {
    this.emit("info", "MCP tool search started.", {
      eventType: "mcp-tool-search",
      query: query.query ?? "",
    });

    try {
      const params = new URLSearchParams();
      if (query.query?.trim()) {
        params.set("query", query.query.trim());
      }
      if (query.limit !== undefined) {
        params.set("limit", String(query.limit));
      }
      for (const serverId of query.serverIds ?? []) {
        params.append("serverId", serverId);
      }
      for (const category of query.categories ?? []) {
        params.append("category", category);
      }
      for (const tag of query.tags ?? []) {
        params.append("tag", tag);
      }

      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const payload = await this.request<McpToolSearchResult>("GET", `/mcp/tools/search${suffix}`);
      this.emit("success", "MCP tool search completed.", {
        eventType: "mcp-tool-search",
        query: payload.query,
        toolCount: payload.tools.length,
      });
      return Object.freeze({
        query: payload.query,
        totalCount: payload.totalCount,
        limit: payload.limit,
        tools: Object.freeze(payload.tools.map((tool) => normalizeMcpToolDescriptor(tool))),
      });
    } catch (error) {
      this.emitError("MCP tool search failed.", error, "mcp-tool-search", {
        query: query.query ?? "",
      });
      throw error;
    }
  }

  public async getToolDescriptor(toolId: string): Promise<McpToolDescriptor | undefined> {
    const normalizedToolId = toolId.trim();
    if (!normalizedToolId) {
      throw new PythonRuntimeError("MCP tool descriptor lookup requires a toolId.", {
        subsystem: "mcp-runtime",
        className: "HttpMcpRuntimeClient",
        methodName: "getToolDescriptor",
        operation: "mcp-tool-descriptor",
      });
    }

    try {
      const payload = await this.request<McpToolDescriptor>("GET", `/mcp/tools/${encodeURIComponent(normalizedToolId)}`);
      return normalizeMcpToolDescriptor(payload);
    } catch (error) {
      if (error instanceof PythonRuntimeError && error.statusCode === 404) {
        return undefined;
      }
      this.emitError("MCP tool descriptor lookup failed.", error, "mcp-tool-descriptor", {
        toolId: normalizedToolId,
      });
      throw error;
    }
  }

  public async listResources(): Promise<ReadonlyArray<McpResourceDescriptor>> {
    try {
      return (await this.listCatalogSnapshot()).resources;
    } catch (error) {
      this.emitError("MCP resource discovery request failed.", error, "mcp-connection-failure");
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

  private async listCatalogSnapshot(): Promise<McpCatalogSnapshot> {
    const payload = await this.request<{
      readonly tools?: ReadonlyArray<McpToolDescriptor>;
      readonly resources?: ReadonlyArray<McpResourceDescriptor>;
    }>("GET", "/mcp/tools");

    return {
      tools: Object.freeze((payload.tools ?? []).map((tool) => normalizeMcpToolDescriptor(tool))),
      resources: payload.resources ?? [],
    };
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const target = `${this.baseUrl}${path}`;

    try {
      const response = await this.fetchImpl(target, {
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
          cause: payload,
          statusCode: response.status,
          details: payload,
          subsystem: "mcp-runtime",
          className: "HttpMcpRuntimeClient",
          methodName: "request",
          operation: "mcp-runtime-http-request",
          target,
          requestMethod: method,
          failedBeforeResponse: false,
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof PythonRuntimeError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new PythonRuntimeError(`Python runtime MCP request timed out after ${this.timeoutMs}ms.`, {
          cause: error,
          details: body,
          subsystem: "mcp-runtime",
          className: "HttpMcpRuntimeClient",
          methodName: "request",
          operation: "mcp-runtime-http-request",
          target,
          requestMethod: method,
          failedBeforeResponse: true,
        });
      }

      throw new PythonRuntimeError("Python runtime MCP request failed.", {
        cause: error,
        details: body,
        subsystem: "mcp-runtime",
        className: "HttpMcpRuntimeClient",
        methodName: "request",
        operation: "mcp-runtime-http-request",
        target,
        requestMethod: method,
        failedBeforeResponse: true,
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
    this.emit("error", message, toRuntimeDiagnosticDetails(error, {
      message,
      subsystem: "mcp-runtime",
      className: "HttpMcpRuntimeClient",
      methodName: "emitError",
      operation: eventType,
    }, {
      eventType,
      ...(details ?? {}),
    }));
  }
}
