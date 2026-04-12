import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 5.4.3 baseline and historical review expectations guardrails", () => {
  it("keeps review expectations documented in contributor and context guidance for human and ai paths", () => {
    const paths = [
      "docs/contributors/baseline-and-historical-material-usage-guide.md",
      "docs/contributors/baseline-and-historical-material-usage-guide.ai.md",
      "docs/context/documentation-baseline-and-historical-folder-strategy.md",
      "docs/context/documentation-baseline-and-historical-folder-strategy.ai.md",
    ] as const;

    for (const relativePath of paths) {
      expect(existsSync(resolve(repoRoot, relativePath))).toBe(true);
      const content = read(relativePath);
      expect(content).toContain("Story 5.4.3");
      expect(content).toContain("Ongoing Review");
      expect(content).toContain("superseded");
      expect(content).toContain("docs/baselines/");
    }
  });

  it("keeps stable-by-default archival maintenance boundaries and explicit update triggers", () => {
    const humanContributorGuide = read("docs/contributors/baseline-and-historical-material-usage-guide.md");
    const aiContributorGuide = read("docs/contributors/baseline-and-historical-material-usage-guide.ai.md");
    const humanStrategy = read("docs/context/documentation-baseline-and-historical-folder-strategy.md");
    const aiStrategy = read("docs/context/documentation-baseline-and-historical-folder-strategy.ai.md");

    for (const content of [humanContributorGuide, aiContributorGuide, humanStrategy, aiStrategy]) {
      expect(content).toContain("stable");
      expect(content).toContain("point-in-time");
      expect(content).toContain("non-authoritative");
      expect(content).toContain("metadata");
      expect(content).toContain("link");
      expect(content).toContain("redaction");
      expect(content).toContain("compliance");
    }
  });

  it("keeps anti-dumping and newly-superseded handling explicit so archival areas stay isolated", () => {
    const humanContributorGuide = read("docs/contributors/baseline-and-historical-material-usage-guide.md");
    const aiContributorGuide = read("docs/contributors/baseline-and-historical-material-usage-guide.ai.md");
    const humanStrategy = read("docs/context/documentation-baseline-and-historical-folder-strategy.md");
    const aiStrategy = read("docs/context/documentation-baseline-and-historical-folder-strategy.ai.md");

    for (const content of [humanContributorGuide, aiContributorGuide, humanStrategy, aiStrategy]) {
      expect(content).toContain("newly superseded");
      expect(content).toContain("superseded pointer");
      expect(content).toContain("retention reason");
      expect(content).toContain("traceability");
      expect(content).toContain("parity");
      expect(content).toContain("active");
      expect(content).toContain("draft");
    }
  });
});
