import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { AssetId } from "../../../domain/assets/AssetId";
import { SqliteAgentRepository } from "../../../infrastructure/filesystem/agents/SqliteAgentRepository";
import { ArchiveAgentUseCase } from "../ArchiveAgentUseCase";
import { ConfigureAgentGoalsUseCase } from "../ConfigureAgentGoalsUseCase";
import { ConfigureAgentPolicyUseCase } from "../ConfigureAgentPolicyUseCase";
import { ConfigureAgentToolsUseCase } from "../ConfigureAgentToolsUseCase";
import { ConfigureAgentMemoryUseCase } from "../ConfigureAgentMemoryUseCase";
import { ConfigureAgentStrategyUseCase } from "../ConfigureAgentStrategyUseCase";
import { CreateAgentUseCase } from "../CreateAgentUseCase";
import { DeleteAgentUseCase } from "../DeleteAgentUseCase";
import { GetAgentUseCase } from "../GetAgentUseCase";
import { ListAgentsUseCase } from "../ListAgentsUseCase";
import { UpdateAgentUseCase } from "../UpdateAgentUseCase";
import { AgentConflictError, AgentInvalidRequestError, AgentNotFoundError } from "../AgentAuthoringErrors";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createRequest(id = "agent:sqlite:1") {
  return {
    id,
    name: "SQLite Agent",
    goals: [{ id: "goal-1", objective: "First goal", constraints: [], successCriteria: ["done"], priority: "normal" as const, priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] }],
    policy: {
      toolAccess: {
        allowedToolIds: ["mcp:local:echo"],
        allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }],
        scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["runtime.execute"] }],
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
      assets: [{ assetId: new AssetId("asset:memory:sqlite"), memoryType: "working" as const }],
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

describe("Agent authoring use cases (SQLite integration)", () => {
  it("supports CRUD and structured goal/policy/tool/memory/strategy updates with full read-model persistence", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-authoring-sqlite-"));
    createdRoots.push(root);
    const repository = new SqliteAgentRepository(path.join(root, "agents.sqlite"));

    const create = new CreateAgentUseCase(repository);
    const update = new UpdateAgentUseCase(repository);
    const get = new GetAgentUseCase(repository);
    const list = new ListAgentsUseCase(repository);
    const archive = new ArchiveAgentUseCase(repository);
    const deleteUseCase = new DeleteAgentUseCase(repository);
    const configureGoals = new ConfigureAgentGoalsUseCase(repository);
    const configurePolicy = new ConfigureAgentPolicyUseCase(repository);
    const configureTools = new ConfigureAgentToolsUseCase(repository);
    const configureMemory = new ConfigureAgentMemoryUseCase(repository);
    const configureStrategy = new ConfigureAgentStrategyUseCase(repository);

    await create.execute(createRequest("agent:sqlite:crud"));
    await update.execute({
      id: "agent:sqlite:crud",
      changes: { description: "Updated via SQLite use-case path." },
    });

    const goalUpdated = await configureGoals.execute({
      agentId: "agent:sqlite:crud",
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
    expect(goalUpdated.goals.map((goal) => goal.id)).toEqual(["goal-1", "goal-2"]);

    const policyUpdated = await configurePolicy.execute("agent:sqlite:crud", {
      ...createRequest("agent:sqlite:crud").policy,
      executionLimits: { maxSteps: 4, maxWallClockMs: 60000 },
    });
    expect(policyUpdated.policy.executionLimits.maxSteps).toBe(4);

    const toolsUpdated = await configureTools.execute("agent:sqlite:crud", {
      allowedToolIds: ["mcp:local:echo"],
      allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }],
      scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["runtime.execute", "workspace.read"] }],
    });
    expect(toolsUpdated.policy.toolAccess.scopeConstraints[0]?.allowedScopes).toEqual(["runtime.execute", "workspace.read"]);
    const memoryUpdated = await configureMemory.execute("agent:sqlite:crud", {
      ...createRequest("agent:sqlite:crud").memory,
      retrieval: { strategy: "hybrid", maxEntries: 8, recency: { preferLatest: true, lookbackWindowEntries: 12 } },
    });
    expect(memoryUpdated.memory.retrieval.strategy).toBe("hybrid");
    const strategyUpdated = await configureStrategy.execute("agent:sqlite:crud", {
      strategyId: "deterministic",
      mode: "deterministic-linear",
    });
    expect(strategyUpdated.planningStrategy.mode).toBe("deterministic-linear");

    const archived = await archive.execute("agent:sqlite:crud");
    expect(archived.status).toBe("archived");

    const listed = await list.execute({ includeArchived: true });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.memory.assets[0]?.assetId).toBe("asset:memory:sqlite");

    expect((await get.execute("agent:sqlite:crud"))?.description).toBe("Updated via SQLite use-case path.");
    expect(await deleteUseCase.execute("agent:sqlite:crud")).toBe(true);
    expect(await get.execute("agent:sqlite:crud")).toBeUndefined();

    repository.dispose();
  });

  it("enforces typed CRUD failure paths on real SQLite persistence", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-authoring-sqlite-"));
    createdRoots.push(root);
    const repository = new SqliteAgentRepository(path.join(root, "agents.sqlite"));

    const create = new CreateAgentUseCase(repository);
    const update = new UpdateAgentUseCase(repository);
    const get = new GetAgentUseCase(repository);
    const archive = new ArchiveAgentUseCase(repository);
    const deleteUseCase = new DeleteAgentUseCase(repository);

    await create.execute(createRequest("agent:sqlite:errors"));
    await expect(create.execute(createRequest("agent:sqlite:errors"))).rejects.toBeInstanceOf(AgentConflictError);
    await expect(update.execute({ id: "agent:sqlite:missing", changes: { name: "Missing" } })).rejects.toBeInstanceOf(AgentNotFoundError);
    await expect(archive.execute("agent:sqlite:missing")).rejects.toBeInstanceOf(AgentNotFoundError);
    await expect(get.execute("   ")).rejects.toBeInstanceOf(AgentInvalidRequestError);
    await expect(deleteUseCase.execute("   ")).rejects.toBeInstanceOf(AgentInvalidRequestError);

    repository.dispose();
  });
});
