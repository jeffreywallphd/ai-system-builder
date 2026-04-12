import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const bootstrapDocPath = path.resolve(repoRoot, "docs", "secret-bootstrap-and-migration-operations.md");
const bootstrapAiDocPath = path.resolve(repoRoot, "docs", "secret-bootstrap-and-migration-operations.ai.md");
const diagnosticsDocPath = path.resolve(repoRoot, "docs", "secret-health-and-operational-diagnostics.md");
const diagnosticsAiDocPath = path.resolve(repoRoot, "docs", "secret-health-and-operational-diagnostics.ai.md");
const contributorDocPath = path.resolve(repoRoot, "docs", "secret-backed-feature-contributor-guide.md");
const contributorAiDocPath = path.resolve(repoRoot, "docs", "secret-backed-feature-contributor-guide.ai.md");

describe("story 3.4.4 secret hardening documentation guardrails", () => {
  it("keeps bootstrap runbook aligned to hardened startup and migration behavior", () => {
    const doc = readFileSync(bootstrapDocPath, "utf8");

    for (const expected of [
      "AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS",
      "AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV",
      "AI_LOOM_SECRET_MASTER_KEY_ID",
      "AI_LOOM_SECRET_MASTER_KEY",
      "required-secret-missing",
      "required-secret-unusable",
      "bootstrap-creation-failed",
      "Extension guidance",
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it("keeps diagnostics runbook aligned to health state and security-material interpretation", () => {
    const doc = readFileSync(diagnosticsDocPath, "utf8");

    for (const expected of [
      "GET /api/v1/security/secrets/health",
      "GET /api/v1/security/secrets/diagnostics",
      "healthFlags",
      "securityMaterial",
      "fallbackModeActive",
      "non-compliant",
      "metadata-only",
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it("keeps contributor guide explicit about adding new consumers and provider backends", () => {
    const doc = readFileSync(contributorDocPath, "utf8");

    for (const expected of [
      "## Adding a new secret consumer",
      "## Adding a new provider backend",
      "ISecretProviderMaterialResolutionPort",
      "DefaultSecretProviderResolutionService",
      "production-capable startup",
      "diagnostics",
      "redaction",
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it("keeps ai companions linked to their canonical docs", () => {
    const bootstrapAi = readFileSync(bootstrapAiDocPath, "utf8");
    const diagnosticsAi = readFileSync(diagnosticsAiDocPath, "utf8");
    const contributorAi = readFileSync(contributorAiDocPath, "utf8");

    expect(bootstrapAi).toContain("docs/secret-bootstrap-and-migration-operations.md");
    expect(diagnosticsAi).toContain("docs/secret-health-and-operational-diagnostics.md");
    expect(contributorAi).toContain("docs/secret-backed-feature-contributor-guide.md");
  });
});
