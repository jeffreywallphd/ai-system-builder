import { describe, expect, it } from "bun:test";
import type { Agent } from "../../../../domain/agents/Agent";
import { AssetId } from "../../../../domain/assets/AssetId";
import type { IAgentRepository } from "../../../../application/ports/interfaces/IAgentRepository";
import { AgentAuthoringBackendApi } from "../AgentAuthoringBackendApi";

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

function createRequest(id = "agent:api:1") {
  return {
    id,
    name: "API Agent",
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
      assets: [{ assetId: new AssetId("asset:memory:api"), memoryType: "working" as const }],
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

describe("AgentAuthoringBackendApi", () => {
  it("supports backend CRUD and configuration endpoints", async () => {
    const api = new AgentAuthoringBackendApi(new InMemoryAgentRepository());
    const created = await api.createAgent(createRequest("agent:api:crud"));
    expect(created.ok).toBe(true);
    expect(created.data?.id).toBe("agent:api:crud");

    const listed = await api.listAgents();
    expect(listed.ok).toBe(true);
    expect(listed.data).toHaveLength(1);

    const configuredStrategy = await api.configureStrategy("agent:api:crud", {
      strategyId: "deterministic",
      mode: "deterministic-linear",
    });
    expect(configuredStrategy.ok).toBe(true);
    expect(configuredStrategy.data?.planningStrategy.strategyId).toBe("deterministic");

    const archived = await api.archiveAgent("agent:api:crud");
    expect(archived.ok).toBe(true);
    expect(archived.data?.status).toBe("archived");

    const deleted = await api.deleteAgent("agent:api:crud");
    expect(deleted.ok).toBe(true);
    expect(deleted.data?.deleted).toBe(true);
  });

  it("returns structured validation-failed errors and issues for invalid requests", async () => {
    const api = new AgentAuthoringBackendApi(new InMemoryAgentRepository());
    await api.createAgent(createRequest("agent:api:validation"));

    const invalidStrategy = await api.configureStrategy("agent:api:validation", {
      strategyId: "workflow-guided",
      mode: "deterministic-linear",
    });
    expect(invalidStrategy.ok).toBe(false);
    expect(invalidStrategy.error?.code).toBe("validation-failed");
    expect(invalidStrategy.error?.validationIssues?.some((issue) => issue.code === "strategy-unsupported")).toBe(true);

    const invalidMemory = await api.configureMemory("agent:api:validation", {
      ...createRequest("agent:api:validation").memory,
      policy: {
        retrievableTypes: ["working"],
        writableTypes: ["working"],
        sessionOnlyTypes: ["working"],
        retention: { mode: "bounded", maxDurableEntries: 10 },
      },
      retrieval: {
        strategy: "latest-first",
        maxEntries: 10,
        memoryTypes: ["working"],
      },
    });
    expect(invalidMemory.ok).toBe(false);
    expect(invalidMemory.error?.code).toBe("validation-failed");
    expect(invalidMemory.error?.validationIssues?.some((issue) => issue.section === "memory")).toBe(true);
  });

  it("maps conflict, not-found, and validate endpoint responses through thin transport contracts", async () => {
    const api = new AgentAuthoringBackendApi(new InMemoryAgentRepository());
    const created = await api.createAgent(createRequest("agent:api:mapping"));
    expect(created.ok).toBe(true);

    const duplicate = await api.createAgent(createRequest("agent:api:mapping"));
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error?.code).toBe("conflict");

    const missing = await api.configureStrategy("agent:api:missing", {
      strategyId: "deterministic",
      mode: "deterministic-linear",
    });
    expect(missing.ok).toBe(false);
    expect(missing.error?.code).toBe("not-found");

    const validation = await api.validateConfiguration({
      ...createRequest("agent:api:mapping-validate"),
      planningStrategy: { strategyId: "", mode: "deterministic-linear" },
      memory: {
        ...createRequest("agent:api:mapping-validate").memory,
        assets: [{ assetId: new AssetId("memory:not-canonical"), memoryType: "working" }],
      },
    });
    expect(validation.ok).toBe(true);
    expect(validation.data?.valid).toBe(false);
    expect(validation.data?.issues.some((issue) => issue.code === "strategy-id-missing")).toBe(true);
    expect(validation.data?.issues.some((issue) => issue.code === "memory-asset-id-noncanonical")).toBe(true);
  });
});

