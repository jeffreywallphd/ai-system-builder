import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-safe-update-workflows.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-safe-update-workflows.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy admin safe-update workflow documentation", () => {
  it("keeps admin safe-update docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical page, read-model, and write-service seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyAdministrationPage.tsx");
    expect(doc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationWriteService.ts");
    expect(doc).toContain("DeploymentPolicyWriteContracts.ts");
    expect(doc).toContain("DeploymentPolicyWriteSchemaContracts.ts");
    expect(doc).toContain("editable");
    expect(doc).toContain("inspect-only");
    expect(doc).toContain("unsupported");
  });

  it("keeps architecture docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-admin-safe-update-workflows.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-admin-safe-update-workflows.md");
  });

  it("keeps contributor guidance aligned with admin safe-update baseline", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-admin-safe-update-workflows.md");
    expect(contributorDoc).toContain("DeploymentPolicyAdministrationWriteService.ts");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-admin-safe-update-workflows.md");
    expect(contributorAiDoc).toContain("DeploymentPolicyAdministrationWriteService.ts");
  });

  it("keeps AI companion doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-admin-safe-update-workflows.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationWriteService.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationPage.tsx");
  });
});
