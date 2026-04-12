import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const diagnosticsDocPath = path.resolve(repoRoot, "docs", "secret-health-and-operational-diagnostics.md");
const diagnosticsAiDocPath = path.resolve(repoRoot, "docs", "secret-health-and-operational-diagnostics.ai.md");
const bootstrapDocPath = path.resolve(repoRoot, "docs", "secret-bootstrap-and-migration-operations.md");
const contributorDocPath = path.resolve(repoRoot, "docs", "secret-backed-feature-contributor-guide.md");

describe("story 3.4.5 development-only allowance governance guardrails", () => {
  it("keeps diagnostics docs explicit about governance assertions and enforcement states", () => {
    const doc = readFileSync(diagnosticsDocPath, "utf8");

    for (const expected of [
      "governanceAssertions",
      "ephemeral-bootstrap-material",
      "relaxed-validation-mode",
      "conditional-provider-backend",
      "`warning`",
      "`blocked`",
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it("keeps bootstrap and contributor guides explicit about development-only allowance governance", () => {
    const bootstrapDoc = readFileSync(bootstrapDocPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");

    expect(bootstrapDoc).toContain("governance assertions");
    expect(bootstrapDoc).toContain("production-policy violations");
    expect(contributorDoc).toContain("development-only allowances");
    expect(contributorDoc).toContain("governance assertions");
  });

  it("keeps diagnostics ai companion linked to canonical diagnostics doc", () => {
    const aiDoc = readFileSync(diagnosticsAiDocPath, "utf8");
    expect(aiDoc).toContain("docs/secret-health-and-operational-diagnostics.md");
  });
});

