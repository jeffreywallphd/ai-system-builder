import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const inventoryJsonPath = resolve(
  repoRoot,
  "docs/architecture/architecture-domain-migration-inventory.inventory.json",
);
const inventoryMdPath = resolve(repoRoot, "docs/architecture/architecture-domain-migration-inventory.md");
const inventoryAiMdPath = resolve(repoRoot, "docs/architecture/architecture-domain-migration-inventory.ai.md");
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");

const requiredDomains = [
  "core-platform-and-composition",
  "runtime-host-surfaces",
  "identity-trust-and-security",
  "workspace-storage-and-assets",
  "execution-control-plane-and-scheduling",
  "studio-and-system-composition",
  "api-and-transport-surfaces",
  "deployment-policy-and-audit-governance",
] as const;

const requiredRoles = ["overview", "reference", "adr-linked-support", "historical-baseline"] as const;

describe("architecture domain migration inventory guardrails", () => {
  it("keeps migration inventory artifacts present and discoverable from architecture routers", () => {
    expect(existsSync(inventoryJsonPath)).toBe(true);
    expect(existsSync(inventoryMdPath)).toBe(true);
    expect(existsSync(inventoryAiMdPath)).toBe(true);

    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");

    expect(architectureReadme).toContain("./architecture-domain-migration-inventory.md");
    expect(architectureAiReadme).toContain("./architecture-domain-migration-inventory.md");
  });

  it("keeps required inventory sections in human and AI variants", () => {
    const humanDoc = readFileSync(inventoryMdPath, "utf8");
    const aiDoc = readFileSync(inventoryAiMdPath, "utf8");

    for (const heading of [
      "## Inventory Summary",
      "## Foundational Anchors",
      "## Migration Mapping Table",
      "## Mixed-Content Split Targets",
      "## Historical/Baseline Destinations",
      "## Migration Execution Notes",
    ] as const) {
      expect(humanDoc).toContain(heading);
      expect(aiDoc).toContain(heading);
    }

    for (const signal of [
      "domain-and-application-core.md",
      "desktop-runtime-and-hosts.md",
      "shared-asset-contracts.md",
      "workflow-execution-and-tools.md",
      "docs/baselines/architecture/",
      "architecture-domain-migration-inventory.inventory.json",
    ] as const) {
      expect(humanDoc).toContain(signal);
      expect(aiDoc).toContain(signal);
    }
  });

  it("keeps machine-readable mapping coverage across target domains, roles, and mixed-content hotspots", () => {
    const inventory = JSON.parse(readFileSync(inventoryJsonPath, "utf8"));

    expect(inventory.story).toBe("4.2.1");
    expect(Array.isArray(inventory.mappings)).toBe(true);
    expect(inventory.mappings.length).toBeGreaterThan(10);
    expect(Array.isArray(inventory.mixedContentProblems)).toBe(true);
    expect(inventory.mixedContentProblems.length).toBeGreaterThanOrEqual(5);

    const coveredDomains = new Set<string>();
    const usedRoles = new Set<string>();
    for (const mapping of inventory.mappings) {
      coveredDomains.add(mapping.targetDomain);
      usedRoles.add(mapping.targetRole);
      expect(Array.isArray(mapping.sourcePatterns)).toBe(true);
      expect(mapping.sourcePatterns.length).toBeGreaterThan(0);
      expect(Array.isArray(mapping.targetPaths)).toBe(true);
      expect(mapping.targetPaths.length).toBeGreaterThan(0);
      expect(typeof mapping.splitRequired).toBe("boolean");
      expect(typeof mapping.historicalBaseline).toBe("boolean");
    }

    for (const domainId of requiredDomains) {
      expect(inventory.targetDomains.includes(domainId)).toBe(true);
      expect(coveredDomains.has(domainId)).toBe(true);
    }

    for (const role of requiredRoles) {
      expect(inventory.targetRoles.includes(role)).toBe(true);
      expect(usedRoles.has(role)).toBe(true);
    }

    const mixedIds = new Set(inventory.mixedContentProblems.map((entry: { id: string }) => entry.id));
    for (const requiredMixedId of [
      "mix-001-domain-and-application-core",
      "mix-002-presentation-and-state",
      "mix-003-shared-asset-contracts",
      "mix-004-workflow-execution-and-tools",
      "mix-005-desktop-runtime-and-hosts",
    ] as const) {
      expect(mixedIds.has(requiredMixedId)).toBe(true);
    }
  });
});

