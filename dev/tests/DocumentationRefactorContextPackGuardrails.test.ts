import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanPackPath = resolve(repoRoot, "docs/context/packs/documentation-refactor.pack.md");
const aiPackPath = resolve(repoRoot, "docs/context/packs/documentation-refactor.pack.ai.md");

const requiredHeadings = [
  "## Purpose",
  "## When To Use",
  "## When Not To Use",
  "## Invariants",
  "## Authoritative Docs",
  "## Authoritative Code Paths",
  "## Anti-Patterns",
  "## Related Packs",
] as const;

describe("documentation refactor context pack guardrails", () => {
  it("keeps documentation refactor pack artifacts present", () => {
    expect(existsSync(humanPackPath)).toBe(true);
    expect(existsSync(aiPackPath)).toBe(true);
  });

  it("keeps documentation refactor pack aligned to contract sections and docs-system constraints", () => {
    const humanPack = readFileSync(humanPackPath, "utf8");
    const aiPack = readFileSync(aiPackPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanPack).toContain(heading);
      expect(aiPack).toContain(heading);
    }

    for (const requiredPhrase of [
      "documentation-system",
      "metadata",
      "migration",
      "router",
      "one authoritative",
      "context-system-foundations",
      "repository-overview",
    ]) {
      expect(humanPack).toContain(requiredPhrase);
      expect(aiPack).toContain(requiredPhrase);
    }

    for (const authoritativePath of [
      "docs/architecture/README.md",
      "docs/documentation-migration-baseline.md",
      "docs/contributors/docs-placement-guide.md",
      "docs/contributors/docs-migration-safety-guide.md",
      "dev/scripts/validate-docs-foundation.cjs",
      "dev/tests/DocsFoundationValidationScript.test.ts",
    ]) {
      expect(humanPack).toContain(authoritativePath);
    }

    for (const authoritativePath of [
      "docs/architecture/README.ai.md",
      "docs/documentation-migration-baseline.ai.md",
      "docs/contributors/docs-placement-guide.ai.md",
      "docs/contributors/docs-migration-safety-guide.ai.md",
      "dev/scripts/validate-docs-foundation.cjs",
      "dev/tests/DocsFoundationValidationScript.test.ts",
    ]) {
      expect(aiPack).toContain(authoritativePath);
    }
  });
});
