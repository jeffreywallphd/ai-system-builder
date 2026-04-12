import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const inventoryDocPath = path.resolve(
  repoRoot,
  "docs",
  "architecture",
  "security-critical-runtime-material-inventory.md",
);
const inventoryAiDocPath = path.resolve(
  repoRoot,
  "docs",
  "architecture",
  "security-critical-runtime-material-inventory.ai.md",
);
const architectureReadmePath = path.resolve(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.resolve(repoRoot, "docs", "architecture", "README.ai.md");

describe("story 3.1.1+3.4.4 security-critical runtime material inventory guardrails", () => {
  it("keeps canonical and ai inventory docs checked in", () => {
    expect(existsSync(inventoryDocPath)).toBeTrue();
    expect(existsSync(inventoryAiDocPath)).toBeTrue();
  });

  it("documents hardened material classes, startup expectations, provider architecture, and extension guidance", () => {
    const doc = readFileSync(inventoryDocPath, "utf8");

    expect(doc).toContain("## Required Material Classes");
    expect(doc).toContain("## Startup Configuration Expectations");
    expect(doc).toContain("## Provider Architecture and Scope Resolution");
    expect(doc).toContain("## Lifecycle and Rotation Behavior");
    expect(doc).toContain("## Diagnostics and Readiness Interpretation");
    expect(doc).toContain("## Development and Test Profile Allowances");
    expect(doc).toContain("## Extension Guide: New Secret Consumers");
    expect(doc).toContain("## Extension Guide: New Provider Backends");

    for (const requiredPhrase of [
      "server",
      "workspace",
      "user",
      "AI_LOOM_SECRET_MASTER_KEY_ID",
      "AI_LOOM_SECRET_MASTER_KEY",
      "AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS",
      "ISecretProviderMaterialResolutionPort",
      "GET /api/v1/security/secrets/health",
      "GET /api/v1/security/secrets/diagnostics",
    ]) {
      expect(doc).toContain(requiredPhrase);
    }
  });

  it("does not regress to obsolete random fallback framing in canonical inventory guidance", () => {
    const doc = readFileSync(inventoryDocPath, "utf8");

    expect(doc).not.toContain("Ambiguous and Duplicated Resolution Paths");
    expect(doc).not.toContain("asset-download-grant:${randomUUID()}");
    expect(doc).not.toContain("explicit -> AI_LOOM_SECRET_MASTER_KEY -> random generated hash");
  });

  it("keeps architecture routers discoverable for the inventory document", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const aiReadme = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("security-critical-runtime-material-inventory.md");
    expect(aiReadme).toContain("security-critical-runtime-material-inventory.md");
  });

  it("keeps ai companion inventory aligned to hardened canonical guidance", () => {
    const aiDoc = readFileSync(inventoryAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/security-critical-runtime-material-inventory.md");
    expect(aiDoc).toContain("hardened");
    expect(aiDoc).toContain("scope-routed");
    expect(aiDoc).toContain("Obsolete random runtime fallback references were removed");
  });
});
