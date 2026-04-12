import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-shared-contracts.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-shared-contracts.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy shared contracts documentation", () => {
  it("keeps shared contract docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical shared deployment policy contract modules", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("src/shared/contracts/deployment/DeploymentPolicyAdministrationContracts.ts");
    expect(doc).toContain("src/shared/dto/deployment/DeploymentPolicyAdministrationDtos.ts");
    expect(doc).toContain("src/shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationSnapshot");
    expect(doc).toContain("UpdateDeploymentPolicyAdministrationRequest");
  });

  it("keeps architecture docs discoverable for shared deployment policy contracts", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-shared-contracts.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-shared-contracts.md");
  });

  it("keeps AI companion deployment shared-contract doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-shared-contracts.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationContracts.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationSchemaContracts.ts");
  });
});
