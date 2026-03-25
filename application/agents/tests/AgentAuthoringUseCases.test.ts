import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../domain/agents/Agent";
import { AssetId } from "../../../domain/assets/AssetId";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";
import { CreateAgentUseCase } from "../CreateAgentUseCase";
import { GetAgentUseCase } from "../GetAgentUseCase";
import { ListAgentsUseCase } from "../ListAgentsUseCase";
import { UpdateAgentUseCase } from "../UpdateAgentUseCase";
import { DeleteAgentUseCase } from "../DeleteAgentUseCase";
import { ArchiveAgentUseCase } from "../ArchiveAgentUseCase";
import { ConfigureAgentGoalsUseCase } from "../ConfigureAgentGoalsUseCase";
import { ConfigureAgentPolicyUseCase } from "../ConfigureAgentPolicyUseCase";
import { ConfigureAgentToolsUseCase } from "../ConfigureAgentToolsUseCase";
import { ConfigureAgentMemoryUseCase } from "../ConfigureAgentMemoryUseCase";
import { ConfigureAgentStrategyUseCase } from "../ConfigureAgentStrategyUseCase";
import { ValidateAgentConfigurationUseCase } from "../ValidateAgentConfigurationUseCase";
import { AgentConfigurationValidationService } from "../services/AgentConfigurationValidationService";

class InMemoryAgentRepository implements IAgentRepository {
  private readonly store = new Map<string, Agent>();

  async save(agent: Agent): Promise<Agent> {
    this.store.set(agent.id, agent);
    return agent;
  }

  async get(id: string): Promise<Agent | undefined> {
    return this.store.get(id.trim());
  }

  async list(): Promise<ReadonlyArray<Agent>> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id.trim());
  }
}

function createRequest(id = "agent:authoring:1") {
  return {
    id,
    name: "Authoring Agent",
    goals: [{ id: "goal-1", objective: "First goal", constraints: [], successCriteria: ["done"], priority: "normal" as const, priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] }],
    policy: {
      toolAccess: {
        allowedToolIds: ["mcp:local:echo"],
        allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }],
        scopeConstraints: [],
      },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 3 },
      safetyConstraints: {
        requiredApprovals: [],
        deniedPermissionIds: [],
        sandbox: { network: { allowed: true }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" as const } },
      },
    },
    memory: {
      agentId: id,
      assets: [{ assetId: new AssetId("asset:memory:authoring"), memoryType: "working" as const }],
      retrieval: { strategy: "latest-first" as const, maxEntries: 10 },
      policy: {
        retrievableTypes: ["working" as const],
        writableTypes: ["episodic" as const, "working" as const],
        retention: { mode: "bounded" as const, maxDurableEntries: 100 },
      },
      revision: 1,
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" as const },
    execution: { maxExecutionUnits: 3, requireTrustedTools: true },
  };
}

