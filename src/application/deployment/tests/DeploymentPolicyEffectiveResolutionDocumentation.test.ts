import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-effective-resolution-and-overrides.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-effective-resolution-and-overrides.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile effective policy resolution documentation", () => {
  it("keeps effective-resolution docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical effective-resolution modules and validation behavior", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyEffectiveResolutionService.ts");
    expect(doc).toContain("resolveDeploymentPolicyEffectiveState");
    expect(doc).toContain("validateDeploymentPolicyAdminOverrideRecords");
    expect(doc).toContain("override-scope-mismatch");
  });

  it("keeps architecture docs discoverable for effective policy resolution", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-effective-resolution-and-overrides.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-effective-resolution-and-overrides.md");
  });

  it("keeps AI companion effective-resolution doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-effective-resolution-and-overrides.md");
    expect(aiDoc).toContain("DeploymentPolicyEffectiveResolutionService.ts");
    expect(aiDoc).toContain("resolveDeploymentPolicyEffectiveState");
  });
});
