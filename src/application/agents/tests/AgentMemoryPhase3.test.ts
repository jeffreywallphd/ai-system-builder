import { describe, expect, it } from "bun:test";
import { Asset } from "@domain/assets/Asset";
import { AssetId } from "@domain/assets/AssetId";
import { AssetVersion } from "@domain/assets/AssetVersion";
import type { Agent } from "@domain/agents/Agent";
import { DefaultAgentMemoryRetrievalService } from "../services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../services/AssetBackedAgentMemoryStore";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";

class InMemoryAssetRepo implements IAssetCatalog, IAssetVersionRepository {
  private readonly assets = new Map<string, Asset>();
  private readonly versions = new Map<string, AssetVersion>();

  async list(): Promise<ReadonlyArray<Asset>> { return [...this.assets.values()]; }
  async getById(id: string): Promise<Asset | undefined> { return this.assets.get(id.trim()); }
  async save(asset: Asset): Promise<void> { this.assets.set(asset.id, asset); }
  async remove(id: string): Promise<boolean> { return this.assets.delete(id.trim()); }
  async exists(id: string): Promise<boolean> { return this.assets.has(id.trim()); }
  async saveVersion(version: AssetVersion): Promise<void> { this.versions.set(version.versionId, version); }
  async getByVersionId(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId.trim()); }
  async listVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((version) => version.assetId.value === assetId.trim());
  }
}

const baseAgent: Agent = {
  id: "agent-memory",
  name: "Memory Agent",
  description: undefined,
  goals: [{ id: "g1", objective: "remember", constraints: [], successCriteria: ["done"], priority: "normal", priorityOrder: 1 }],
  policy: {
    toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
    restrictedActions: [],
    costLimits: {},
    executionLimits: {},
    safetyConstraints: { requiredApprovals: [], deniedPermissionIds: [], sandbox: { network: { allowed: false }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } } },
  },
  toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
  memory: {
    agentId: "agent-memory",
    assets: [
      { assetId: new AssetId("asset:memory:semantic"), memoryType: "semantic" },
      { assetId: new AssetId("asset:memory:episodic"), memoryType: "episodic" },
    ],
    retrieval: { strategy: "latest-first", maxEntries: 10, requiredTags: ["planning"] },
    policy: {
      maxRetrievalEntries: 2,
      retrievableTypes: ["semantic"],
      writableTypes: ["episodic", "semantic"],
      sessionOnlyTypes: ["working"],
      retention: { mode: "bounded", maxDurableEntries: 10 },
    },
    revision: 1,
  },
  planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
  execution: { requireTrustedTools: true },
  status: "ready",
  createdAt: "2026-03-24T00:00:00.000Z",
  updatedAt: "2026-03-24T00:00:00.000Z",
};

describe("Agent memory phase 3 services", () => {
  it("retrieves with policy-bounded types, metadata filters, and recency", async () => {
    const repo = new InMemoryAssetRepo();
    const store = new AssetBackedAgentMemoryStore(repo, repo);
    await store.add(baseAgent.id, {
      assetId: new AssetId("asset:memory:semantic"),
      memoryType: "semantic",
      tags: ["planning"],
      assetVersionId: "v-old",
      metadata: { topic: "weather", tenant: "north" },
    });
    await store.add(baseAgent.id, {
      assetId: new AssetId("asset:memory:semantic"),
      memoryType: "semantic",
      tags: ["planning"],
      assetVersionId: "v-new",
      metadata: { topic: "finance", tenant: "north" },
    });
    await store.add(baseAgent.id, { assetId: new AssetId("asset:memory:episodic"), memoryType: "episodic", tags: ["planning"] });

    const retrieval = new DefaultAgentMemoryRetrievalService(store);
    const beforeLatest = new Date(Date.now() + 1).toISOString();
    const entries = await retrieval.retrieveMemory({
      agent: baseAgent,
      memoryTypes: ["episodic", "semantic"],
      maxEntries: 10,
      beforeTimestamp: beforeLatest,
      metadata: { tenant: "north", topic: "finance" },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.memoryType).toBe("semantic");
    expect(entries[0]?.assetVersionId).toBe("v-new");
  });

  it("excludes session-only types from retrieval queries", async () => {
    const repo = new InMemoryAssetRepo();
    const store = new AssetBackedAgentMemoryStore(repo, repo);
    const retrieval = new DefaultAgentMemoryRetrievalService(store);

    const entries = await retrieval.retrieveMemory({
      agent: {
        ...baseAgent,
        memory: {
          ...baseAgent.memory,
          policy: {
            ...baseAgent.memory.policy,
            retrievableTypes: ["semantic", "working"],
            sessionOnlyTypes: ["working"],
          },
        },
      },
      memoryTypes: ["working", "semantic"],
    });

    expect(entries).toEqual([]);
  });

  it("writes only policy-allowed durable memory types and enforces retention caps", async () => {
    const repo = new InMemoryAssetRepo();
    const store = new AssetBackedAgentMemoryStore(repo, repo);
    const writer = new AgentMemoryWriteService(store);

    await store.add(baseAgent.id, {
      assetId: new AssetId("asset:memory:episodic"),
      memoryType: "episodic",
      tags: ["result"],
      assetVersionId: "existing-1",
    });
    await store.add(baseAgent.id, {
      assetId: new AssetId("asset:memory:episodic"),
      memoryType: "episodic",
      tags: ["result"],
      assetVersionId: "existing-2",
    });

    const retentionBoundedAgent: Agent = {
      ...baseAgent,
      memory: {
        ...baseAgent.memory,
        policy: {
          ...baseAgent.memory.policy,
          retention: { mode: "bounded", maxDurableEntries: 2 },
        },
      },
    };

    const result = await writer.writeEntries(retentionBoundedAgent, [
      { memoryType: "working", tags: ["session"] },
      { memoryType: "episodic", tags: ["result"], metadata: { planId: "p1", score: 1 } },
    ]);

    expect(result.persisted).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0]?.reason).toContain("memory-type-not-writable");
    expect(result.skipped[1]?.reason).toBe("retention-cap-reached");
  });
});

