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

describe("story 7.4.2 docs quality exceptions and escape hatches guidance guardrails", () => {
  it("keeps exceptions guide docs present and routed from contributor and governance routers", () => {
    const guideMd = "docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.md";
    const guideAi = "docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const governanceReadme = read("docs/context/governance/README.md");
    const governanceReadmeAi = read("docs/context/governance/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-quality-exceptions-and-escape-hatches-guide.md");
    expect(contributorsReadmeAi).toContain("./documentation-quality-exceptions-and-escape-hatches-guide.ai.md");
    expect(governanceReadme).toContain("../contributors/documentation-quality-exceptions-and-escape-hatches-guide.md");
    expect(governanceReadmeAi).toContain("../contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md");
  });

  it("keeps narrow legitimate-case, required-record, and anti-abuse guidance explicit", () => {
    const human = read("docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.md").toLowerCase();
    const ai = read("docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md").toLowerCase();

    for (const content of [human, ai]) {
      for (const phrase of [
        "legitimate exception cases",
        "external contract mismatch",
        "security or legal constraint",
        "transitional migration constraint",
        "non-legitimate uses",
        "required exception record",
        "rule_ids",
        "paths",
        "expiry_or_review_date",
        "anti-abuse guardrails",
        "directory-wide",
        "repeated renewals",
      ]) {
        expect(content).toContain(phrase);
      }
    }
  });

  it("keeps canonical standards and contributor workflows aligned to the exceptions model", () => {
    const standard = read("docs/context/governance/documentation-quality-standard.md").toLowerCase();
    const standardAi = read("docs/context/governance/documentation-quality-standard.ai.md").toLowerCase();
    const standardsGuide = read("docs/contributors/documentation-quality-enforced-standards-guide.md");
    const standardsGuideAi = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md");
    const runFix = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md");
    const runFixAi = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md");

    for (const content of [standard, standardAi]) {
      expect(content).toContain("exceptions and escape hatch policy");
      expect(content).toContain("story 7.4.2");
      expect(content).toContain("no wildcard");
      expect(content).toContain("repeated renewals");
    }

    for (const content of [standardsGuide, standardsGuideAi, runFix, runFixAi]) {
      expect(content).toContain("documentation-quality-exceptions-and-escape-hatches-guide");
    }
  });

  it("keeps exceptions guide indexed in documentation registry discovery metadata", () => {
    const recordId = "doc-contributors-documentation-quality-exceptions-and-escape-hatches-guide";
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entry = registry.entries.find((candidate) => candidate.recordId === recordId);

    expect(entry).toBeDefined();
    expect(entry?.path).toBe("docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.md");
    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toContain(recordId);
    expect(registry.discoveryIndex.byDomain.contributors).toContain(recordId);
    expect(registry.discoveryIndex.byStatus.active).toContain(recordId);
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toContain(recordId);
    expect(registry.discoveryIndex.byTaskCategory["documentation-change"]).toContain(recordId);
  });
});
