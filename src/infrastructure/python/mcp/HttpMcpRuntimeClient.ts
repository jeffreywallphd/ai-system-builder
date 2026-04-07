import type { IMcpRuntimeClient } from "@application/ports/interfaces/IMcpRuntimeClient";
import type { IRuntimeEventSink } from "@application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "@application/runtime/RuntimeEvent";
import { bindSafeFetch, toRuntimeDiagnosticDetails } from "@application/runtime/RuntimeDiagnostics";
import type { McpConnectionStatus } from "@application/mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "@application/mcp/models/McpResourceDescriptor";
import { normalizeMcpToolDescriptor, type McpToolDescriptor } from "@application/mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "@application/mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult, McpToolInvocationTrace } from "@application/mcp/models/McpToolExecutionResult";
import type { McpServerConnectionRequest } from "@application/mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "@application/mcp/models/McpServerConnectionResult";
import type { LocalMcpServerCreateResult } from "@application/mcp/models/LocalMcpServerCreateResult";
import type { McpServerDescriptor, McpServerValidationResult } from "@application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "@application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "@application/mcp/models/McpServerSearchResult";
import type { McpServerDiagnosticsSnapshot } from "@application/mcp/models/McpServerDiagnosticsSnapshot";
import type { McpServerTestConnectionResult } from "@application/mcp/models/McpServerTestConnectionResult";
import type { McpToolSearchQuery } from "@application/mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "@application/mcp/models/McpToolSearchResult";
import type { McpSyncResult } from "@application/mcp/models/McpSyncResult";
import type { McpExportResult, McpImportResult, McpServerImportExportRecord } from "@application/mcp/models/McpImportExport";
import { PythonRuntimeError } from "../client/PythonRuntimeError";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

interface McpCatalogResponse {
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly resources: ReadonlyArray<McpResourceDescriptor>;
}

interface InvocationHistoryResponse {
  readonly traces: ReadonlyArray<McpToolInvocationTrace>;
}

type McpRequestLifecycle = "cancelled" | "timed-out";

