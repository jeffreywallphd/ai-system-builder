import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type InventoryCandidate = {
  id: string;
  path: string;
  aiPath: string;
  category: string;
  populationClass: "authoritative-active" | "baseline-historical";
  priorityTier: "p0" | "p1" | "p2";
  likelyDomain: string;
  likelyDocType: string;
  likelyStatus: string;
  likelyAuthoritativeness: string;
  whyHighValue: string;
  populationNotes: string;
};

type PopulationPhase = {
  id: string;
  priorityTier: "p0" | "p1" | "p2";
  goal: string;
  candidateIds: string[];
};

type PopulationInventory = {
  story: string;
  scope: {
    approach: string;
    exhaustive: boolean;
    groundedIn: string[];
  };
  summary: {
    totalCandidates: number;
    priorityTierCounts: Record<"p0" | "p1" | "p2", number>;
  };
  categories: string[];
  populationClasses: string[];
  candidates: InventoryCandidate[];
  populationPhases: PopulationPhase[];
};

describe("story 6.2.1 documentation registry population inventory guardrails", () => {
  it("keeps human, AI, and machine-readable inventory artifacts present", () => {
    expect(existsSync(resolve(repoRoot, "docs/documentation-registry-population-inventory.md"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "docs/documentation-registry-population-inventory.ai.md"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "docs/documentation-registry-population-inventory.inventory.json"))).toBe(true);
  });

  it("keeps required planning sections in both markdown variants", () => {
    const human = read("docs/documentation-registry-population-inventory.md");
    const ai = read("docs/documentation-registry-population-inventory.ai.md");

    for (const heading of [
      "## Purpose",
      "## Scope",
      "## Inventory Summary",
      "## Highest-Priority Registry Population Targets",
      "## Category Coverage and Classification Notes",
      "## Recommended Population Sequence (Practical)",
      "## Deliberate Population Rules for Follow-On Stories",
    ] as const) {
      expect(human).toContain(heading);
    }

    for (const heading of [
      "## Purpose",
      "## Scope",
      "## Inventory Summary",
      "## Priority Population Anchors (Phase 1)",
      "## Classification Contract For Follow-On Entry Authoring",
      "## Recommended Population Sequence",
    ] as const) {
      expect(ai).toContain(heading);
    }

    for (const signal of [
      "docs/architecture/domain-and-application-core.md",
      "docs/contributors/docs-placement-guide.md",
      "docs/node-bootstrap-identity-operations.md",
      "docs/adr/records/adr-001-single-authoritative-control-plane.md",
      "docs/context/packs/repository-overview.pack.md",
      "documentation-registry-population-inventory.inventory.json",
    ] as const) {
      expect(human).toContain(signal);
      expect(ai).toContain(signal);
    }
  });

  it("keeps inventory discoverable from root/context routers and registry guidance", () => {
    const docsReadme = read("docs/README.md");
    const docsReadmeAi = read("docs/README.ai.md");
    const contextReadme = read("docs/context/README.md");
    const contextReadmeAi = read("docs/context/README.ai.md");
    const registrySpec = read("docs/context/documentation-registry.md");
    const registrySpecAi = read("docs/context/documentation-registry.ai.md");

    expect(docsReadme).toContain("./documentation-registry-population-inventory.md");
    expect(docsReadmeAi).toContain("./documentation-registry-population-inventory.ai.md");
    expect(contextReadme).toContain("../documentation-registry-population-inventory.md");
    expect(contextReadmeAi).toContain("../documentation-registry-population-inventory.ai.md");
    expect(registrySpec).toContain("docs/documentation-registry-population-inventory.md");
    expect(registrySpecAi).toContain("docs/documentation-registry-population-inventory.ai.md");
  });

  it("keeps machine-readable candidate metadata and phased population order", () => {
    const inventory = JSON.parse(read("docs/documentation-registry-population-inventory.inventory.json")) as PopulationInventory;

    expect(inventory.story).toBe("6.2.1");
    expect(inventory.scope.approach).toBe("high-value-first");
    expect(inventory.scope.exhaustive).toBe(false);
    expect(inventory.scope.groundedIn).toEqual(
      expect.arrayContaining([
        "docs/context/documentation-index-coverage-rules.md",
        "docs/context/documentation-registry.md",
        "docs/architecture/architecture-domain-taxonomy.md",
      ]),
    );

    expect(inventory.categories).toEqual(
      expect.arrayContaining([
        "active-architecture",
        "active-contributors",
        "active-operations",
        "adr-records",
        "context-packs",
        "baselines",
        "superseded-and-historical",
      ]),
    );
    expect(inventory.populationClasses).toEqual(
      expect.arrayContaining(["authoritative-active", "baseline-historical"]),
    );

    expect(Array.isArray(inventory.candidates)).toBe(true);
    expect(inventory.candidates.length).toBeGreaterThanOrEqual(30);
    expect(inventory.summary.totalCandidates).toBe(inventory.candidates.length);

    const ids = new Set<string>();
    let p0Count = 0;
    let p1Count = 0;
    let p2Count = 0;

    for (const candidate of inventory.candidates) {
      expect(typeof candidate.id).toBe("string");
      expect(candidate.id.startsWith("docinv-")).toBe(true);
      expect(ids.has(candidate.id)).toBe(false);
      ids.add(candidate.id);

      expect(typeof candidate.path).toBe("string");
      expect(candidate.path.startsWith("docs/")).toBe(true);
      expect(candidate.path.endsWith(".md")).toBe(true);
      expect(candidate.path.endsWith(".ai.md")).toBe(false);
      expect(existsSync(resolve(repoRoot, candidate.path))).toBe(true);

      expect(typeof candidate.aiPath).toBe("string");
      expect(candidate.aiPath.endsWith(".ai.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, candidate.aiPath))).toBe(true);

      expect(["authoritative-active", "baseline-historical"]).toContain(candidate.populationClass);
      expect(["p0", "p1", "p2"]).toContain(candidate.priorityTier);
      expect(candidate.likelyDomain.trim().length).toBeGreaterThan(0);
      expect(candidate.likelyDocType.trim().length).toBeGreaterThan(0);
      expect(candidate.likelyStatus.trim().length).toBeGreaterThan(0);
      expect(candidate.likelyAuthoritativeness.trim().length).toBeGreaterThan(0);
      expect(candidate.whyHighValue.trim().length).toBeGreaterThan(0);
      expect(candidate.populationNotes.trim().length).toBeGreaterThan(0);

      if (candidate.priorityTier === "p0") {
        p0Count += 1;
      }
      if (candidate.priorityTier === "p1") {
        p1Count += 1;
      }
      if (candidate.priorityTier === "p2") {
        p2Count += 1;
      }
    }

    expect(inventory.summary.priorityTierCounts.p0).toBe(p0Count);
    expect(inventory.summary.priorityTierCounts.p1).toBe(p1Count);
    expect(inventory.summary.priorityTierCounts.p2).toBe(p2Count);

    expect(Array.isArray(inventory.populationPhases)).toBe(true);
    expect(inventory.populationPhases.length).toBe(3);

    const phaseIds = inventory.populationPhases.map((phase) => phase.id);
    expect(phaseIds).toEqual(
      expect.arrayContaining([
        "phase-1-authority-spine",
        "phase-2-domain-and-runbook-coverage",
        "phase-3-selective-historical-traceability",
      ]),
    );

    const candidateIds = new Set(inventory.candidates.map((candidate) => candidate.id));
    for (const phase of inventory.populationPhases) {
      expect(["p0", "p1", "p2"]).toContain(phase.priorityTier);
      expect(phase.goal.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(phase.candidateIds)).toBe(true);
      expect(phase.candidateIds.length).toBeGreaterThan(0);

      for (const id of phase.candidateIds) {
        expect(candidateIds.has(id)).toBe(true);
      }
    }

    expect(ids.has("docinv-001-architecture-domain-and-application-core")).toBe(true);
    expect(ids.has("docinv-009-contributors-docs-placement-guide")).toBe(true);
    expect(ids.has("docinv-012-operations-node-bootstrap-identity")).toBe(true);
    expect(ids.has("docinv-017-adr-001-single-authoritative-control-plane")).toBe(true);
    expect(ids.has("docinv-021-context-pack-repository-overview")).toBe(true);
    expect(ids.has("docinv-027-baseline-documentation-migration-baseline")).toBe(true);
    expect(ids.has("docinv-030-superseded-presentation-and-state")).toBe(true);
  });
});
