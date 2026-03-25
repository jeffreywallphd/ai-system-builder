import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { createAgent } from "../../../../domain/agents/Agent";
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
    goals: [{ id: "goal-1", objective: "Persist", constraints: [], successCriteria: ["saved"], priority: "normal", priorityOrder: 1, requiredToolIds: ["mcp:local:echo"] }],
    policy: {
      toolAccess: {
        allowedToolIds: ["mcp:local:echo"],
        allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }],
        scopeConstraints: [],
      },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 2 },
      safetyConstraints: {
        requiredApprovals: [],
        deniedPermissionIds: [],
        sandbox: { network: { allowed: true }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } },
      },
    },
    memory: {
      agentId: id,
      assets: [{ assetId: new AssetId("asset:memory:repo"), memoryType: "working" }],
      retrieval: { strategy: "latest-first", maxEntries: 5 },
      policy: { writableTypes: ["episodic", "working"], retention: { mode: "bounded", maxDurableEntries: 20 } },
      revision: 1,
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    execution: { maxExecutionUnits: 2, requireTrustedTools: true },
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
    expect(loaded?.policy.toolAccess.allowedToolIds).toEqual(["mcp:local:echo"]);

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
    expect(row.goal_count).toBe(1);
    expect(row.allowed_tool_count).toBe(1);
    db.close();

    const deleted = await repository.delete("agent:repo:2");
    expect(deleted).toBe(true);
    const listedAfterDelete = await repository.list();
    expect(listedAfterDelete).toHaveLength(1);

    repository.dispose();
  });
});
