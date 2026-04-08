import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-preset-definitions.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-preset-definitions.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy preset definitions documentation", () => {
  it("keeps preset-definition docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical preset-definition modules and explainable profile differences", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("createCanonicalDeploymentProfilePresetDefinitions");
    expect(doc).toContain("createCanonicalDeploymentProfilePresetCatalog");
    expect(doc).toContain("home");
    expect(doc).toContain("classroom");
    expect(doc).toContain("organization");
  });

  it("keeps architecture docs discoverable for deployment profile preset definitions", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-preset-definitions.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-preset-definitions.md");
  });

  it("keeps AI companion preset-definition doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-preset-definitions.md");
    expect(aiDoc).toContain("createCanonicalDeploymentProfilePresetDefinitions");
    expect(aiDoc).toContain("DeploymentProfilePolicyAdministrationDomain.ts");
  });
});
