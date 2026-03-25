import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { createAgent } from "../../../../domain/agents/Agent";
import { GetAgentUseCase } from "../../../../application/agents/GetAgentUseCase";
import { AssetId } from "../../../../domain/assets/AssetId";
import { SqliteAgentRepository } from "../SqliteAgentRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function makeAgent(id = "agent:repo:1") {
  return createAgent({
    id,
    name: "Repository Agent",
    description: "Round-trip full aggregate.",
    goals: [
      { id: "goal-1", objective: "Persist", constraints: ["trusted-only"], successCriteria: ["saved"], priority: "normal", priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] },
      { id: "goal-2", objective: "Validate", constraints: ["bounded"], successCriteria: ["validated"], priority: "high", priorityOrder: 2, requiredToolIds: ["workflow:artifact:validator"] },
    ],
    policy: {
      toolAccess: {
        allowedToolIds: ["mcp:local:echo", "workflow:artifact:validator"],
        allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }],
        scopeConstraints: [
          { toolId: "mcp:local:echo", allowedScopes: ["runtime.execute"] },
          { toolId: "workflow:artifact:validator", allowedScopes: ["workflow.execute"] },
        ],
      },
      restrictedActions: ["filesystem.write"],
      costLimits: { maxTokens: 2000, maxEstimatedUsd: 0.5 },
      executionLimits: { maxSteps: 4, maxWallClockMs: 120000 },
      safetyConstraints: {
        requiredApprovals: [{ permissionId: "network.access", minimumStatus: "approved", scopeType: "tool", scopeId: "mcp:local:echo" }],
        deniedPermissionIds: ["workspace.write"],
        sandbox: {
          network: { allowed: true, allowedHosts: ["api.example.com"], allowedProtocols: ["https"] },
          filesystem: { allowed: true, readPaths: ["/workspace"], writePaths: [] },
          assets: { read: true, write: false },
          environment: { mode: "allowlist", allowedEnvVars: ["TZ"] },
        },
      },
    },
    memory: {
      agentId: id,
      assets: [
        { assetId: new AssetId("asset:memory:repo"), memoryType: "working", assetVersionId: "v1", lineageTag: "seed" },
        { assetId: new AssetId("asset:memory:repo2"), memoryType: "episodic" },
      ],
      retrieval: {
        strategy: "hybrid",
        maxEntries: 5,
        semantic: { minRelevanceScore: 0.4 },
        recency: { preferLatest: true, lookbackWindowEntries: 20 },
      },
      policy: {
        maxRetrievalEntries: 5,
        retrievableTypes: ["episodic", "working"],
        writableTypes: ["episodic", "working"],
        sessionOnlyTypes: ["working"],
        retention: { mode: "bounded", maxDurableEntries: 20 },
      },
      revision: 2,
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    execution: { maxExecutionUnits: 4, maxRunDurationMs: 30000, requireTrustedTools: true },
  });
}

describe("SqliteAgentRepository", () => {
  it("round-trips save/get/list/delete", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-repo-"));
    createdRoots.push(root);
    const repository = new SqliteAgentRepository(path.join(root, "agents.sqlite"));

    const saved = await repository.save(makeAgent("agent:repo:1"));
    await repository.save(makeAgent("agent:repo:2"));

    const loaded = await repository.get(saved.id);
    expect(loaded?.id).toBe("agent:repo:1");
    expect(loaded).toEqual(saved);
    expect(loaded?.memory.assets[0]?.assetId).toBeInstanceOf(AssetId);

    const readModel = await new GetAgentUseCase(repository).execute(saved.id);
    expect(readModel?.memory.assets[0]?.assetId).toBe("asset:memory:repo");
    expect(readModel?.memory.assets[0]?.assetVersionId).toBe("v1");

    const listed = await repository.list();
    expect(listed).toHaveLength(2);
    const db = new Database(path.join(root, "agents.sqlite"));
    const row = db.prepare(`
      SELECT strategy_id, strategy_mode, goal_count, allowed_tool_count
      FROM agents
      WHERE agent_id = ?
    `).get("agent:repo:1") as {
      strategy_id: string | null;
      strategy_mode: string | null;
      goal_count: number;
      allowed_tool_count: number;
    };
    expect(row.strategy_id).toBe("deterministic");
    expect(row.strategy_mode).toBe("deterministic-linear");
    expect(row.goal_count).toBe(2);
    expect(row.allowed_tool_count).toBe(2);
    db.close();

    const deleted = await repository.delete("agent:repo:2");
    expect(deleted).toBe(true);
    const listedAfterDelete = await repository.list();
    expect(listedAfterDelete).toHaveLength(1);

    repository.dispose();
  });

  it("handles blank ids and missing deletes without throwing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-repo-"));
    createdRoots.push(root);
    const repository = new SqliteAgentRepository(path.join(root, "agents.sqlite"));

    expect(await repository.get("   ")).toBeUndefined();
    expect(await repository.delete("   ")).toBe(false);
    expect(await repository.delete("agent:missing")).toBe(false);

    repository.dispose();
  });

  it("rehydrates legacy serialized memory asset ids stored as object values", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-repo-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "agents.sqlite");
    const repository = new SqliteAgentRepository(databasePath);

    const saved = await repository.save(makeAgent("agent:repo:legacy-memory"));
    const db = new Database(databasePath);
    const row = db.prepare("SELECT agent_json FROM agents WHERE agent_id = ?").get(saved.id) as { agent_json: string };
    const parsed = JSON.parse(row.agent_json) as { memory: { assets: Array<{ assetId: unknown }> } };
    parsed.memory.assets[0].assetId = { value: "asset:memory:repo" };
    db.prepare("UPDATE agents SET agent_json = ? WHERE agent_id = ?").run(JSON.stringify(parsed), saved.id);
    db.close();

    const loaded = await repository.get(saved.id);
    expect(loaded?.memory.assets[0]?.assetId).toBeInstanceOf(AssetId);
    expect(loaded?.memory.assets[0]?.assetId.toString()).toBe("asset:memory:repo");

    repository.dispose();
  });
});
