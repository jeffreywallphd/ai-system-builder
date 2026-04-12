import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-explainability-and-impact-summaries.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-explainability-and-impact-summaries.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy explainability documentation", () => {
  it("keeps explainability docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical explainability metadata and admin projection surfaces", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentProfilePolicyAdministrationDomain.ts");
    expect(doc).toContain("DeploymentPolicyReadContracts.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationPage.tsx");
    expect(doc).toContain("governance-sensitive");
    expect(doc).toContain("foundational");
  });

  it("keeps architecture docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-explainability-and-impact-summaries.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-explainability-and-impact-summaries.md");
  });

  it("keeps contributor guidance aligned with explainability metadata baseline", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-explainability-and-impact-summaries.md");
    expect(contributorDoc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-explainability-and-impact-summaries.md");
    expect(contributorAiDoc).toContain("DeploymentPolicyAdministrationPage.tsx");
  });

  it("keeps AI companion doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-explainability-and-impact-summaries.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationReadModel.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationPage.tsx");
  });
});
