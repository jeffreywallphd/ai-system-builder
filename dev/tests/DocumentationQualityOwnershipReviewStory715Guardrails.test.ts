import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 7.1.5 documentation quality ownership and review guardrails", () => {
  it("keeps ownership, manual review, and lint interpretation guidance explicit in both variants", () => {
    const human = read("docs/context/governance/documentation-quality-standard.md").toLowerCase();
    const ai = read("docs/context/governance/documentation-quality-standard.ai.md").toLowerCase();

    for (const content of [human, ai]) {
      expect(content).toContain("## ownership and review responsibilities (story 7.1.5)");
      expect(content).toContain("ownership model by documentation category");
      expect(content).toContain("manual review triggers (automation complements, not replacements)");
      expect(content).toContain("interpreting lint and validation failures");
      expect(content).toContain("high-risk areas requiring additional scrutiny");
      expect(content).toContain("how this fits normal repository maintenance");

      for (const phrase of [
        "architecture docs",
        "adr records",
        "context packs and routing artifacts",
        "contributor and operations docs",
        "baseline and historical",
        "critical",
        "important",
        "advisory",
        "merge-blocking",
        "warning-level",
        "at least one additional qualified reviewer",
        "semantic correctness",
      ]) {
        expect(content).toContain(phrase);
      }
    }
  });

  it("keeps ownership/review section enforced by foundation validation and contributor guide context", () => {
    const validator = read("dev/scripts/validate-docs-foundation.cjs");
    const contributorGuide = read("docs/contributors/docs-foundation-validation.md").toLowerCase();
    const contributorGuideAi = read("docs/contributors/docs-foundation-validation.ai.md").toLowerCase();

    expect(validator).toContain("## Ownership and Review Responsibilities (Story 7.1.5)");
    expect(contributorGuide).toContain("ownership/review responsibilities");
    expect(contributorGuideAi).toContain("ownership/review responsibilities");
  });
});
