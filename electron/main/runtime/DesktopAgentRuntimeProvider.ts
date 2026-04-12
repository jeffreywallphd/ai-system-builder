import path from "node:path";
import process from "node:process";
import { AgentRunnerService } from "../../../src/application/agents/services/AgentRunnerService";
import { DeterministicAgentPlanningService } from "../../../src/application/agents/services/AgentPlanningInterface";
import { ExecuteAgentToolsUseCase } from "../../../src/application/agents/ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../../../src/application/agents/services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../../../src/application/agents/services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../../../src/application/agents/services/AssetBackedAgentMemoryStore";
import { SqliteAssetSystemAgentMemoryCatalog } from "../../../src/infrastructure/filesystem/agents/SqliteAssetSystemAgentMemoryCatalog";
import { CompositeToolCapabilityCatalog } from "../../../src/infrastructure/tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog } from "../../../src/infrastructure/tools/StaticLocalToolCapabilityCatalog";
import { McpToolCapabilityCatalog } from "../../../src/infrastructure/tools/McpToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../../../src/infrastructure/tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "../../../src/infrastructure/tools/StaticLocalToolCapabilityExecutor";
import { McpToolCapabilityExecutor } from "../../../src/infrastructure/tools/McpToolCapabilityExecutor";
import { DeterministicToolCapabilityAgentOrchestrator } from "../../../src/infrastructure/agents/DeterministicToolCapabilityAgentOrchestrator";
import { PythonRuntimeConfig } from "../../../src/infrastructure/config/PythonRuntimeConfig";
import { createMcpRuntimeIntegration } from "../../../src/infrastructure/python/mcp/createMcpRuntimeIntegration";
import { SqliteAssetSystemRepository } from "../../../src/infrastructure/filesystem/SqliteAssetSystemRepository";
import { SqliteAgentRepository } from "../../../src/infrastructure/filesystem/agents/SqliteAgentRepository";
import { SqliteAgentExecutionSessionRepository } from "../../../src/infrastructure/filesystem/agents/SqliteAgentExecutionSessionRepository";
import { AgentStudioBackendApi } from "../../../src/infrastructure/api/agents/AgentStudioBackendApi";
import type { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";

export type DesktopAgentRuntimeProvider = {
  readonly ensureAgentStudioBackendApi: () => AgentStudioBackendApi;
  readonly dispose: () => void;
};

export function createDesktopAgentRuntimeProvider(params: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly onRuntimeReady?: () => void;
}): DesktopAgentRuntimeProvider {
  let agentRepository: SqliteAgentRepository | undefined;
  let agentSessionRepository: SqliteAgentExecutionSessionRepository | undefined;
  let agentRunnerAssetSystemRepository: SqliteAssetSystemRepository | undefined;
  let agentStudioBackendApi: AgentStudioBackendApi | undefined;

  function createDesktopAgentRunner(runtime: {
    readonly assetSystemRepository: SqliteAssetSystemRepository;
    readonly sessionRepository: SqliteAgentExecutionSessionRepository;
  }): AgentRunnerService {
    const pythonConfig = PythonRuntimeConfig.fromEnv(process.env);
    const mcpIntegration = createMcpRuntimeIntegration(pythonConfig);
    const toolCatalog = new CompositeToolCapabilityCatalog([
      new StaticLocalToolCapabilityCatalog([]),
      new McpToolCapabilityCatalog(mcpIntegration.toolCatalog),
    ]);
    const toolExecutor = new CompositeToolCapabilityExecutor([
      {
        providerKind: "local",
        providerId: "local-runtime",
        executor: new StaticLocalToolCapabilityExecutor({}),
      },
      {
        providerKind: "mcp",
        providerId: "python-mcp-runtime",
        executor: new McpToolCapabilityExecutor(mcpIntegration.toolExecutor),
      },
    ]);
    const memoryStore = new AssetBackedAgentMemoryStore(
      new SqliteAssetSystemAgentMemoryCatalog(runtime.assetSystemRepository),
      runtime.assetSystemRepository,
    );
    return new AgentRunnerService(
      new DeterministicAgentPlanningService(toolCatalog, memoryStore),
      new ExecuteAgentToolsUseCase(toolCatalog, new DeterministicToolCapabilityAgentOrchestrator(toolExecutor)),
      new DefaultAgentMemoryRetrievalService(memoryStore),
      new AgentMemoryWriteService(memoryStore),
      undefined,
      undefined,
      runtime.sessionRepository,
    );
  }

  function ensureAgentStudioBackendApi(): AgentStudioBackendApi {
    if (agentStudioBackendApi) {
      return agentStudioBackendApi;
    }
    agentRepository = new SqliteAgentRepository(path.join(params.storagePaths.storageDirectory, "agents", "agents.sqlite"));
    agentSessionRepository = new SqliteAgentExecutionSessionRepository(path.join(params.storagePaths.storageDirectory, "agents", "agent-sessions.sqlite"));
    agentRunnerAssetSystemRepository = new SqliteAssetSystemRepository(path.join(params.storagePaths.assetsDirectory, "asset-system.sqlite"));
    const agentRunner = createDesktopAgentRunner({
      assetSystemRepository: agentRunnerAssetSystemRepository,
      sessionRepository: agentSessionRepository,
    });
    agentStudioBackendApi = new AgentStudioBackendApi(agentRepository, agentSessionRepository, agentRunner);
    params.onRuntimeReady?.();
    return agentStudioBackendApi;
  }

  function dispose(): void {
    agentRepository?.dispose();
    agentSessionRepository?.dispose();
    const assetSystemRepository = agentRunnerAssetSystemRepository as { dispose?: () => void } | undefined;
    if (typeof assetSystemRepository?.dispose === "function") {
      assetSystemRepository.dispose();
    }
    agentStudioBackendApi = undefined;
    agentRepository = undefined;
    agentSessionRepository = undefined;
    agentRunnerAssetSystemRepository = undefined;
  }

  return Object.freeze({
    ensureAgentStudioBackendApi,
    dispose,
  });
}
