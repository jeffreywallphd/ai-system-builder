import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-ui-read-models.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-ui-read-models.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy admin ui/read-model documentation", () => {
  it("keeps admin ui/read-model docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical admin projection, service, page, and route wiring files", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationReadService.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationPage.tsx");
    expect(doc).toContain("RouteConfig.ts");
    expect(doc).toContain("SurfaceRouteMetadataCatalog.ts");
    expect(doc).toContain("/api/v1/deployment/policy/state");
  });

  it("keeps architecture docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-admin-ui-read-models.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-admin-ui-read-models.md");
  });

  it("keeps contributor guidance aligned with admin ui/read-model baseline", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-admin-ui-read-models.md");
    expect(contributorDoc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(contributorDoc).toContain("DeploymentPolicyAdministrationReadService.ts");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-admin-ui-read-models.md");
    expect(contributorAiDoc).toContain("DeploymentPolicyAdministrationPage.tsx");
  });

  it("keeps AI companion doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-admin-ui-read-models.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationReadService.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationPage.tsx");
  });
});
