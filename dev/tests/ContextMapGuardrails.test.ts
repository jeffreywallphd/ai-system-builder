import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contextMapPath = resolve(repoRoot, "docs/context/context-map.json");
const routingContractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
const packCatalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");
const humanSpecPath = resolve(repoRoot, "docs/context/context-map.md");
const aiSpecPath = resolve(repoRoot, "docs/context/context-map.ai.md");
const routingReadmePath = resolve(repoRoot, "docs/context/routing/README.md");
const routingAiReadmePath = resolve(repoRoot, "docs/context/routing/README.ai.md");

type RoutingContract = {
  supportedTaskCategories: Array<{ id: string }>;
  allowedSelectionModes: string[];
  priorityTiers: string[];
};

type ContextMap = {
  schemaVersion: string;
  artifactType: string;
  routingContractPath: string;
  routingSeedPath: string;
  contextPackCatalogPath: string;
  taskCategoryDefaults: Array<{
    taskCategoryId: string;
    selectionMode: string;
    priorityTier: string;
  }>;
  globalExclusionRules: string[];
  taskCategoryMappings: Array<{
    mappingId: string;
    taskCategoryId: string;
    intentId: string;
    packRefs: Array<{
      packId: string;
      priorityOrder: number;
    }>;
    excludePackIds: string[];
    notes: string;
    status: string;
  }>;
};

describe("context map guardrails", () => {
  it("keeps context map artifacts present", () => {
    expect(existsSync(contextMapPath)).toBe(true);
    expect(existsSync(routingContractPath)).toBe(true);
    expect(existsSync(packCatalogSeedPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("keeps context map parseable and aligned to routing contract categories", () => {
    const contextMap = JSON.parse(readFileSync(contextMapPath, "utf8")) as ContextMap;
    const routingContract = JSON.parse(readFileSync(routingContractPath, "utf8")) as RoutingContract;
    const packCatalogSeed = JSON.parse(readFileSync(packCatalogSeedPath, "utf8")) as {
      packs: Array<{ id: string }>;
    };

    const allowedCategories = routingContract.supportedTaskCategories.map((entry) => entry.id);
    const allowedSelectionModes = routingContract.allowedSelectionModes;
    const allowedPriorityTiers = routingContract.priorityTiers;
    const allowedPackIds = new Set(packCatalogSeed.packs.map((pack) => pack.id));

    expect(contextMap.schemaVersion).toBe("1.0.0");
    expect(contextMap.artifactType).toBe("context-map");
    expect(contextMap.routingContractPath).toBe("docs/context/routing/task-to-context-routing.contract.json");
    expect(contextMap.routingSeedPath).toBe("docs/context/routing/task-to-context-routing.seed.json");
    expect(contextMap.contextPackCatalogPath).toBe("docs/context/packs/context-pack-catalog.seed.json");
    expect(contextMap.globalExclusionRules.length).toBeGreaterThanOrEqual(1);

    expect(contextMap.taskCategoryDefaults.length).toBe(allowedCategories.length);
    expect(contextMap.taskCategoryMappings.length).toBe(allowedCategories.length);

    const defaultCategoryIds = new Set(contextMap.taskCategoryDefaults.map((entry) => entry.taskCategoryId));
    const mappingCategoryIds = new Set(contextMap.taskCategoryMappings.map((entry) => entry.taskCategoryId));

    expect([...defaultCategoryIds].sort()).toEqual([...allowedCategories].sort());
    expect([...mappingCategoryIds].sort()).toEqual([...allowedCategories].sort());

    for (const entry of contextMap.taskCategoryDefaults) {
      expect(allowedSelectionModes).toContain(entry.selectionMode);
      expect(allowedPriorityTiers).toContain(entry.priorityTier);
    }

    for (const mapping of contextMap.taskCategoryMappings) {
      expect(mapping.mappingId.trim().length).toBeGreaterThan(0);
      expect(mapping.intentId.trim().length).toBeGreaterThan(0);
      expect(mapping.excludePackIds).toBeDefined();
      expect(Array.isArray(mapping.excludePackIds)).toBe(true);
      expect(mapping.status).toBe("active");
      expect(mapping.packRefs.length).toBeGreaterThanOrEqual(1);

      const orders = mapping.packRefs.map((entry) => entry.priorityOrder);
      const sortedOrders = [...orders].sort((left, right) => left - right);
      expect(orders).toEqual(sortedOrders);

      for (const ref of mapping.packRefs) {
        expect(Number.isInteger(ref.priorityOrder)).toBe(true);
        expect(ref.priorityOrder).toBeGreaterThan(0);
        expect(allowedPackIds.has(ref.packId)).toBe(true);
      }
    }
  });

  it("keeps context map docs and routing routers linked", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");
    const routingReadme = readFileSync(routingReadmePath, "utf8");
    const routingAiReadme = readFileSync(routingAiReadmePath, "utf8");

    expect(humanSpec).toContain("## Top-Level Shape");
    expect(humanSpec).toContain("## Mapping Entry Shape");
    expect(humanSpec).toContain("## Validation");

    expect(aiSpec).toContain("## Required Map Concepts");
    expect(aiSpec).toContain("## Authoring Rules");
    expect(aiSpec).toContain("## Guardrails");

    expect(routingReadme).toContain("../context-map.json");
    expect(routingAiReadme).toContain("../context-map.json");
  });
});

