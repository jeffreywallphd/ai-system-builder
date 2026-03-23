import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { LocalMcpToolDraft } from "../../../application/mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "../../../application/mcp/models/LocalMcpServerCreateResult";
import type { McpServerConnectionResult } from "../../../application/mcp/models/McpServerConnectionResult";
import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "../../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerSearchResult } from "../../../application/mcp/models/McpServerSearchResult";
import type { McpServerStatus } from "../../../application/mcp/models/McpServerStatus";
import type { McpToolExecutionRequest } from "../../../application/mcp/models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "../../../application/mcp/models/McpToolExecutionResult";
import type { McpToolSearchQuery } from "../../../application/mcp/models/McpToolSearchQuery";
import type { McpToolSearchResult } from "../../../application/mcp/models/McpToolSearchResult";
import type { IMcpConfiguredServerRepository } from "../../../application/ports/interfaces/IMcpConfiguredServerRepository";
import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpServerCatalog } from "../../../application/ports/interfaces/IMcpServerCatalog";
import type { IMcpServerManager } from "../../../application/ports/interfaces/IMcpServerManager";
import type { IRuntimeDependencyOrchestrator, RuntimeDependencyResolution } from "../../../application/runtime/RuntimeDependencyOrchestrator";
import { RuntimeDependencyIds, RuntimeDependencyUnavailableError } from "../../../application/runtime/RuntimeDependencyOrchestrator";

export function createOrchestratedMcpRuntimeClient(
  delegate: IMcpRuntimeClient,
  orchestrator: IRuntimeDependencyOrchestrator,
): IMcpRuntimeClient {
  return {
    getConnectionStatus: async () => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return createUnavailableRuntimeStatus(resolution);
      }
      return delegate.getConnectionStatus();
    },
    listServers: async () => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return {
          query: "",
          totalCount: 0,
          limit: 20,
          servers: [],
          status: createUnavailableRuntimeStatus(resolution),
        } satisfies McpServerSearchResult;
      }
      return delegate.listServers();
    },
    searchServers: async (criteria?: McpServerSearchCriteria) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return {
          query: criteria?.query?.trim() || "",
          totalCount: 0,
          limit: criteria?.limit ?? 20,
          servers: [],
          status: createUnavailableRuntimeStatus(resolution),
        } satisfies McpServerSearchResult;
      }
      return delegate.searchServers(criteria);
    },
    upsertServer: delegate.upsertServer
      ? async (server) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "upsert-mcp-server");
        return delegate.upsertServer!(server);
      }
      : undefined,
    validateServer: delegate.validateServer
      ? async (server) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "validate-mcp-server");
        return delegate.validateServer!(server);
      }
      : undefined,
    testServer: delegate.testServer
      ? async (server) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "test-mcp-server");
        return delegate.testServer!(server);
      }
      : undefined,
    deleteServer: delegate.deleteServer
      ? async (serverId) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "delete-mcp-server");
        return delegate.deleteServer!(serverId);
      }
      : undefined,
    duplicateServer: delegate.duplicateServer
      ? async (serverId, newServerId, newName) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "duplicate-mcp-server");
        return delegate.duplicateServer!(serverId, newServerId, newName);
      }
      : undefined,
    importServers: delegate.importServers
      ? async (servers) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "import-mcp-servers");
        return delegate.importServers!(servers);
      }
      : undefined,
    exportServers: delegate.exportServers
      ? async () => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "export-mcp-servers");
        return delegate.exportServers!();
      }
      : undefined,
    connectServer: async (request) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return createUnavailableConnectionResult(request.serverId, request.reconnect ? "reconnect" : "connect", resolution);
      }
      return delegate.connectServer(request);
    },
    disconnectServer: async (serverId) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return createUnavailableConnectionResult(serverId, "disconnect", resolution);
      }
      return delegate.disconnectServer(serverId);
    },
    syncServer: delegate.syncServer
      ? async (serverId) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "sync-mcp-server");
        return delegate.syncServer!(serverId);
      }
      : undefined,
    getDiagnostics: delegate.getDiagnostics
      ? async (serverId) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "get-mcp-server-diagnostics");
        return delegate.getDiagnostics!(serverId);
      }
      : undefined,
    getInvocationHistory: delegate.getInvocationHistory
      ? async (serverId) => {
        await ensureMcpRuntimeDependencyOrThrow(orchestrator, "get-mcp-invocation-history");
        return delegate.getInvocationHistory!(serverId);
      }
      : undefined,
    listTools: async () => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return Object.freeze([]);
      }
      return delegate.listTools();
    },
    searchTools: async (query?: McpToolSearchQuery) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return {
          query: query?.query?.trim() || "",
          totalCount: 0,
          limit: query?.limit ?? 20,
          tools: [],
        } satisfies McpToolSearchResult;
      }
      return delegate.searchTools(query);
    },
    getToolDescriptor: async (toolId) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return undefined;
      }
      return delegate.getToolDescriptor(toolId);
    },
    listResources: delegate.listResources
      ? async () => {
        const resolution = await ensureMcpRuntimeDependency(orchestrator);
        if (!resolution.available) {
          return Object.freeze([]);
        }
        return delegate.listResources!();
      }
      : undefined,
    executeTool: async (request: McpToolExecutionRequest) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      if (!resolution.available) {
        return createUnavailableToolExecutionResult(request, resolution);
      }
      return delegate.executeTool(request);
    },
  };
}

