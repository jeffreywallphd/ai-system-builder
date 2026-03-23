import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import type { LocalMcpToolDraft } from "../../../application/mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "../../../application/mcp/models/LocalMcpServerCreateResult";
import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpServerConnectionRequest } from "../../../application/mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../../application/mcp/models/McpServerConnectionResult";
import type { McpServerDescriptor, McpServerValidationResult } from "../../../application/mcp/models/McpServerDescriptor";
import type { McpServerDiagnosticsSnapshot } from "../../../application/mcp/models/McpServerDiagnosticsSnapshot";
import type { McpServerTestConnectionResult } from "../../../application/mcp/models/McpServerTestConnectionResult";
import type { McpSyncResult } from "../../../application/mcp/models/McpSyncResult";
import type { McpExportResult, McpImportResult, McpServerImportExportRecord } from "../../../application/mcp/models/McpImportExport";
import type { McpToolInvocationTrace } from "../../../application/mcp/models/McpToolExecutionResult";
import { HttpMcpRuntimeClient } from "./HttpMcpRuntimeClient";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

interface ServerListResponse {
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly status?: McpConnectionStatus;
}

export class HttpMcpServerRuntimeClient {
  private readonly runtimeClient: HttpMcpRuntimeClient;

  constructor(config: PythonRuntimeConfig, fetchImpl: typeof fetch = fetch, eventSink?: IRuntimeEventSink) {
    this.runtimeClient = new HttpMcpRuntimeClient(config, fetchImpl, eventSink);
  }

  public getConnectionStatus(): Promise<McpConnectionStatus> {
    return this.runtimeClient.getConnectionStatus();
  }

  public async listConfiguredServers(): Promise<ReadonlyArray<McpServerDescriptor>> {
    const payload = await this.runtimeClient.listServers() as ServerListResponse;
    return payload.servers;
  }

  public connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult> {
    return this.runtimeClient.connectServer(request);
  }

  public disconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.runtimeClient.disconnectServer(serverId);
  }

  public reconnectServer(serverId: string): Promise<McpServerConnectionResult> {
    return this.runtimeClient.connectServer({ serverId, reconnect: true });
  }

  public createLocalServer(draft: LocalMcpToolDraft): Promise<LocalMcpServerCreateResult> {
    return this.runtimeClient.createLocalServer(draft);
  }

  public upsertServer(server: Readonly<Record<string, unknown>>): Promise<McpServerDescriptor> {
    return this.runtimeClient.upsertServer!(server);
  }

  public validateServer(server: Readonly<Record<string, unknown>>): Promise<McpServerValidationResult> {
    return this.runtimeClient.validateServer!(server);
  }

  public testServer(server: Readonly<Record<string, unknown>>): Promise<McpServerTestConnectionResult> {
    return this.runtimeClient.testServer!(server);
  }

  public deleteServer(serverId: string): Promise<{ readonly serverId: string; readonly deleted: boolean; readonly checkedAt: string }> {
    return this.runtimeClient.deleteServer!(serverId);
  }

  public duplicateServer(serverId: string, newServerId?: string, newName?: string): Promise<McpServerDescriptor> {
    return this.runtimeClient.duplicateServer!(serverId, newServerId, newName);
  }

  public importServers(servers: ReadonlyArray<McpServerImportExportRecord>): Promise<McpImportResult> {
    return this.runtimeClient.importServers!(servers);
  }

  public exportServers(): Promise<McpExportResult> {
    return this.runtimeClient.exportServers!();
  }

  public syncServer(serverId: string): Promise<McpSyncResult> {
    return this.runtimeClient.syncServer!(serverId);
  }

  public getDiagnostics(serverId: string): Promise<McpServerDiagnosticsSnapshot> {
    return this.runtimeClient.getDiagnostics!(serverId);
  }

  public getInvocationHistory(serverId?: string): Promise<ReadonlyArray<McpToolInvocationTrace>> {
    return this.runtimeClient.getInvocationHistory!(serverId);
  }
}
