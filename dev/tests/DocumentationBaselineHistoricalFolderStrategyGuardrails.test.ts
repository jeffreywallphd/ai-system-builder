import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const strategyPath = resolve(repoRoot, "docs/context/documentation-baseline-and-historical-folder-strategy.md");
const strategyAiPath = resolve(repoRoot, "docs/context/documentation-baseline-and-historical-folder-strategy.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");
const baselinesReadmePath = resolve(repoRoot, "docs/baselines/README.md");
const baselinesAiReadmePath = resolve(repoRoot, "docs/baselines/README.ai.md");
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const placementGuideAiPath = resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md");

const requiredBaselineDestinations = [
  "docs/baselines/",
  "docs/baselines/architecture/",
  "docs/baselines/contributors/",
  "docs/baselines/operations/",
  "docs/baselines/context/",
  "docs/baselines/ui/",
  "docs/baselines/cross-cutting/",
] as const;

describe("documentation baseline and historical folder strategy guardrails", () => {
  it("keeps human and AI strategy docs present", () => {
    expect(existsSync(strategyPath)).toBe(true);
    expect(existsSync(strategyAiPath)).toBe(true);
  });

  it("documents explicit historical landing zones and narrow non-baseline destinations", () => {
    const strategy = readFileSync(strategyPath, "utf8");
    const strategyAi = readFileSync(strategyAiPath, "utf8");

    expect(strategy).toContain("## Target Destinations for Baseline and Historical Material");
    expect(strategy).toContain("## Narrowly Justified Non-Baseline Destinations");
    expect(strategy).toContain("## Baselines Versus Superseded Pointer Notes");
    expect(strategy).toContain("## Migration Landing Zone Rules");

    expect(strategyAi).toContain("## Target Baseline Destinations");
    expect(strategyAi).toContain("## Narrowly Justified Non-Baseline Destinations");
    expect(strategyAi).toContain("## Baseline vs Pointer Decision");
    expect(strategyAi).toContain("## Migration Landing Zone Rules");

    for (const destination of requiredBaselineDestinations) {
      expect(strategy).toContain(destination);
      expect(strategyAi).toContain(destination);
    }

    for (const anchor of [
      "docs/adr/records/",
      "superseded_by",
      "short superseded pointer",
      "documentation-supersession-and-redirect-conventions.md",
    ]) {
      expect(strategy).toContain(anchor);
    }

    for (const anchor of [
      "docs/adr/records/",
      "superseded_by",
      "short superseded pointer",
      "documentation-supersession-and-redirect-conventions.ai.md",
    ]) {
      expect(strategyAi).toContain(anchor);
    }
  });

  it("keeps context and baselines routers linked to the strategy", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");
    const baselinesReadme = readFileSync(baselinesReadmePath, "utf8");
    const baselinesAiReadme = readFileSync(baselinesAiReadmePath, "utf8");

    expect(contextReadme).toContain("./documentation-baseline-and-historical-folder-strategy.md");
    expect(contextAiReadme).toContain("./documentation-baseline-and-historical-folder-strategy.ai.md");
    expect(baselinesReadme).toContain("../context/documentation-baseline-and-historical-folder-strategy.md");
    expect(baselinesAiReadme).toContain("../context/documentation-baseline-and-historical-folder-strategy.ai.md");
  });

  it("keeps placement guidance linked to historical isolation strategy", () => {
    const placementGuide = readFileSync(placementGuidePath, "utf8");
    const placementGuideAi = readFileSync(placementGuideAiPath, "utf8");

    expect(placementGuide).toContain("documentation-baseline-and-historical-folder-strategy.md");
    expect(placementGuide).toContain("Historical Isolation Target Destinations");
    expect(placementGuideAi).toContain("documentation-baseline-and-historical-folder-strategy.ai.md");
    expect(placementGuideAi).toContain("## Historical Isolation Target Destinations");
  });
});
