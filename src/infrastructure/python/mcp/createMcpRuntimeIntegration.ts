import type { IMcpConfiguredServerRepository } from "@application/ports/interfaces/IMcpConfiguredServerRepository";
import type { IMcpRuntimeClient } from "@application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpServerCatalog } from "@application/ports/interfaces/IMcpServerCatalog";
import type { IMcpServerManager } from "@application/ports/interfaces/IMcpServerManager";
import type { IMcpToolCatalog } from "@application/ports/interfaces/IMcpToolCatalog";
import type { IMcpToolExecutor } from "@application/ports/interfaces/IMcpToolExecutor";
import type { IRuntimeEventSink } from "@application/ports/interfaces/IRuntimeEventSink";
import type { IRuntimeDependencyOrchestrator } from "@application/runtime/RuntimeDependencyOrchestrator";
import type { LocalMcpToolDraft } from "@application/mcp/models/LocalMcpToolDraft";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { HttpMcpRuntimeClient } from "./HttpMcpRuntimeClient";
import { HttpMcpServerRuntimeClient } from "./HttpMcpServerRuntimeClient";
import { PythonBackedMcpServerCatalog } from "./PythonBackedMcpServerCatalog";
import { PythonBackedMcpServerManager } from "./PythonBackedMcpServerManager";
import { PythonBackedMcpToolCatalog } from "./PythonBackedMcpToolCatalog";
import { PythonBackedMcpToolExecutor } from "./PythonBackedMcpToolExecutor";
import {
  createOrchestratedMcpConfiguredServerRepository,
  createOrchestratedMcpRuntimeClient,
  createOrchestratedMcpServerCatalog,
  createOrchestratedMcpServerManager,
} from "./createOrchestratedMcpRuntimeIntegration";
import { RuntimeBackedMcpConfiguredServerRepository } from "./RuntimeBackedMcpConfiguredServerRepository";

export interface McpRuntimeIntegration {
  readonly runtimeClient: IMcpRuntimeClient;
  readonly serverRuntimeClient: HttpMcpServerRuntimeClient | DisabledMcpServerRuntimeClient;
  readonly serverCatalog: IMcpServerCatalog;
  readonly serverManager: IMcpServerManager;
  readonly toolCatalog: IMcpToolCatalog;
  readonly toolExecutor: IMcpToolExecutor;
  readonly configuredServerRepository?: IMcpConfiguredServerRepository;
}

export class DisabledMcpServerRuntimeClient {
  public async getConnectionStatus() {
    return createDisabledRuntimeStatus();
  }

  public async listConfiguredServers() {
    return [];
  }

  public async connectServer(request: { readonly serverId: string }) {
    return createDisabledConnectionResult(request.serverId, "connect");
  }

  public async disconnectServer(serverId: string) {
    return createDisabledConnectionResult(serverId, "disconnect");
  }

  public async reconnectServer(serverId: string) {
    return createDisabledConnectionResult(serverId, "reconnect");
  }

  public async createLocalServer(draft: LocalMcpToolDraft) {
    return {
      server: createDisabledServerDescriptor(draft.serverId),
      status: createDisabledServerStatus(draft.serverId),
      runtime: createDisabledRuntimeStatus(),
      checkedAt: new Date().toISOString(),
      created: false,
    };
  }
}

export function createMcpRuntimeIntegration(
  config: PythonRuntimeConfig,
  eventSink?: IRuntimeEventSink,
  fetchImpl: typeof fetch = fetch,
  runtimeDependencyOrchestrator?: IRuntimeDependencyOrchestrator,
): McpRuntimeIntegration {
  if (!config.isEnabled) {
    const runtimeClient = createDisabledMcpRuntimeClient();
    const serverRuntimeClient = new DisabledMcpServerRuntimeClient();
    const serverCatalog = createDisabledMcpServerCatalog();
    const serverManager = createDisabledMcpServerManager();

    return Object.freeze({
      runtimeClient,
      serverRuntimeClient,
      serverCatalog,
      serverManager,
      toolCatalog: new PythonBackedMcpToolCatalog(runtimeClient, eventSink),
      toolExecutor: new PythonBackedMcpToolExecutor(runtimeClient, eventSink),
      configuredServerRepository: undefined,
    });
  }

  const baseRuntimeClient = new HttpMcpRuntimeClient(config, fetchImpl, eventSink);
  const serverRuntimeClient = new HttpMcpServerRuntimeClient(config, fetchImpl, eventSink);
  const baseServerCatalog = new PythonBackedMcpServerCatalog(serverRuntimeClient);
  const baseServerManager = new PythonBackedMcpServerManager(serverRuntimeClient, baseServerCatalog, eventSink);
  const runtimeClient = runtimeDependencyOrchestrator
    ? createOrchestratedMcpRuntimeClient(baseRuntimeClient, runtimeDependencyOrchestrator)
    : baseRuntimeClient;
  const serverCatalog = runtimeDependencyOrchestrator
    ? createOrchestratedMcpServerCatalog(baseServerCatalog, runtimeDependencyOrchestrator)
    : baseServerCatalog;
  const serverManager = runtimeDependencyOrchestrator
    ? createOrchestratedMcpServerManager(baseServerManager, runtimeDependencyOrchestrator)
    : baseServerManager;
  const configuredServerRepository = runtimeDependencyOrchestrator
    ? createOrchestratedMcpConfiguredServerRepository(
      new RuntimeBackedMcpConfiguredServerRepository(serverRuntimeClient),
      runtimeDependencyOrchestrator,
    )
    : new RuntimeBackedMcpConfiguredServerRepository(serverRuntimeClient);

  return Object.freeze({
    runtimeClient,
    serverRuntimeClient,
    serverCatalog,
    serverManager,
    toolCatalog: new PythonBackedMcpToolCatalog(runtimeClient, eventSink),
    toolExecutor: new PythonBackedMcpToolExecutor(runtimeClient, eventSink),
    configuredServerRepository,
  });
}

