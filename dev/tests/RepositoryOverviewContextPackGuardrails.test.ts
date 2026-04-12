import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanPackPath = resolve(repoRoot, "docs/context/packs/repository-overview.pack.md");
const aiPackPath = resolve(repoRoot, "docs/context/packs/repository-overview.pack.ai.md");

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

describe("repository overview context pack guardrails", () => {
  it("keeps repository overview pack artifacts present", () => {
    expect(existsSync(humanPackPath)).toBe(true);
    expect(existsSync(aiPackPath)).toBe(true);
  });

  it("keeps repository overview pack aligned to contract sections and first-tier orientation goals", () => {
    const humanPack = readFileSync(humanPackPath, "utf8");
    const aiPack = readFileSync(aiPackPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanPack).toContain(heading);
      expect(aiPack).toContain(heading);
    }

    for (const requiredPhrase of [
      "first-tier orientation",
      "domain-first",
      "layered",
      "orientation only",
      "context-system-foundations",
    ]) {
      expect(humanPack).toContain(requiredPhrase);
      expect(aiPack).toContain(requiredPhrase);
    }

    for (const authoritativePath of [
      "README.md",
      "docs/adr/records/adr-001-single-authoritative-control-plane.md",
      "docs/architecture/README.md",
      "docs/context/prompt-routing.md",
      "src/domain",
      "src/application",
      "src/hosts",
    ]) {
      expect(humanPack).toContain(authoritativePath);
    }

    for (const authoritativePath of [
      "README.md",
      "docs/adr/records/adr-001-single-authoritative-control-plane.ai.md",
      "docs/architecture/README.ai.md",
      "docs/context/prompt-routing.ai.md",
      "src/domain",
      "src/application",
      "src/hosts",
    ]) {
      expect(aiPack).toContain(authoritativePath);
    }
  });
});
