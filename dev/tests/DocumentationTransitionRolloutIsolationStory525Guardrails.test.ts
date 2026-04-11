import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const legacyPaths = {
  md: "docs/architecture/unified-api-convergence-plan.md",
  ai: "docs/architecture/unified-api-convergence-plan.ai.md",
} as const;

const baselinePaths = {
  md: "docs/baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.md",
  ai: "docs/baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.ai.md",
} as const;

describe("story 5.2.5 transition and rollout note isolation guardrails", () => {
  it("moves transition-era convergence notes into baseline destinations and keeps legacy path stubs", () => {
    expect(existsSync(resolve(repoRoot, baselinePaths.md))).toBe(true);
    expect(existsSync(resolve(repoRoot, baselinePaths.ai))).toBe(true);
    expect(existsSync(resolve(repoRoot, legacyPaths.md))).toBe(true);
    expect(existsSync(resolve(repoRoot, legacyPaths.ai))).toBe(true);

    const legacyMd = readFileSync(resolve(repoRoot, legacyPaths.md), "utf8");
    const legacyAi = readFileSync(resolve(repoRoot, legacyPaths.ai), "utf8");
    const baselineMd = readFileSync(resolve(repoRoot, baselinePaths.md), "utf8");
    const baselineAi = readFileSync(resolve(repoRoot, baselinePaths.ai), "utf8");

    expect(legacyMd).toContain("status: superseded");
    expect(legacyAi).toContain("status: superseded");
    expect(legacyMd).toContain("## Supersession Notice");
    expect(legacyAi).toContain("## Supersession Notice");
    expect(legacyMd).toContain("## Redirect");
    expect(legacyAi).toContain("## Redirect");
    expect(legacyMd).toContain("migrated-link-stub");
    expect(legacyAi).toContain("migrated-link-stub");
    expect(legacyMd).toContain(baselinePaths.md);
    expect(legacyAi).toContain(baselinePaths.ai);

    expect(baselineMd).toContain("## Baseline introduction");
    expect(baselineAi).toContain("## Baseline Introduction");
    expect(baselineMd).toContain("Historical handling note");
    expect(baselineAi).toContain("Historical handling note");
  });

  it("keeps transition baseline discoverable from baseline routers and active api domain overviews", () => {
    const baselinesRoot = readFileSync(resolve(repoRoot, "docs/baselines/README.md"), "utf8");
    const baselinesRootAi = readFileSync(resolve(repoRoot, "docs/baselines/README.ai.md"), "utf8");
    const architectureBaselines = readFileSync(
      resolve(repoRoot, "docs/baselines/architecture/README.md"),
      "utf8",
    );
    const architectureBaselinesAi = readFileSync(
      resolve(repoRoot, "docs/baselines/architecture/README.ai.md"),
      "utf8",
    );
    const apiOverview = readFileSync(
      resolve(repoRoot, "docs/architecture/domains/api-and-transport-surfaces/overview.md"),
      "utf8",
    );
    const apiOverviewAi = readFileSync(
      resolve(repoRoot, "docs/architecture/domains/api-and-transport-surfaces/overview.ai.md"),
      "utf8",
    );

    expect(baselinesRoot).toContain("./architecture/api-and-transport-surfaces/unified-api-convergence-plan.md");
    expect(baselinesRootAi).toContain(
      "./architecture/api-and-transport-surfaces/unified-api-convergence-plan.ai.md",
    );
    expect(architectureBaselines).toContain("./api-and-transport-surfaces/unified-api-convergence-plan.md");
    expect(architectureBaselinesAi).toContain(
      "./api-and-transport-surfaces/unified-api-convergence-plan.ai.md",
    );
    expect(apiOverview).toContain(
      "../../../baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.md",
    );
    expect(apiOverviewAi).toContain(
      "../../../baselines/architecture/api-and-transport-surfaces/unified-api-convergence-plan.ai.md",
    );
  });

  it("documents a durable handling pattern for transition and rollout notes", () => {
    const placementGuide = readFileSync(resolve(repoRoot, "docs/contributors/docs-placement-guide.md"), "utf8");
    const placementGuideAi = readFileSync(
      resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md"),
      "utf8",
    );
    const strategy = readFileSync(
      resolve(repoRoot, "docs/context/documentation-baseline-and-historical-folder-strategy.md"),
      "utf8",
    );
    const strategyAi = readFileSync(
      resolve(repoRoot, "docs/context/documentation-baseline-and-historical-folder-strategy.ai.md"),
      "utf8",
    );

    expect(placementGuide).toContain("### Transitional and Rollout Isolation Pattern");
    expect(placementGuideAi).toContain("## Transitional and Rollout Isolation Pattern");
    expect(placementGuide).toContain("docs/baselines/architecture/<domain>/");
    expect(placementGuideAi).toContain("docs/baselines/architecture/<domain>/");
    expect(strategy).toContain("## Transitional and Rollout Note Handling Pattern");
    expect(strategyAi).toContain("## Transitional and Rollout Note Handling");
  });

  it("tracks legacy convergence path supersession in architecture supersession registry", () => {
    const registry = JSON.parse(
      readFileSync(resolve(repoRoot, "docs/architecture/architecture-supersession-registry.json"), "utf8"),
    );
    const supersededSources = new Set(
      registry.supersededDocuments.map((entry: { sourcePath: string }) => entry.sourcePath),
    );

    expect(supersededSources.has("docs/architecture/unified-api-convergence-plan.md")).toBe(true);
  });
});
