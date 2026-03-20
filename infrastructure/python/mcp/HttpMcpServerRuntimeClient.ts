import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { LocalMcpToolDraft } from "../../../application/mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "../../../application/mcp/models/LocalMcpServerCreateResult";
import type { McpServerConnectionRequest } from "../../../application/mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../../application/mcp/models/McpServerConnectionResult";
import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";
import { PythonRuntimeError } from "../client/PythonRuntimeError";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

interface ServerListResponse {
  readonly query?: string;
  readonly totalCount?: number;
  readonly limit?: number;
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly status?: McpConnectionStatus;
}

export class HttpMcpServerRuntimeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly eventSink?: IRuntimeEventSink;

  constructor(
    config: PythonRuntimeConfig,
    fetchImpl: typeof fetch = fetch,
    eventSink?: IRuntimeEventSink,
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
    this.emit("info", "MCP server status check started.", { eventType: "mcp-status-check" });

    try {
      const status = await this.request<McpConnectionStatus>("GET", "/mcp/status");
      this.emit("success", "MCP server status check completed.", {
        eventType: "mcp-status-check",
        state: status.state,
        enabled: status.enabled,
      });
      return status;
    } catch (error) {
      this.emitError("MCP server status check failed.", error, "mcp-connection-failure");
      throw error;
    }
  }

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    this.emit("info", "MCP configured server catalog request started.", {
      eventType: "mcp-server-catalog",
    });

    try {
      const payload = await this.request<ServerListResponse>("GET", "/mcp/servers");
      this.emit("success", "MCP configured server catalog request completed.", {
        eventType: "mcp-server-catalog",
        serverCount: payload.servers.length,
      });
      return Object.freeze([...payload.servers]);
    } catch (error) {
      this.emitError("MCP configured server catalog request failed.", error, "mcp-connection-failure");
      throw error;
    }
  }

  public async connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult> {
    return this.runLifecycleRequest(
      "connect",
      "/mcp/servers/connect",
      { serverId: request.serverId },
      { serverId: request.serverId },
    );
  }

  public async disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.runLifecycleRequest(
      "disconnect",
      "/mcp/servers/disconnect",
      { serverId },
      { serverId },
    );
  }

  public async reconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.runLifecycleRequest(
      "reconnect",
      "/mcp/servers/reconnect",
      { serverId },
      { serverId },
    );
  }

  public async createLocalServer(draft: LocalMcpToolDraft): Promise<LocalMcpServerCreateResult> {
    this.emit("info", "Local MCP server provisioning started.", {
      eventType: "mcp-local-server-provision",
      serverId: draft.serverId,
      toolName: draft.toolName,
    });

    try {
      const result = await this.request<LocalMcpServerCreateResult>("POST", "/mcp/servers/local", draft);
      this.emit("success", "Local MCP server provisioning completed.", {
        eventType: "mcp-local-server-provision",
        serverId: result.server.id,
        created: result.created,
      });
      return result;
    } catch (error) {
      this.emitError("Local MCP server provisioning failed.", error, "mcp-local-server-provision", {
        serverId: draft.serverId,
      });
      throw error;
    }
  }

  private async runLifecycleRequest(
    action: "connect" | "disconnect" | "reconnect",
    path: string,
    body: Readonly<Record<string, unknown>>,
    details: Readonly<Record<string, unknown>>,
  ): Promise<McpServerConnectionResult> {
    this.emit("info", `MCP server ${action} attempt started.`, {
      eventType: `mcp-server-${action}`,
      ...details,
    });

    try {
      const result = await this.request<McpServerConnectionResult>("POST", path, body);
      this.emit("success", `MCP server ${action} attempt completed.`, {
        eventType: `mcp-server-${action}`,
        serverId: result.server.id,
        serverStatus: result.status.state,
      });
      return result;
    } catch (error) {
      this.emitError(`MCP server ${action} attempt failed.`, error, "mcp-connection-failure", {
        action,
        ...details,
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
        throw new PythonRuntimeError(`Python runtime MCP server request failed (${response.status}).`, {
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
        throw new PythonRuntimeError(`Python runtime MCP server request timed out after ${this.timeoutMs}ms.`);
      }
      throw new PythonRuntimeError("Python runtime MCP server request failed.", {
        details: { cause: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private emit(
    severity: "debug" | "info" | "warning" | "error" | "success",
    message: string,
    details?: Readonly<Record<string, unknown>>,
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
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.emit("error", message, {
      eventType,
      ...(details ?? {}),
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
