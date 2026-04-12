import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const standardPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.md");
const standardAiPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.ai.md");

describe("story 7.1.3 documentation quality severity guardrails", () => {
  it("keeps severity levels and failure policy explicit in both standard variants", () => {
    const standard = readFileSync(standardPath, "utf8").toLowerCase();
    const standardAi = readFileSync(standardAiPath, "utf8").toLowerCase();

    for (const phrase of [
      "## rule severity levels and failure policy",
      "`critical`",
      "`important`",
      "`advisory`",
      "critical structural failures",
      "important maintainability",
      "lower-severity advisory",
      "default ci behavior",
      "blocking",
      "warning",
      "non-blocking",
      "stable rule id",
      "fail on `critical`",
      "warn on `important`",
      "report-only on `advisory`",
    ]) {
      expect(standard).toContain(phrase);
      expect(standardAi).toContain(phrase);
    }
  });

  it("keeps severity assignment pragmatic by category and avoids over-policing", () => {
    const standard = readFileSync(standardPath, "utf8").toLowerCase();
    const standardAi = readFileSync(standardAiPath, "utf8").toLowerCase();

    for (const phrase of [
      "default severity profile",
      "strictest enforcement",
      "context packs",
      "routing artifacts",
      "contributor docs",
      "operations docs",
      "warning-first",
      "historical or superseded materials",
      "false positives",
    ]) {
      expect(standard).toContain(phrase);
      expect(standardAi).toContain(phrase);
    }
  });
});
