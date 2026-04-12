import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-taxonomy-registry.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-taxonomy-registry.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy taxonomy registry documentation", () => {
  it("keeps taxonomy registry docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical deployment policy taxonomy registry modules", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts");
    expect(doc).toContain("createCanonicalDeploymentPolicyConfigurationRegistry");
    expect(doc).toContain("validateDeploymentPolicySettingValue");
    expect(doc).toContain("profileDefaults");
  });

  it("keeps architecture docs discoverable for deployment policy taxonomy registry", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-taxonomy-registry.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-taxonomy-registry.md");
  });

  it("keeps AI companion taxonomy registry doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-taxonomy-registry.md");
    expect(aiDoc).toContain("DeploymentProfilePolicyAdministrationDomain.ts");
    expect(aiDoc).toContain("createCanonicalDeploymentPolicyConfigurationRegistry");
  });
});