export function createOrchestratedMcpServerCatalog(
  delegate: IMcpServerCatalog,
  orchestrator: IRuntimeDependencyOrchestrator,
): IMcpServerCatalog {
  return {
    getConnectionStatus: async () => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.getConnectionStatus() : createUnavailableRuntimeStatus(resolution);
    },
    listConfiguredServers: async () => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.listConfiguredServers() : Object.freeze([]);
    },
    getServerStatus: async (serverId: string) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.getServerStatus(serverId) : createUnavailableServerStatus(serverId, resolution);
    },
  };
}

export function createOrchestratedMcpServerManager(
  delegate: IMcpServerManager,
  orchestrator: IRuntimeDependencyOrchestrator,
): IMcpServerManager {
  return {
    connectServer: async (request) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.connectServer(request) : createUnavailableConnectionResult(request.serverId, "connect", resolution);
    },
    disconnectServer: async (serverId) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.disconnectServer(serverId) : createUnavailableConnectionResult(serverId, "disconnect", resolution);
    },
    reconnectServer: async (serverId) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.reconnectServer(serverId) : createUnavailableConnectionResult(serverId, "reconnect", resolution);
    },
    createLocalServer: async (draft: LocalMcpToolDraft) => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.createLocalServer(draft) : createUnavailableLocalServerResult(draft.serverId, resolution);
    },
  };
}

export function createOrchestratedMcpConfiguredServerRepository(
  delegate: IMcpConfiguredServerRepository,
  orchestrator: IRuntimeDependencyOrchestrator,
): IMcpConfiguredServerRepository {
  return {
    listConfiguredServers: async () => {
      const resolution = await ensureMcpRuntimeDependency(orchestrator);
      return resolution.available ? delegate.listConfiguredServers() : Object.freeze([]);
    },
    saveConfiguredServer: async (server: McpServerDescriptor) => {
      await ensureMcpRuntimeDependencyOrThrow(orchestrator, "save-configured-mcp-server");
      return delegate.saveConfiguredServer(server);
    },
  };
}

async function ensureMcpRuntimeDependency(
  orchestrator: IRuntimeDependencyOrchestrator,
): Promise<RuntimeDependencyResolution> {
  return orchestrator.ensureAvailable(RuntimeDependencyIds.mcpRuntime);
}

async function ensureMcpRuntimeDependencyOrThrow(
  orchestrator: IRuntimeDependencyOrchestrator,
  operation: string,
): Promise<RuntimeDependencyResolution> {
  const resolution = await ensureMcpRuntimeDependency(orchestrator);
  if (!resolution.available) {
    throw new RuntimeDependencyUnavailableError(
      resolution,
      resolution.detail ?? `Cannot ${operation} because the MCP runtime dependency chain is unavailable.`,
    );
  }
  return resolution;
}

function createUnavailableRuntimeStatus(resolution: RuntimeDependencyResolution): McpConnectionStatus {
  return {
    enabled: true,
    state: "unavailable",
    healthState: "unavailable",
    checkedAt: resolution.checkedAt,
    pythonRuntimeHealthy: false,
    mcpRuntimeHealthy: false,
    dependencyStatus: resolution,
    servers: [],
    capabilities: { tools: false, resources: false, toolExecution: false },
    metadata: {
      reason: "runtime-dependency-unavailable",
      dependency: resolution,
    },
  };
}

function createUnavailableServerDescriptor(serverId: string, resolution: RuntimeDependencyResolution): McpServerDescriptor {
  return {
    id: serverId,
    name: serverId,
    transport: "inmemory",
    enabled: false,
    status: "error",
    connected: false,
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
    errorMessage: resolution.detail ?? "MCP runtime dependency chain is unavailable.",
    metadata: {
      dependency: resolution,
    },
  };
}

function createUnavailableServerStatus(serverId: string, resolution: RuntimeDependencyResolution): McpServerStatus {
  return {
    serverId,
    name: serverId,
    transport: "inmemory",
    configured: false,
    enabled: false,
    state: "error",
    connected: false,
    checkedAt: resolution.checkedAt,
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
    errorMessage: resolution.detail ?? "MCP runtime dependency chain is unavailable.",
    metadata: {
      dependency: resolution,
    },
  };
}

function createUnavailableConnectionResult(
  serverId: string,
  action: McpServerConnectionResult["action"],
  resolution: RuntimeDependencyResolution,
): McpServerConnectionResult {
  return {
    action,
    checkedAt: resolution.checkedAt,
    server: createUnavailableServerDescriptor(serverId, resolution),
    status: createUnavailableServerStatus(serverId, resolution),
    runtime: createUnavailableRuntimeStatus(resolution),
    metadata: {
      reason: "runtime-dependency-unavailable",
      dependency: resolution,
    },
  };
}

function createUnavailableLocalServerResult(
  serverId: string,
  resolution: RuntimeDependencyResolution,
): LocalMcpServerCreateResult {
  return {
    server: createUnavailableServerDescriptor(serverId, resolution),
    status: createUnavailableServerStatus(serverId, resolution),
    runtime: createUnavailableRuntimeStatus(resolution),
    checkedAt: resolution.checkedAt,
    created: false,
  };
}

function createUnavailableToolExecutionResult(
  request: McpToolExecutionRequest,
  resolution: RuntimeDependencyResolution,
): McpToolExecutionResult {
  return {
    executionId: request.executionId?.trim() || "mcp-runtime-unavailable",
    serverId: request.serverId,
    toolName: request.toolName,
    status: "failed",
    content: [],
    structuredContent: {},
    metadata: {
      dependency: resolution,
    },
    errorMessage: resolution.detail ?? "MCP runtime dependency chain is unavailable.",
  };
}
