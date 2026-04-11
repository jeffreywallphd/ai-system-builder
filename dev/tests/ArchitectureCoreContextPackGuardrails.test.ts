import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanPackPath = resolve(repoRoot, "docs/context/packs/architecture-core.pack.md");
const aiPackPath = resolve(repoRoot, "docs/context/packs/architecture-core.pack.ai.md");

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

describe("architecture core context pack guardrails", () => {
  it("keeps architecture core pack artifacts present", () => {
    expect(existsSync(humanPackPath)).toBe(true);
    expect(existsSync(aiPackPath)).toBe(true);
  });

  it("keeps architecture core pack aligned to required sections and core architecture signals", () => {
    const humanPack = readFileSync(humanPackPath, "utf8");
    const aiPack = readFileSync(aiPackPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanPack).toContain(heading);
      expect(aiPack).toContain(heading);
    }

    for (const requiredPhrase of [
      "architecture-first",
      "domain -> application -> infrastructure/hosts/ui integration",
      "control-plane authority",
      "Anti-Patterns",
      "context-system-foundations",
      "repository-overview",
    ]) {
      expect(humanPack).toContain(requiredPhrase);
      expect(aiPack).toContain(requiredPhrase);
    }

    for (const authoritativePath of [
      "docs/architecture/README.md",
      "docs/architecture/architecture-document-scope-boundaries.md",
      "docs/adr/records/adr-001-single-authoritative-control-plane.md",
      "docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md",
      "docs/architecture/layers-and-boundaries.md",
      "docs/architecture/authoritative-server-host-assembly.md",
      "src/domain",
      "src/application",
      "src/hosts",
    ]) {
      expect(humanPack).toContain(authoritativePath);
    }

    for (const authoritativePath of [
      "docs/architecture/README.ai.md",
      "docs/architecture/architecture-document-scope-boundaries.ai.md",
      "docs/adr/records/adr-001-single-authoritative-control-plane.ai.md",
      "docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md",
      "docs/architecture/layers-and-boundaries.ai.md",
      "docs/architecture/authoritative-server-host-assembly.ai.md",
      "src/domain",
      "src/application",
      "src/hosts",
    ]) {
      expect(aiPack).toContain(authoritativePath);
    }
  });
});
