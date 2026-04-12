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

describe("story 7.4.4 docs quality rollout boundaries and follow-on opportunities guardrails", () => {
  it("keeps rollout-boundaries guide docs present and routed from contributor and governance routers", () => {
    const guideMd =
      "docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md";
    const guideAi =
      "docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const governanceReadme = read("docs/context/governance/README.md");
    const governanceReadmeAi = read("docs/context/governance/README.ai.md");

    expect(contributorsReadme).toContain(
      "./documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md",
    );
    expect(contributorsReadmeAi).toContain(
      "./documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.ai.md",
    );
    expect(governanceReadme).toContain(
      "../contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md",
    );
    expect(governanceReadmeAi).toContain(
      "../contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.ai.md",
    );
  });

  it("keeps rollout coverage, explicit limits, and follow-on opportunities clear", () => {
    const human = read(
      "docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md",
    ).toLowerCase();
    const ai = read(
      "docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.ai.md",
    ).toLowerCase();

    for (const content of [human, ai]) {
      for (const phrase of [
        "initial rollout coverage",
        "explicit rollout boundaries",
        "known limits",
        "follow-on opportunities",
        "broader automation coverage",
        "richer linting",
        "deeper documentation-system integration",
        "critical",
        "important",
        "advisory",
        "story 7.4.4",
        "materially complete",
        "out of scope here",
      ]) {
        expect(content).toContain(phrase);
      }
    }
  });

  it("keeps standards and contributor docs aligned to rollout-boundary guidance", () => {
    const standard = read("docs/context/governance/documentation-quality-standard.md").toLowerCase();
    const standardAi = read("docs/context/governance/documentation-quality-standard.ai.md").toLowerCase();

    for (const content of [standard, standardAi]) {
      expect(content).toContain("story 7.4.4");
      expect(content).toContain("rollout boundaries");
      expect(content).toContain("documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide");
    }

    for (const content of [
      read("docs/contributors/documentation-quality-enforced-standards-guide.md"),
      read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md"),
      read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md"),
      read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md"),
      read("docs/contributors/documentation-quality-rule-evolution-guide.md"),
      read("docs/contributors/documentation-quality-rule-evolution-guide.ai.md"),
      read("docs/contributors/documentation-quality-tooling-maintenance-guide.md"),
      read("docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md"),
      read("docs/contributors/documentation-quality-monitoring-and-feedback-guide.md"),
      read("docs/contributors/documentation-quality-monitoring-and-feedback-guide.ai.md"),
      read("docs/context/documentation-index.md"),
      read("docs/context/documentation-index.ai.md"),
    ]) {
      expect(content).toContain("documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide");
    }
  });

  it("keeps rollout-boundaries guide indexed in documentation registry discovery metadata", () => {
    const recordId =
      "doc-contributors-documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide";
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entry = registry.entries.find((candidate) => candidate.recordId === recordId);

    expect(entry).toBeDefined();
    expect(entry?.path).toBe(
      "docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md",
    );
    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toContain(recordId);
    expect(registry.discoveryIndex.byDomain.contributors).toContain(recordId);
    expect(registry.discoveryIndex.byStatus.active).toContain(recordId);
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toContain(recordId);
    expect(registry.discoveryIndex.byTaskCategory["documentation-change"]).toContain(recordId);
  });
});