export class HttpMcpRuntimeClient implements IMcpRuntimeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly eventSink?: IRuntimeEventSink;

  constructor(config: PythonRuntimeConfig, fetchImpl: typeof fetch = fetch, eventSink?: IRuntimeEventSink) {
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
      this.emit("success", "MCP status check completed.", { eventType: "mcp-status-check", state: status.state, enabled: status.enabled });
      return status;
    } catch (error) {
      if (isMcpRequestLifecycleError(error, "cancelled")) {
        this.emit("info", "MCP status check cancelled.", { eventType: "mcp-status-check-cancelled" });
        throw error;
      }
      this.emitError("MCP status check failed.", error, "mcp-connection-failure");
      throw error;
    }
  }

  public listServers(): Promise<McpServerSearchResult> {
    return this.request("GET", "/mcp/servers");
  }

  public async searchServers(criteria: McpServerSearchCriteria = {}): Promise<McpServerSearchResult> {
    this.emit("info", "MCP server search started.", { eventType: "mcp-server-search", query: criteria.query ?? "" });
    const params = new URLSearchParams();
    if (criteria.query?.trim()) params.set("query", criteria.query.trim());
    if (criteria.limit !== undefined) params.set("limit", String(criteria.limit));
    for (const status of criteria.statuses ?? []) params.append("status", status);
    for (const transport of criteria.transports ?? []) params.append("transport", transport);
    for (const sourceType of criteria.sourceTypes ?? []) params.append("sourceType", sourceType);
    try {
      const payload = await this.request<McpServerSearchResult>("GET", `/mcp/servers/search${params.size ? `?${params.toString()}` : ""}`);
      this.emit("success", "MCP server search completed.", { eventType: "mcp-server-search", query: payload.query, serverCount: payload.servers.length });
      return payload;
    } catch (error) {
      this.emitError("MCP server search failed.", error, "mcp-server-search", { query: criteria.query ?? "" });
      throw error;
    }
  }

  public upsertServer(server: Readonly<Record<string, unknown>>): Promise<McpServerDescriptor> {
    return this.request("POST", "/mcp/servers", server);
  }

  public validateServer(server: Readonly<Record<string, unknown>>): Promise<McpServerValidationResult> {
    return this.request("POST", "/mcp/servers/validate", server);
  }

  public testServer(server: Readonly<Record<string, unknown>>): Promise<McpServerTestConnectionResult> {
    return this.request("POST", "/mcp/servers/test", server);
  }

  public deleteServer(serverId: string): Promise<{ readonly serverId: string; readonly deleted: boolean; readonly checkedAt: string }> {
    return this.request("DELETE", `/mcp/servers/${encodeURIComponent(serverId.trim())}`);
  }

  public duplicateServer(serverId: string, newServerId?: string, newName?: string): Promise<McpServerDescriptor> {
    return this.request("POST", "/mcp/servers/duplicate", { serverId, newServerId, newName });
  }

  public importServers(servers: ReadonlyArray<McpServerImportExportRecord>): Promise<McpImportResult> {
    return this.request("POST", "/mcp/servers/import", { servers });
  }

  public exportServers(): Promise<McpExportResult> {
    return this.request("GET", "/mcp/servers/export");
  }

  public createLocalServer(draft: Readonly<Record<string, unknown>>): Promise<LocalMcpServerCreateResult> {
    return this.request("POST", "/mcp/servers/local", draft);
  }

  public async connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult> {
    this.emit("info", "MCP server connect started.", { eventType: "mcp-server-connect", serverId: request.serverId });
    try {
      const payload = await this.request<McpServerConnectionResult>("POST", "/mcp/servers/connect", request);
      this.emit("success", "MCP server connect completed.", { eventType: "mcp-server-connect", serverId: payload.server.id });
      return payload;
    } catch (error) {
      this.emitError("MCP server connect failed.", error, "mcp-server-connect", { serverId: request.serverId });
      throw error;
    }
  }

  public async disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    this.emit("info", "MCP server disconnect started.", { eventType: "mcp-server-disconnect", serverId });
    try {
      const payload = await this.request<McpServerConnectionResult>("POST", "/mcp/servers/disconnect", { serverId });
      this.emit("success", "MCP server disconnect completed.", { eventType: "mcp-server-disconnect", serverId: payload.server.id });
      return payload;
    } catch (error) {
      this.emitError("MCP server disconnect failed.", error, "mcp-server-disconnect", { serverId });
      throw error;
    }
  }

  public syncServer(serverId: string): Promise<McpSyncResult> {
    return this.request("POST", `/mcp/servers/${encodeURIComponent(serverId.trim())}/sync`);
  }

  public getDiagnostics(serverId: string): Promise<McpServerDiagnosticsSnapshot> {
    return this.request("GET", `/mcp/servers/${encodeURIComponent(serverId.trim())}/diagnostics`);
  }

  public async getInvocationHistory(serverId?: string): Promise<ReadonlyArray<McpToolInvocationTrace>> {
    const payload = serverId
      ? await this.request<InvocationHistoryResponse>("GET", `/mcp/servers/${encodeURIComponent(serverId.trim())}/invocations`)
      : await this.request<InvocationHistoryResponse>("GET", "/mcp/tools/invocations");
    return payload.traces;
  }

  public async listTools(): Promise<ReadonlyArray<McpToolDescriptor>> {
    const payload = await this.request<McpCatalogResponse>("GET", "/mcp/tools");
    return Object.freeze(payload.tools.map((tool) => normalizeMcpToolDescriptor(tool)));
  }

  public async searchTools(query: McpToolSearchQuery = {}): Promise<McpToolSearchResult> {
    const params = new URLSearchParams();
    if (query.query?.trim()) params.set("query", query.query.trim());
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    for (const serverId of query.serverIds ?? []) params.append("serverId", serverId);
    for (const category of query.categories ?? []) params.append("category", category);
    for (const tag of query.tags ?? []) params.append("tag", tag);
    const payload = await this.request<McpToolSearchResult>("GET", `/mcp/tools/search${params.size ? `?${params.toString()}` : ""}`);
    return Object.freeze({ ...payload, tools: Object.freeze(payload.tools.map((tool) => normalizeMcpToolDescriptor(tool))) });
  }

  public async getToolDescriptor(toolId: string): Promise<McpToolDescriptor | undefined> {
    try {
      return normalizeMcpToolDescriptor(await this.request<McpToolDescriptor>("GET", `/mcp/tools/${encodeURIComponent(toolId.trim())}`));
    } catch (error) {
      if (error instanceof PythonRuntimeError && error.statusCode === 404) return undefined;
      throw error;
    }
  }

  public async listResources(): Promise<ReadonlyArray<McpResourceDescriptor>> {
    const payload = await this.request<McpCatalogResponse>("GET", "/mcp/tools");
    return payload.resources;
  }

  public executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    return this.request("POST", "/mcp/tools/execute", request);
  }

  private async request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), this.timeoutMs);
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
      if (error instanceof PythonRuntimeError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        if (controller.signal.aborted && controller.signal.reason === "timeout") {
          throw this.createRequestAbortError("timed-out", error, target, method, body);
        }

        throw this.createRequestAbortError("cancelled", error, target, method, body);
      }
      if (controller.signal.aborted && controller.signal.reason === "timeout") {
        throw new PythonRuntimeError(`Python runtime MCP request timed out after ${this.timeoutMs}ms.`, {
          cause: error,
          details: { requestLifecycle: "timed-out", requestBody: body },
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

  private createRequestAbortError(
    lifecycle: McpRequestLifecycle,
    cause: unknown,
    target: string,
    requestMethod: "GET" | "POST" | "DELETE",
    requestBody?: unknown,
  ): PythonRuntimeError {
    const isTimeout = lifecycle === "timed-out";
    return new PythonRuntimeError(
      isTimeout
        ? `Python runtime MCP request timed out after ${this.timeoutMs}ms.`
        : "Python runtime MCP request was cancelled.",
      {
        cause,
        details: {
          requestLifecycle: lifecycle,
          requestBody,
        },
        subsystem: "mcp-runtime",
        className: "HttpMcpRuntimeClient",
        methodName: "request",
        operation: "mcp-runtime-http-request",
        target,
        requestMethod,
        failedBeforeResponse: true,
      },
    );
  }

  private emit(severity: "debug" | "info" | "warning" | "error" | "success", message: string, details?: Readonly<Record<string, unknown>>): void {
    this.eventSink?.emit({ source: RuntimeEventSources.pythonRuntime, severity, message, details, timestamp: new Date().toISOString() });
  }

  private emitError(message: string, error: unknown, eventType: string, details?: Readonly<Record<string, unknown>>): void {
    this.eventSink?.emit({
      source: RuntimeEventSources.pythonRuntime,
      severity: "error",
      message,
      details: {
        eventType,
        ...details,
        ...toRuntimeDiagnosticDetails(error, {
          subsystem: "mcp-runtime",
          className: "HttpMcpRuntimeClient",
          methodName: "request",
          operation: eventType,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  }
}

function isMcpRequestLifecycleError(error: unknown, expected: McpRequestLifecycle): boolean {
  if (!(error instanceof PythonRuntimeError)) {
    return false;
  }

  const details = error.diagnostics.details;
  if (!details || typeof details !== "object") {
    return false;
  }

  return (details as { requestLifecycle?: unknown }).requestLifecycle === expected;
}

