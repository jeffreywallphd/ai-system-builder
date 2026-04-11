import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistrySeed = {
  entries: Array<{ recordId: string }>;
  discoveryIndex: {
    byTaskCategory: Record<string, string[]>;
  };
  taskRoutingIndex: {
    schemaVersion: string;
    routingSeedPath: string;
    contextMapPath: string;
    routeHintsByTaskCategory: Record<string, {
      routeTaskIds: string[];
      contextMapMappingIds: string[];
      defaultSelectionMode: string;
      defaultPriorityTier: string;
      contextAssemblyProfileId: string;
    }>;
  };
};

describe("story 6.3.2 task-oriented discovery paths guardrails", () => {
  it("keeps task-category discovery index and routing hints tied to routing/context artifacts", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const knownRecordIds = new Set(registry.entries.map((entry) => entry.recordId));

    expect(registry.taskRoutingIndex.schemaVersion).toBe("1.0.0");
    expect(registry.taskRoutingIndex.routingSeedPath).toBe("docs/context/routing/task-to-context-routing.seed.json");
    expect(registry.taskRoutingIndex.contextMapPath).toBe("docs/context/context-map.json");

    const requiredTaskCategories = [
      "architecture-review",
      "feature-decomposition",
      "coding-implementation",
      "diagnostics",
      "runtime-security",
      "documentation-change",
    ] as const;

    for (const taskCategory of requiredTaskCategories) {
      const recordIds = registry.discoveryIndex.byTaskCategory[taskCategory] ?? [];
      const hint = registry.taskRoutingIndex.routeHintsByTaskCategory[taskCategory];

      expect(recordIds.length).toBeGreaterThanOrEqual(3);
      expect(hint).toBeDefined();
      expect(Array.isArray(hint.routeTaskIds)).toBe(true);
      expect(Array.isArray(hint.contextMapMappingIds)).toBe(true);
      expect(hint.contextMapMappingIds.length).toBeGreaterThan(0);
      expect(hint.contextAssemblyProfileId).toBe("foundation-domain-implementation-optional-v1");

      for (const recordId of recordIds) {
        expect(knownRecordIds.has(recordId)).toBe(true);
      }
    }
  });

  it("keeps the generated index view task-workflow section practical and route-aware", () => {
    const humanIndex = read("docs/context/documentation-index.md");
    const aiIndex = read("docs/context/documentation-index.ai.md");

    for (const content of [humanIndex, aiIndex]) {
      expect(content).toContain("## Browse by Task Workflow");
      expect(content).toContain("`architecture-review`");
      expect(content).toContain("`feature-decomposition`");
      expect(content).toContain("`coding-implementation`");
      expect(content).toContain("`diagnostics`");
      expect(content).toContain("`runtime-security`");
      expect(content).toContain("`documentation-change`");
      expect(content).toContain("Routing task IDs:");
      expect(content).toContain("Context-map mapping IDs:");
      expect(content).toContain("`architecture-review-host-boundaries`");
      expect(content).toContain("`runtime-host-diagnostics-triage`");
      expect(content).toContain("`runtime-security-identity-and-policy-hardening`");
      expect(content).toContain("`documentation-refactor-context-and-architecture`");
    }
  });

  it("documents story 6.3.2 task discovery status in registry guidance", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    expect(human).toContain("## Task-Oriented Discovery Paths Status (Story 6.3.2)");
    expect(ai).toContain("## Task-Oriented Discovery Paths Status (Story 6.3.2)");
    expect(human).toContain("discoveryIndex.byTaskCategory");
    expect(ai).toContain("discoveryIndex.byTaskCategory");
    expect(human).toContain("taskRoutingIndex");
    expect(ai).toContain("taskRoutingIndex");
    expect(human).toContain("task-to-context-routing.seed.json");
    expect(ai).toContain("task-to-context-routing.seed.json");
    expect(human).toContain("context-map.json");
    expect(ai).toContain("context-map.json");
  });
});
