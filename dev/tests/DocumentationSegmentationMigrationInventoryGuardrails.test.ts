import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const inventoryMdPath = resolve(repoRoot, "docs/documentation-segmentation-migration-inventory.md");
const inventoryAiMdPath = resolve(repoRoot, "docs/documentation-segmentation-migration-inventory.ai.md");
const inventoryJsonPath = resolve(
  repoRoot,
  "docs/documentation-segmentation-migration-inventory.inventory.json",
);
const docsReadmePath = resolve(repoRoot, "docs/README.md");
const docsReadmeAiPath = resolve(repoRoot, "docs/README.ai.md");
const baselinesReadmePath = resolve(repoRoot, "docs/baselines/README.md");
const baselinesReadmeAiPath = resolve(repoRoot, "docs/baselines/README.ai.md");

const requiredCategories = [
  "mixed-purpose",
  "historical",
  "baseline-candidate",
  "transitional",
  "superseded",
] as const;

describe("documentation segmentation migration inventory guardrails", () => {
  it("keeps human, AI, and machine-readable inventory artifacts present", () => {
    expect(existsSync(inventoryMdPath)).toBe(true);
    expect(existsSync(inventoryAiMdPath)).toBe(true);
    expect(existsSync(inventoryJsonPath)).toBe(true);
  });

  it("keeps required migration sections in both markdown variants", () => {
    const humanDoc = readFileSync(inventoryMdPath, "utf8");
    const aiDoc = readFileSync(inventoryAiMdPath, "utf8");

    for (const heading of [
      "## Purpose",
      "## Scope",
      "## Inventory Summary",
      "## High-Priority Migration Candidates",
      "## Detailed Candidate Inventory",
      "## Migration Batch Plan (Suggested)",
      "## Deliberate Execution Rules for Follow-On Stories",
    ] as const) {
      expect(humanDoc).toContain(heading);
    }

    for (const heading of [
      "## Purpose",
      "## Scope",
      "## Inventory Summary",
      "## High-Priority Candidates",
      "## Detailed Candidate Inventory",
      "## Suggested Migration Batches",
      "## Deliberate Execution Rules",
    ] as const) {
      expect(aiDoc).toContain(heading);
    }

    for (const signal of [
      "domain-and-application-core.md",
      "desktop-runtime-and-hosts.md",
      "offline-local-mode-authority-boundaries.md",
      "authorization-feature-4-final-baseline.md",
      "entrypoint-host-composition-migration-12.4.1.md",
      "documentation-segmentation-migration-inventory.inventory.json",
    ] as const) {
      expect(humanDoc).toContain(signal);
      expect(aiDoc).toContain(signal);
    }
  });

  it("keeps inventory discoverable from docs root and baselines routers", () => {
    const docsReadme = readFileSync(docsReadmePath, "utf8");
    const docsReadmeAi = readFileSync(docsReadmeAiPath, "utf8");
    const baselinesReadme = readFileSync(baselinesReadmePath, "utf8");
    const baselinesReadmeAi = readFileSync(baselinesReadmeAiPath, "utf8");

    expect(docsReadme).toContain("./documentation-segmentation-migration-inventory.md");
    expect(docsReadmeAi).toContain("./documentation-segmentation-migration-inventory.ai.md");
    expect(baselinesReadme).toContain("../documentation-segmentation-migration-inventory.md");
    expect(baselinesReadme).toContain("../documentation-segmentation-migration-inventory.inventory.json");
    expect(baselinesReadmeAi).toContain("../documentation-segmentation-migration-inventory.ai.md");
    expect(baselinesReadmeAi).toContain("../documentation-segmentation-migration-inventory.inventory.json");
  });

  it("keeps machine-readable category coverage and high-priority migration anchors", () => {
    const inventory = JSON.parse(readFileSync(inventoryJsonPath, "utf8"));

    expect(inventory.story).toBe("5.2.1");
    expect(inventory.scope.approach).toBe("high-value-first");
    expect(inventory.scope.exhaustive).toBe(false);

    const categories = new Set<string>(inventory.categories);
    for (const category of requiredCategories) {
      expect(categories.has(category)).toBe(true);
    }

    expect(Array.isArray(inventory.candidates)).toBe(true);
    expect(inventory.candidates.length).toBeGreaterThanOrEqual(14);

    const ids = new Set<string>(inventory.candidates.map((candidate: { id: string }) => candidate.id));
    for (const requiredId of [
      "docseg-001-domain-and-application-core",
      "docseg-002-desktop-runtime-and-hosts",
      "docseg-003-offline-local-mode-authority-boundaries",
      "docseg-006-unified-api-convergence-plan",
      "docseg-007-authorization-feature-4-final-baseline",
      "docseg-012-entrypoint-host-composition-migration-12-4-1",
      "docseg-015-presentation-and-state",
    ] as const) {
      expect(ids.has(requiredId)).toBe(true);
    }

    const countsByCategory = new Map<string, number>();
    let highPriorityCount = 0;
    for (const candidate of inventory.candidates) {
      countsByCategory.set(candidate.category, (countsByCategory.get(candidate.category) ?? 0) + 1);
      if (candidate.priority === "high") {
        highPriorityCount += 1;
      }

      expect(typeof candidate.path).toBe("string");
      expect(["high", "medium", "low"]).toContain(candidate.priority);
      expect(["high", "medium", "low"]).toContain(candidate.risk);
      expect(Array.isArray(candidate.signals)).toBe(true);
      expect(candidate.signals.length).toBeGreaterThan(0);
      expect(Array.isArray(candidate.activeMaterialToPreserve)).toBe(true);
      expect(Array.isArray(candidate.historicalMaterialToIsolate)).toBe(true);
      expect(typeof candidate.recommendedAction?.type).toBe("string");
      expect(typeof candidate.recommendedAction?.targetActivePath === "string" || candidate.recommendedAction?.targetActivePath === null).toBe(true);
      expect(typeof candidate.recommendedAction?.targetHistoricalPath === "string" || candidate.recommendedAction?.targetHistoricalPath === null).toBe(true);
    }

    for (const category of requiredCategories) {
      expect((countsByCategory.get(category) ?? 0) > 0).toBe(true);
    }

    expect(highPriorityCount).toBeGreaterThanOrEqual(8);
    expect(Array.isArray(inventory.suggestedBatches)).toBe(true);
    expect(inventory.suggestedBatches.length).toBe(4);
  });
});