export function createDisabledMcpRuntimeClient(): IMcpRuntimeClient {
  const runtime = createDisabledRuntimeStatus();

  return {
    getConnectionStatus: async () => runtime,
    listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: runtime }),
    searchServers: async (criteria) => ({
      query: criteria?.query?.trim() || "",
      totalCount: 0,
      limit: criteria?.limit ?? 20,
      servers: [],
      status: runtime,
    }),
    connectServer: async (request) => createDisabledConnectionResult(request.serverId, request.reconnect ? "reconnect" : "connect"),
    disconnectServer: async (serverId) => createDisabledConnectionResult(serverId, "disconnect"),
    listTools: async () => [],
    searchTools: async (criteria) => ({
      query: criteria?.query?.trim() || "",
      totalCount: 0,
      limit: criteria?.limit ?? 20,
      tools: [],
    }),
    getToolDescriptor: async () => undefined,
    listResources: async () => [],
    executeTool: async (request) => ({
      executionId: request.executionId?.trim() || "mcp-disabled",
      serverId: request.serverId,
      toolName: request.toolName,
      status: "failed",
      content: [],
      structuredContent: {},
      errorMessage: "Python runtime is disabled.",
    }),
  };
}

export function createDisabledMcpServerCatalog(): IMcpServerCatalog {
  return {
    getConnectionStatus: async () => createDisabledRuntimeStatus(),
    listConfiguredServers: async () => [],
    getServerStatus: async (serverId: string) => createDisabledServerStatus(serverId),
  };
}

export function createDisabledMcpServerManager(): IMcpServerManager {
  return {
    connectServer: async (request) => createDisabledConnectionResult(request.serverId, "connect"),
    disconnectServer: async (serverId) => createDisabledConnectionResult(serverId, "disconnect"),
    reconnectServer: async (serverId) => createDisabledConnectionResult(serverId, "reconnect"),
    createLocalServer: async (draft) => ({
      server: createDisabledServerDescriptor(draft.serverId),
      status: createDisabledServerStatus(draft.serverId),
      runtime: createDisabledRuntimeStatus(),
      checkedAt: new Date().toISOString(),
      created: false,
    }),
  };
}

function createDisabledRuntimeStatus() {
  return {
    enabled: false,
    state: "disabled" as const,
    checkedAt: new Date().toISOString(),
    servers: [],
    capabilities: { tools: false, resources: false, toolExecution: false },
    metadata: { reason: "python-runtime-disabled" },
  };
}

function createDisabledServerDescriptor(serverId: string) {
  return {
    id: serverId,
    name: serverId,
    transport: "inmemory" as const,
    enabled: false,
    status: "error" as const,
    connected: false,
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
    errorMessage: "Python runtime is disabled.",
  };
}

function createDisabledServerStatus(serverId: string) {
  return {
    serverId,
    name: serverId,
    transport: "inmemory" as const,
    configured: false,
    enabled: false,
    state: "error" as const,
    connected: false,
    checkedAt: new Date().toISOString(),
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
    errorMessage: "Python runtime is disabled.",
  };
}

function createDisabledConnectionResult(serverId: string, action: "connect" | "disconnect" | "reconnect") {
  return {
    action,
    checkedAt: new Date().toISOString(),
    server: createDisabledServerDescriptor(serverId),
    status: createDisabledServerStatus(serverId),
    runtime: createDisabledRuntimeStatus(),
    metadata: { reason: "python-runtime-disabled" },
  };
}

