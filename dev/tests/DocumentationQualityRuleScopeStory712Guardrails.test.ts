import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const standardPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.md");
const standardAiPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.ai.md");

const requiredHeadings = [
  "## Documentation Category Rule Scope Matrix",
  "## Category-Specific Enforcement Boundaries",
] as const;

const requiredCategoryPhrases = [
  "architecture docs",
  "adr records",
  "context packs",
  "routing artifacts",
  "contributor docs",
  "operations docs",
  "baselines",
  "historical or superseded",
] as const;

describe("story 7.1.2 documentation quality rule scope guardrails", () => {
  it("maps documentation categories to enforcement scope in both standard variants", () => {
    const standard = readFileSync(standardPath, "utf8");
    const standardAi = readFileSync(standardAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(standard).toContain(heading);
      expect(standardAi).toContain(heading);
    }

    for (const phrase of requiredCategoryPhrases) {
      expect(standard.toLowerCase()).toContain(phrase);
      expect(standardAi.toLowerCase()).toContain(phrase);
    }
  });

  it("defines stricter enforcement for context/routing and reduced scope for archival docs", () => {
    const standard = readFileSync(standardPath, "utf8").toLowerCase();
    const standardAi = readFileSync(standardAiPath, "utf8").toLowerCase();

    for (const phrase of [
      "strictest enforcement",
      "routing",
      "context packs",
      "reduced enforcement",
      "false positives",
      "supersession",
      "redirect",
    ]) {
      expect(standard).toContain(phrase);
      expect(standardAi).toContain(phrase);
    }
  });
});
