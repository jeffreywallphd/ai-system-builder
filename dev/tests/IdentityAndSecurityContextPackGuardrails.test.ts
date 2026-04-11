import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanPackPath = resolve(repoRoot, "docs/context/packs/identity-and-security.pack.md");
const aiPackPath = resolve(repoRoot, "docs/context/packs/identity-and-security.pack.ai.md");

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

describe("identity and security context pack guardrails", () => {
  it("keeps identity and security pack artifacts present", () => {
    expect(existsSync(humanPackPath)).toBe(true);
    expect(existsSync(aiPackPath)).toBe(true);
  });

  it("keeps identity and security pack aligned to contract sections and security invariants", () => {
    const humanPack = readFileSync(humanPackPath, "utf8");
    const aiPack = readFileSync(aiPackPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanPack).toContain(heading);
      expect(aiPack).toContain(heading);
    }

    for (const requiredPhrase of [
      "identity",
      "authentication",
      "authorization",
      "trust",
      "deny-by-default",
      "least-privilege",
      "secrets",
      "redaction",
      "runtime-and-host",
    ]) {
      expect(humanPack).toContain(requiredPhrase);
      expect(aiPack).toContain(requiredPhrase);
    }

    for (const authoritativePath of [
      "docs/architecture/authorization-foundation.md",
      "docs/architecture/transport-security-foundation.md",
      "docs/architecture/secrets-foundation.md",
      "src/application/identity",
      "src/application/authorization",
      "src/infrastructure/security/identity",
      "src/infrastructure/transport/http-server/identity",
    ]) {
      expect(humanPack).toContain(authoritativePath);
    }

    for (const authoritativePath of [
      "docs/architecture/authorization-foundation.ai.md",
      "docs/architecture/transport-security-foundation.ai.md",
      "docs/architecture/secrets-foundation.ai.md",
      "src/application/identity",
      "src/application/authorization",
      "src/infrastructure/security/identity",
      "src/infrastructure/transport/http-server/identity",
    ]) {
      expect(aiPack).toContain(authoritativePath);
    }
  });
});
