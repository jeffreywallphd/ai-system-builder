import type { LocalMcpToolDraft } from "@application/mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "@application/mcp/models/LocalMcpServerCreateResult";
import type { IMcpServerCatalog } from "@application/ports/interfaces/IMcpServerCatalog";
import type { IMcpServerManager } from "@application/ports/interfaces/IMcpServerManager";
import type { IRuntimeEventSink } from "@application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "@application/runtime/RuntimeEvent";
import { toRuntimeDiagnosticDetails } from "@application/runtime/RuntimeDiagnostics";
import type { McpServerConnectionRequest } from "@application/mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "@application/mcp/models/McpServerConnectionResult";

export interface IMcpServerManagerRuntimeClient {
  connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult>;
  disconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  reconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  createLocalServer(draft: LocalMcpToolDraft): Promise<LocalMcpServerCreateResult>;
}

export class PythonBackedMcpServerManager implements IMcpServerManager {
  constructor(
    private readonly client: IMcpServerManagerRuntimeClient,
    private readonly catalog: IMcpServerCatalog,
    private readonly eventSink?: IRuntimeEventSink,
  ) {}

  public async connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult> {
    await this.emitLocalStartAttempt(request.serverId, "connect");
    return this.client.connectServer(request);
  }

  public async disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.client.disconnectServer(serverId.trim());
  }

  public async reconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    await this.emitLocalStartAttempt(serverId, "reconnect");
    return this.client.reconnectServer(serverId.trim());
  }

  public async createLocalServer(draft: LocalMcpToolDraft): Promise<LocalMcpServerCreateResult> {
    this.eventSink?.emit({
      source: RuntimeEventSources.pythonRuntime,
      severity: "info",
      message: "Local MCP server provisioning queued.",
      details: {
        eventType: "mcp-local-server-provision",
        serverId: draft.serverId,
        toolName: draft.toolName,
      },
    });
    return this.client.createLocalServer(draft);
  }

  private async emitLocalStartAttempt(
    serverId: string,
    action: "connect" | "reconnect",
  ): Promise<void> {
    const normalized = serverId.trim();
    if (!normalized) {
      return;
    }

    try {
      const servers = await this.catalog.listConfiguredServers();
      const server = servers.find((candidate) => candidate.id === normalized);
      if (!server || server.transport !== "stdio") {
        return;
      }

      this.eventSink?.emit({
        source: RuntimeEventSources.pythonRuntime,
        severity: "info",
        message: "Local MCP server start attempt queued.",
        details: {
          eventType: "mcp-local-server-start-attempt",
          action,
          serverId: server.id,
          command: server.command,
          args: server.args,
        },
      });
    } catch (error) {
      this.eventSink?.emit({
        source: RuntimeEventSources.pythonRuntime,
        severity: "error",
        message: "Local MCP server start inspection failed.",
        details: toRuntimeDiagnosticDetails(error, {
          subsystem: "mcp-runtime",
          className: "PythonBackedMcpServerManager",
          methodName: "emitLocalStartAttempt",
          operation: "inspect-local-mcp-server-start",
          details: { action, serverId: normalized },
        }, {
          eventType: "mcp-connection-failure",
          action,
          serverId: normalized,
        }),
      });
    }
  }
}

