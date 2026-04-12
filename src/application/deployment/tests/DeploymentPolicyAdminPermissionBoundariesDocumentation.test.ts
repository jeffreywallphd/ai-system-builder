import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-permission-boundaries.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-permission-boundaries.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy admin permission-boundary documentation", () => {
  it("keeps permission-boundary docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical read/write permission and route-boundary seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
    expect(doc).toContain("WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.ts");
    expect(doc).toContain("deployment-policy.state.read");
    expect(doc).toContain("DeploymentPolicyAdministrationPage.tsx");
    expect(doc).toContain("AdminLiteEntryPage.tsx");
  });

  it("keeps architecture docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-admin-permission-boundaries.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-admin-permission-boundaries.md");
  });

  it("keeps contributor guidance aligned with permission-boundary baseline", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-admin-permission-boundaries.md");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-admin-permission-boundaries.md");
  });

  it("keeps AI companion doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-admin-permission-boundaries.md");
    expect(aiDoc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationPage.tsx");
  });
});
