import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const standardPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.md");
const standardAiPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.ai.md");

describe("story 7.1.4 readability and signal-to-noise boundary guardrails", () => {
  it("keeps explicit readability boundary section and measurable boundary IDs in both variants", () => {
    const standard = readFileSync(standardPath, "utf8");
    const standardAi = readFileSync(standardAiPath, "utf8");

    for (const required of [
      "## Readability and Signal-to-Noise Enforcement Boundaries",
      "READ-001",
      "READ-002",
      "READ-003",
      "READ-004",
      "READ-005",
      "READ-006",
      "required heading anchors",
      "at or below 500 words",
      "at or below 900 words",
      "status labeling markers",
      "mixed authority/history anti-pattern",
      "catch-all",
    ]) {
      expect(standard.toLowerCase()).toContain(required.toLowerCase());
      expect(standardAi.toLowerCase()).toContain(required.toLowerCase());
    }
  });

  it("keeps subjective prose quality checks out of blocking automation scope", () => {
    const standard = readFileSync(standardPath, "utf8").toLowerCase();
    const standardAi = readFileSync(standardAiPath, "utf8").toLowerCase();

    for (const phrase of [
      "out of scope for automated enforcement",
      "subjective",
      "tone",
      "prose",
      "reviewable now, lintable later",
    ]) {
      expect(standard).toContain(phrase);
      expect(standardAi).toContain(phrase);
    }
  });
});
