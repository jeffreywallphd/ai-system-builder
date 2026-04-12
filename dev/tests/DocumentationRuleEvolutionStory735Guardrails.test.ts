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

describe("story 7.3.5 docs quality rule evolution guidance guardrails", () => {
  it("keeps rule-evolution guide docs present and discoverable from contributor and governance routers", () => {
    const guideMd = "docs/contributors/documentation-quality-rule-evolution-guide.md";
    const guideAi = "docs/contributors/documentation-quality-rule-evolution-guide.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const governanceReadme = read("docs/context/governance/README.md");
    const governanceReadmeAi = read("docs/context/governance/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-quality-rule-evolution-guide.md");
    expect(contributorsReadmeAi).toContain("./documentation-quality-rule-evolution-guide.ai.md");
    expect(governanceReadme).toContain("../contributors/documentation-quality-rule-evolution-guide.md");
    expect(governanceReadmeAi).toContain("../contributors/documentation-quality-rule-evolution-guide.ai.md");
  });

  it("keeps warning-first rollout, legacy handling, and enforcement communication guidance explicit", () => {
    const human = read("docs/contributors/documentation-quality-rule-evolution-guide.md").toLowerCase();
    const ai = read("docs/contributors/documentation-quality-rule-evolution-guide.ai.md").toLowerCase();

    for (const content of [human, ai]) {
      for (const phrase of [
        "rule evolution lifecycle",
        "warning-first",
        "legacy documentation handling",
        "enforcement change communication checklist",
        "--strict-important",
        "untouched legacy docs",
        "touch policy",
        "blocking",
      ]) {
        expect(content).toContain(phrase);
      }
    }
  });

  it("keeps canonical standards and contributor run/fix docs aligned to rule-evolution guidance", () => {
    const standard = read("docs/context/governance/documentation-quality-standard.md").toLowerCase();
    const standardAi = read("docs/context/governance/documentation-quality-standard.ai.md").toLowerCase();
    const runFix = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md");
    const runFixAi = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md");
    const standardsGuide = read("docs/contributors/documentation-quality-enforced-standards-guide.md");
    const standardsGuideAi = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md");

    for (const content of [standard, standardAi]) {
      expect(content).toContain("rule evolution and contributor stability");
      expect(content).toContain("warning-first");
      expect(content).toContain("legacy");
      expect(content).toContain("communication requirements");
    }

    for (const content of [runFix, runFixAi, standardsGuide, standardsGuideAi]) {
      expect(content).toContain("documentation-quality-rule-evolution-guide");
    }
  });

  it("keeps the new guide indexed in documentation registry discovery metadata", () => {
    const recordId = "doc-contributors-documentation-quality-rule-evolution-guide";
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entry = registry.entries.find((candidate) => candidate.recordId === recordId);

    expect(entry).toBeDefined();
    expect(entry?.path).toBe("docs/contributors/documentation-quality-rule-evolution-guide.md");
    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toContain(recordId);
    expect(registry.discoveryIndex.byDomain.contributors).toContain(recordId);
    expect(registry.discoveryIndex.byStatus.active).toContain(recordId);
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toContain(recordId);
    expect(registry.discoveryIndex.byTaskCategory["documentation-change"]).toContain(recordId);
  });
});
