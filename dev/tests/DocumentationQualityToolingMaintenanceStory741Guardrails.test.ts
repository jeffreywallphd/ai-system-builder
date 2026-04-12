import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistrySeed = {
  entries: Array<{ recordId: string; path: string }>;
  discoveryIndex: {
    byDocType: Record<string, string[]>;
    byDomain: Record<string, string[]>;
    byStatus: Record<string, string[]>;
    byAuthoritativeness: Record<string, string[]>;
    byTaskCategory: Record<string, string[]>;
  };
};

describe("story 7.4.1 docs quality tooling maintenance guidance guardrails", () => {
  it("keeps tooling maintenance guide docs present and routed from contributor and governance routers", () => {
    const guideMd = "docs/contributors/documentation-quality-tooling-maintenance-guide.md";
    const guideAi = "docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const governanceReadme = read("docs/context/governance/README.md");
    const governanceReadmeAi = read("docs/context/governance/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-quality-tooling-maintenance-guide.md");
    expect(contributorsReadmeAi).toContain("./documentation-quality-tooling-maintenance-guide.ai.md");
    expect(governanceReadme).toContain("../contributors/documentation-quality-tooling-maintenance-guide.md");
    expect(governanceReadmeAi).toContain("../contributors/documentation-quality-tooling-maintenance-guide.ai.md");
  });

  it("documents rule maintenance, validation ownership, test upkeep, and obsolete-check workflows", () => {
    const human = read("docs/contributors/documentation-quality-tooling-maintenance-guide.md").toLowerCase();
    const ai = read("docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md").toLowerCase();

    for (const content of [human, ai]) {
      for (const phrase of [
        "maintenance ownership model",
        "rule maintenance expectations",
        "validation ownership and execution cadence",
        "guardrail test upkeep expectations",
        "broken or obsolete check update workflow",
        "implementation defect",
        "policy drift",
        "intentional retirement",
        "docs:lint",
        "package.json",
        "stable rule id",
        "deprecate or replace",
      ]) {
        expect(content).toContain(phrase);
      }
    }
  });

  it("keeps standards and contributor enforcement guides aligned to maintenance expectations", () => {
    const standard = read("docs/context/governance/documentation-quality-standard.md").toLowerCase();
    const standardAi = read("docs/context/governance/documentation-quality-standard.ai.md").toLowerCase();
    const runFix = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md");
    const runFixAi = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md");
    const standardsGuide = read("docs/contributors/documentation-quality-enforced-standards-guide.md");
    const standardsGuideAi = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md");
    const ruleEvolution = read("docs/contributors/documentation-quality-rule-evolution-guide.md");
    const ruleEvolutionAi = read("docs/contributors/documentation-quality-rule-evolution-guide.ai.md");

    for (const content of [standard, standardAi]) {
      expect(content).toContain("ongoing tooling maintenance expectations");
      expect(content).toContain("story 7.4.1");
      expect(content).toContain("obsolete");
    }

    for (const content of [
      runFix,
      runFixAi,
      standardsGuide,
      standardsGuideAi,
      ruleEvolution,
      ruleEvolutionAi,
    ]) {
      expect(content).toContain("documentation-quality-tooling-maintenance-guide");
    }
  });

  it("keeps maintenance guide indexed in documentation registry discovery metadata", () => {
    const recordId = "doc-contributors-documentation-quality-tooling-maintenance-guide";
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entry = registry.entries.find((candidate) => candidate.recordId === recordId);

    expect(entry).toBeDefined();
    expect(entry?.path).toBe("docs/contributors/documentation-quality-tooling-maintenance-guide.md");
    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toContain(recordId);
    expect(registry.discoveryIndex.byDomain.contributors).toContain(recordId);
    expect(registry.discoveryIndex.byStatus.active).toContain(recordId);
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toContain(recordId);
    expect(registry.discoveryIndex.byTaskCategory["documentation-change"]).toContain(recordId);
  });
});