describe("Agent authoring use cases", () => {
  it("supports CRUD read-model projections", async () => {
    const repository = new InMemoryAgentRepository();
    const create = new CreateAgentUseCase(repository);
    const get = new GetAgentUseCase(repository);
    const list = new ListAgentsUseCase(repository);
    const update = new UpdateAgentUseCase(repository);
    const archive = new ArchiveAgentUseCase(repository);
    const deleteUseCase = new DeleteAgentUseCase(repository);

    await create.execute(createRequest("agent:authoring:crud"));

    const loaded = await get.execute("agent:authoring:crud");
    expect(loaded?.name).toBe("Authoring Agent");

    const updated = await update.execute({
      id: "agent:authoring:crud",
      changes: { name: "Renamed Agent" },
    });
    expect(updated.name).toBe("Renamed Agent");

    const archived = await archive.execute("agent:authoring:crud");
    expect(archived.status).toBe("archived");

    const activeOnly = await list.execute({ includeArchived: false });
    expect(activeOnly).toHaveLength(0);

    const deleted = await deleteUseCase.execute("agent:authoring:crud");
    expect(deleted).toBe(true);
    expect(await get.execute("agent:authoring:crud")).toBeUndefined();
  });

  it("supports structured goal add/update/remove/reorder semantics", async () => {
    const repository = new InMemoryAgentRepository();
    const create = new CreateAgentUseCase(repository);
    const configureGoals = new ConfigureAgentGoalsUseCase(repository);
    await create.execute(createRequest("agent:authoring:goals"));

    let updated = await configureGoals.execute({
      agentId: "agent:authoring:goals",
      operations: [{
        type: "add",
        goal: {
          id: "goal-2",
          objective: "Second goal",
          constraints: [],
          successCriteria: ["done"],
          priority: "high",
          priorityOrder: 2,
          requiredToolIds: ["mcp:local:echo"],
        },
      }],
    });
    expect(updated.goals).toHaveLength(2);

    updated = await configureGoals.execute({
      agentId: "agent:authoring:goals",
      operations: [{
        type: "update",
        goalId: "goal-2",
        goal: {
          objective: "Second goal updated",
          constraints: [],
          successCriteria: ["done"],
          priority: "critical",
          priorityOrder: 2,
          requiredToolIds: ["mcp:local:echo"],
        },
      }],
    });
    expect(updated.goals.find((goal) => goal.id === "goal-2")?.objective).toBe("Second goal updated");

    updated = await configureGoals.execute({
      agentId: "agent:authoring:goals",
      operations: [{ type: "reorder", goalIdsInPriorityOrder: ["goal-2", "goal-1"] }],
    });
    expect(updated.goals[0]?.id).toBe("goal-2");

    updated = await configureGoals.execute({
      agentId: "agent:authoring:goals",
      operations: [{ type: "remove", goalId: "goal-1" }],
    });
    expect(updated.goals.map((goal) => goal.id)).toEqual(["goal-2"]);
  });

  it("rejects duplicate/missing/incoherent goal configuration operations", async () => {
    const repository = new InMemoryAgentRepository();
    const create = new CreateAgentUseCase(repository);
    const configureGoals = new ConfigureAgentGoalsUseCase(repository);
    await create.execute(createRequest("agent:authoring:goal-errors"));

    await expect(configureGoals.execute({
      agentId: "agent:authoring:goal-errors",
      operations: [{
        type: "add",
        goal: {
          id: "goal-1",
          objective: "Duplicate id",
          constraints: [],
          successCriteria: ["done"],
          priority: "normal",
          priorityOrder: 2,
          requiredToolIds: ["mcp:local:echo"],
        },
      }],
    })).rejects.toThrow("already exists");

    await expect(configureGoals.execute({
      agentId: "agent:authoring:goal-errors",
      operations: [{ type: "remove", goalId: "goal-missing" }],
    })).rejects.toThrow("was not found");

    await expect(configureGoals.execute({
      agentId: "agent:authoring:goal-errors",
      operations: [{
        type: "add",
        goal: {
          id: "goal-2",
          objective: "Bad order",
          constraints: [],
          successCriteria: ["done"],
          priority: "normal",
          priorityOrder: 3,
          requiredToolIds: ["mcp:local:echo"],
        },
      }],
    })).rejects.toThrow("contiguous and start at 1");

    await expect(configureGoals.execute({
      agentId: "agent:authoring:goal-errors",
      operations: [{
        type: "add",
        goal: {
          id: "goal-2",
          objective: "Bad required tool ref",
          constraints: [],
          successCriteria: ["done"],
          priority: "normal",
          priorityOrder: 2,
          requiredToolIds: ["not-canonical"],
        },
      }],
    })).rejects.toThrow("malformed");
  });

  it("supports policy/tool/memory/strategy configuration updates", async () => {
    const repository = new InMemoryAgentRepository();
    const create = new CreateAgentUseCase(repository);
    await create.execute(createRequest("agent:authoring:config"));

    const configurePolicy = new ConfigureAgentPolicyUseCase(repository);
    const policyUpdated = await configurePolicy.execute("agent:authoring:config", {
      ...createRequest("agent:authoring:config").policy,
      executionLimits: { maxSteps: 4 },
    });
    expect(policyUpdated.policy.executionLimits.maxSteps).toBe(4);

    const configureTools = new ConfigureAgentToolsUseCase(repository);
    const toolsUpdated = await configureTools.execute("agent:authoring:config", {
      allowedToolIds: ["mcp:local:echo"],
      allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }],
      scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["runtime.execute"] }],
    });
    expect(toolsUpdated.policy.toolAccess.scopeConstraints).toHaveLength(1);
    expect(toolsUpdated.policy.toolAccess.allowedMcpTools).toEqual([
      { toolId: "mcp:local:echo", serverId: "local", toolName: "echo" },
    ]);

    const configureMemory = new ConfigureAgentMemoryUseCase(repository);
    const memoryUpdated = await configureMemory.execute("agent:authoring:config", {
      ...createRequest("agent:authoring:config").memory,
      retrieval: { strategy: "hybrid", maxEntries: 5, recency: { preferLatest: true, lookbackWindowEntries: 25 } },
    });
    expect(memoryUpdated.memory.retrieval.strategy).toBe("hybrid");

    const configureStrategy = new ConfigureAgentStrategyUseCase(repository);
    const strategyUpdated = await configureStrategy.execute("agent:authoring:config", {
      strategyId: "deterministic",
      mode: "deterministic-linear",
    });
    expect(strategyUpdated.planningStrategy.strategyId).toBe("deterministic");
  });

  it("rejects invalid tool/memory/strategy and reports validation issues", async () => {
    const repository = new InMemoryAgentRepository();
    const create = new CreateAgentUseCase(repository);
    await create.execute(createRequest("agent:authoring:validation"));

    const configureTools = new ConfigureAgentToolsUseCase(repository);
    await expect(configureTools.execute("agent:authoring:validation", {
      allowedToolIds: ["not-canonical-tool"],
      scopeConstraints: [],
    })).rejects.toThrow("malformed");

    const configureMemory = new ConfigureAgentMemoryUseCase(repository);
    await expect(configureMemory.execute("agent:authoring:validation", {
      ...createRequest("agent:authoring:validation").memory,
      retrieval: { strategy: "latest-first", maxEntries: 5, semantic: { minRelevanceScore: 0.4 } },
    })).rejects.toThrow("not allowed for latest-first");

    const configureStrategy = new ConfigureAgentStrategyUseCase(repository);
    await expect(configureStrategy.execute("agent:authoring:validation", {
      strategyId: "workflow-guided",
      mode: "deterministic-linear",
    })).rejects.toThrow("validation failed");

    const validate = new ValidateAgentConfigurationUseCase(new AgentConfigurationValidationService());
    const validation = await validate.execute({
      ...createRequest("agent:authoring:validation"),
      goals: [
        { id: "goal-1", objective: "A", constraints: [], successCriteria: ["ok"], priority: "normal", priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] },
        { id: "goal-2", objective: "B", constraints: [], successCriteria: ["ok"], priority: "normal", priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] },
      ],
      planningStrategy: { strategyId: "workflow-guided", mode: "workflow-guided" as any },
      execution: { maxExecutionUnits: 1, requireTrustedTools: true },
      policy: {
        ...createRequest("agent:authoring:validation").policy,
        executionLimits: { maxSteps: 1 },
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "goal-priority-order-duplicate")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "strategy-unsupported")).toBe(true);
  });

  it("rejects contradictory session-only and retention memory configuration updates", async () => {
    const repository = new InMemoryAgentRepository();
    const create = new CreateAgentUseCase(repository);
    await create.execute(createRequest("agent:authoring:memory-edges"));

    const configureMemory = new ConfigureAgentMemoryUseCase(repository);
    await expect(configureMemory.execute("agent:authoring:memory-edges", {
      ...createRequest("agent:authoring:memory-edges").memory,
      policy: {
        ...createRequest("agent:authoring:memory-edges").memory.policy,
        retrievableTypes: ["working"],
        writableTypes: ["working"],
        sessionOnlyTypes: ["working"],
        retention: { mode: "bounded", maxDurableEntries: 10 },
      },
      retrieval: {
        strategy: "latest-first",
        maxEntries: 5,
        memoryTypes: ["working"],
      },
    })).rejects.toThrow("validation failed");
  });

  it("returns structured validation issues with sections for API consumers", async () => {
    const validate = new ValidateAgentConfigurationUseCase(new AgentConfigurationValidationService());
    const base = createRequest("agent:authoring:issue-structure");
    const validation = await validate.execute({
      ...base,
      planningStrategy: { strategyId: "workflow-guided", mode: "workflow-guided" as any },
      memory: {
        ...base.memory,
        policy: {
          ...base.memory.policy,
          retrievableTypes: ["working"],
          writableTypes: ["working"],
          sessionOnlyTypes: ["working"],
          retention: { mode: "bounded", maxDurableEntries: 5 },
        },
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.every((issue) => typeof issue.section === "string" && issue.section.length > 0)).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "strategy-unsupported" && issue.section === "strategy")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-retrievable-session-only-overlap" && issue.section === "memory")).toBe(true);
  });

  it("returns explicit structured issues for malformed memory assets and strategy id", async () => {
    const validate = new ValidateAgentConfigurationUseCase(new AgentConfigurationValidationService());
    const base = createRequest("agent:authoring:malformed-struct");
    const validation = await validate.execute({
      ...base,
      planningStrategy: { strategyId: "   ", mode: "deterministic-linear" },
      memory: {
        ...base.memory,
        assets: [
          { assetId: new AssetId("memory:not-canonical"), memoryType: "working" },
          { assetId: new AssetId("asset:memory:dup"), memoryType: "working", assetVersionId: "v1" },
          { assetId: new AssetId("asset:memory:dup"), memoryType: "working", assetVersionId: "v1" },
          { assetId: new AssetId("asset:memory:bad-version"), memoryType: "working", assetVersionId: "bad version id" as any },
        ],
        retrieval: {
          strategy: "latest-first",
          maxEntries: 3,
          recency: { preferLatest: true, lookbackWindowEntries: 0 },
          semantic: { minRelevanceScore: 2 },
        },
        policy: {
          ...base.memory.policy,
          maxRetrievalEntries: 10,
          retention: { mode: "disabled", maxDurableEntries: 10 },
        },
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "memory-asset-id-noncanonical")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-asset-reference-duplicate")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-asset-version-id-malformed")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-recency-lookback-invalid")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-semantic-score-invalid")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-policy-max-retrieval-exceeds-retrieval")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-retention-disabled-max-durable-not-allowed")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "strategy-id-missing")).toBe(true);
  });

  it("reports deterministic cross-field validation issues for malformed authoring payloads", async () => {
    const validate = new ValidateAgentConfigurationUseCase(new AgentConfigurationValidationService());
    const base = createRequest("agent:authoring:cross-field");
    const validation = await validate.execute({
      ...base,
      goals: [{
        ...base.goals[0],
        objective: "   ",
        priorityOrder: 3,
        requiredToolIds: ["mcp:local:missing"],
      }],
      policy: {
        ...base.policy,
        toolAccess: {
          ...base.policy.toolAccess,
          allowedToolIds: ["not-canonical"],
        },
        executionLimits: { maxSteps: 0 },
      },
      memory: {
        ...base.memory,
        agentId: "agent:other",
        retrieval: { strategy: "hybrid", maxEntries: 5 },
      },
      execution: { ...base.execution, maxExecutionUnits: 4 },
      planningStrategy: { strategyId: "custom-linear", mode: "deterministic-linear" },
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "goal-objective-missing")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "goal-required-tool-not-allowed")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "goal-priority-order-noncontiguous")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "tool-id-malformed")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "execution-max-units-exceeds-policy-max-steps")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-agent-id-mismatch")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "memory-hybrid-config-missing")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "strategy-unsupported")).toBe(true);

    const malformedRequiredTool = await validate.execute({
      ...base,
      goals: [{
        ...base.goals[0],
        requiredToolIds: ["not-canonical-tool-id"],
      }],
    });
    expect(malformedRequiredTool.issues.some((issue) => issue.code === "goal-required-tool-malformed")).toBe(true);
  });
});
