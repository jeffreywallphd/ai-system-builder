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

describe("story 7.3.4 documentation quality worked examples guardrails", () => {
  it("keeps quality worked example guides present and routed from contributor and architecture routers", () => {
    const guideMd = "docs/contributors/documentation-quality-worked-examples.md";
    const guideAi = "docs/contributors/documentation-quality-worked-examples.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const architectureReadme = read("docs/architecture/README.md");
    const architectureReadmeAi = read("docs/architecture/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-quality-worked-examples.md");
    expect(contributorsReadmeAi).toContain("./documentation-quality-worked-examples.ai.md");
    expect(architectureReadme).toContain("../contributors/documentation-quality-worked-examples.md");
    expect(architectureReadmeAi).toContain("../contributors/documentation-quality-worked-examples.ai.md");
  });

  it("keeps worked examples scoped to enforced pass/fail patterns across core documentation asset types", () => {
    const human = read("docs/contributors/documentation-quality-worked-examples.md");
    const ai = read("docs/contributors/documentation-quality-worked-examples.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("## Worked Examples");
      expect(content).toContain("### Example 1: Architecture Domain");
      expect(content).toContain("### Example 2: ADR Records");
      expect(content).toContain("### Example 3: Context Packs");
      expect(content).toContain("### Example 4: Routing Assets");
      expect(content).toContain("### Example 5: Documentation Registry Entries");
      expect(content).toContain("### Example 6: Baseline/Historical Documentation Boundaries");
      expect(content).toContain("Passing pattern:");
      expect(content).toContain("Failing pattern:");
      expect(content).toContain("Likely validator signals:");
      expect(content).toContain("Fix move:");

      for (const phrase of [
        "architecture",
        "adr",
        "context pack",
        "task-to-context-routing.seed.json",
        "documentation-registry.seed.json",
        "baseline",
        "historical",
        "relatedDocRecordIds",
        "active",
        "canonical",
        "superseded",
      ]) {
        expect(content.toLowerCase()).toContain(phrase);
      }
    }
  });

  it("keeps standards and run/fix guidance cross-linked to worked examples and registry discovery metadata", () => {
    const standardsHuman = read("docs/contributors/documentation-quality-enforced-standards-guide.md");
    const standardsAi = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md");
    const runFixHuman = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md");
    const runFixAi = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md");

    for (const content of [standardsHuman, standardsAi, runFixHuman, runFixAi]) {
      expect(content).toContain("documentation-quality-worked-examples");
    }

    const recordId = "doc-contributors-documentation-quality-worked-examples";
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entry = registry.entries.find((candidate) => candidate.recordId === recordId);

    expect(entry).toBeDefined();
    expect(entry?.path).toBe("docs/contributors/documentation-quality-worked-examples.md");
    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toContain(recordId);
    expect(registry.discoveryIndex.byDomain.contributors).toContain(recordId);
    expect(registry.discoveryIndex.byStatus.active).toContain(recordId);
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toContain(recordId);
    expect(registry.discoveryIndex.byTaskCategory["documentation-change"]).toContain(recordId);
  });
});
