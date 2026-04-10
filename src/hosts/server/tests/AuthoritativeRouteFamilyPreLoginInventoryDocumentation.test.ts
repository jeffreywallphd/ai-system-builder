import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuthoritativeServerRequiredRouteFamilyIds } from "../AuthoritativeServerApiRouteComposition";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "authoritative-route-family-pre-login-inventory.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "authoritative-route-family-pre-login-inventory.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("authoritative route family pre-login inventory documentation", () => {
  it("keeps inventory docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("classifies every currently startup-required route family and system-runtime", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    for (const routeFamilyId of AuthoritativeServerRequiredRouteFamilyIds) {
      expect(doc).toContain(`\`${routeFamilyId}\``);
    }
    expect(doc).toContain("`system-runtime`");
    expect(doc).toContain("required before login");
    expect(doc).toContain("optional/on-demand");
    expect(doc).toContain("not relevant to the desktop pre-login path");
    expect(doc).toContain("identity-auth");
  });

  it("keeps architecture docs discoverable for auth-minimal route planning", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("authoritative-route-family-pre-login-inventory.md");
    expect(architectureReadmeAi).toContain("authoritative-route-family-pre-login-inventory.md");
  });

  it("keeps AI companion inventory doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/authoritative-route-family-pre-login-inventory.md");
    expect(aiDoc).toContain("AuthoritativeServerRequiredRouteFamilyIds");
    expect(aiDoc).toContain("identity-auth");
  });
});
