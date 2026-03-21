import type { McpConnectionStatus } from "../../mcp/models/McpConnectionStatus";
import type { McpResourceDescriptor } from "../../mcp/models/McpResourceDescriptor";
import type { McpServerConnectionRequest } from "../../mcp/models/McpServerConnectionRequest";
import type { McpServerConnectionResult } from "../../mcp/models/McpServerConnectionResult";
import type { McpServerSearchCriteria } from "../../mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../mcp/models/McpServerSearchResult";
import type { McpServerDiagnosticsSnapshot } from "../../mcp/models/McpServerDiagnosticsSnapshot";
import type { McpServerTestConnectionResult } from "../../mcp/models/McpServerTestConnectionResult";
import type { McpServerDescriptor, McpServerValidationResult } from "../../mcp/models/McpServerDescriptor";
import type { McpToolDescriptor } from "../../mcp/models/McpToolDescriptor";
import type { McpToolExecutionRequest } from "../../mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult, McpToolInvocationTrace } from "../../mcp/models/McpToolExecutionResult";
import type { McpToolSearchQuery } from "../../mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "../../mcp/models/McpToolSearchResult";
import type { McpSyncResult } from "../../mcp/models/McpSyncResult";
import type { McpExportResult, McpImportResult, McpServerImportExportRecord } from "../../mcp/models/McpImportExport";

export interface IMcpRuntimeClient {
  getConnectionStatus(): Promise<McpConnectionStatus>;
  listServers(): Promise<McpServerSearchResult>;
  searchServers(criteria?: McpServerSearchCriteria): Promise<McpServerSearchResult>;
  upsertServer?(server: Readonly<Record<string, unknown>>): Promise<McpServerDescriptor>;
  validateServer?(server: Readonly<Record<string, unknown>>): Promise<McpServerValidationResult>;
  testServer?(server: Readonly<Record<string, unknown>>): Promise<McpServerTestConnectionResult>;
  deleteServer?(serverId: string): Promise<{ readonly serverId: string; readonly deleted: boolean; readonly checkedAt: string }>;
  duplicateServer?(serverId: string, newServerId?: string, newName?: string): Promise<McpServerDescriptor>;
  importServers?(servers: ReadonlyArray<McpServerImportExportRecord>): Promise<McpImportResult>;
  exportServers?(): Promise<McpExportResult>;
  connectServer(request: McpServerConnectionRequest): Promise<McpServerConnectionResult>;
  disconnectServer(serverId: string): Promise<McpServerConnectionResult>;
  syncServer?(serverId: string): Promise<McpSyncResult>;
  getDiagnostics?(serverId: string): Promise<McpServerDiagnosticsSnapshot>;
  getInvocationHistory?(serverId?: string): Promise<ReadonlyArray<McpToolInvocationTrace>>;
  listTools(): Promise<ReadonlyArray<McpToolDescriptor>>;
  searchTools(query?: McpToolSearchQuery): Promise<McpToolSearchResult>;
  getToolDescriptor(toolId: string): Promise<McpToolDescriptor | undefined>;
  listResources?(): Promise<ReadonlyArray<McpResourceDescriptor>>;
  executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult>;
}
