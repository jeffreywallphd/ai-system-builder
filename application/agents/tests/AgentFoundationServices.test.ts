import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../domain/agents/Agent";
import { AgentService } from "../services/AgentService";
import { DeterministicAgentPlanningService } from "../services/AgentPlanningInterface";
import { AgentExecutionService } from "../services/AgentExecutionService";
import { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type { IAgentToolOrchestrator } from "../../ports/interfaces/IAgentToolOrchestrator";

class InMemoryAgentRepository implements IAgentRepository {
  private readonly store = new Map<string, Agent>();
  async save(agent: Agent): Promise<Agent> { this.store.set(agent.id, agent); return agent; }
  async get(id: string): Promise<Agent | undefined> { return this.store.get(id); }
  async list(): Promise<ReadonlyArray<Agent>> { return [...this.store.values()]; }
}

describe("Agent foundation services", () => {
  it("creates and lists agents", async () => {
    const service = new AgentService(new InMemoryAgentRepository());
    await service.createAgent({
      id: "agent-a",
      goals: [{ goalId: "goal-1", title: "Collect facts", successCriteria: ["facts collected"] }],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:a"] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    });

    const agents = await service.listAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0]?.memoryConfig.memoryAssetIds).toEqual(["asset:memory:a"]);
  });

  it("returns deterministic plan steps", () => {
    const planner = new DeterministicAgentPlanningService();
    const step = planner.planNextStep({
      id: "agent-plan",
      goals: [{ goalId: "goal-1", title: "Analyze", successCriteria: ["done"] }],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: [] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    });

    expect(step.goalId).toBe("goal-1");
    expect(step.toolId).toBe("mcp:local:echo");
  });

  it("wires basic linear execution through existing agent tool execution use case", async () => {
    const catalog: IToolCapabilityCatalog = {
      async listCapabilities() {
        return [{
          id: "mcp:local:echo",
          identity: { stableId: "mcp:local:echo", providerScopedId: "mcp:local:echo" },
          routingName: "echo",
          displayName: "Echo",
          provider: { kind: "mcp", id: "mcp", label: "MCP" },
          source: { kind: "mcp", serverId: "local", toolName: "echo" },
          publication: { isPublished: true },
        }];
      },
    };

    const orchestrator: IAgentToolOrchestrator = {
      async execute(request) {
        return {
          executionId: request.executionId ?? "agent-exec",
          status: "completed",
          input: request.input,
          maxIterations: request.maxIterations,
          iterationCount: 1,
          stoppedReason: "completed",
          availableTools: request.availableTools,
          selectedTools: request.selectedTools,
          steps: [],
          finalOutput: "ok",
        };
      },
    };

    const useCase = new ExecuteAgentToolsUseCase(catalog, orchestrator);
    const service = new AgentExecutionService(useCase);
    const agent: Agent = {
      id: "agent-exec",
      goals: [{ goalId: "goal-1", title: "Echo this", successCriteria: ["response"] }],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:1"] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    };

    const graph = service.buildExecutionGraph(agent);
    expect(graph.steps).toHaveLength(1);
    expect(graph.steps[0]?.toolId).toBe("mcp:local:echo");

    const result = await service.execute(agent);
    expect(result.status).toBe("completed");
    expect(result.executionId).toContain("agent:agent-exec");
  });
});
