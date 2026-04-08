import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-invariants-and-extension-rules.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-invariants-and-extension-rules.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy invariant and extension documentation", () => {
  it("keeps architecture and contributor docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
    expect(existsSync(contributorDocPath)).toBeTrue();
    expect(existsSync(contributorAiDocPath)).toBeTrue();
  });

  it("documents deployment profile philosophy, policy families, effective resolution, and prohibited patterns", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## Deployment profile philosophy");
    expect(doc).toContain("## Supported policy families");
    expect(doc).toContain("## Preset-versus-override model");
    expect(doc).toContain("## Effective-value resolution invariants");
    expect(doc).toContain("## Extension rules");
    expect(doc).toContain("## Evaluation boundary and prohibited patterns");
    expect(doc).toContain("Embedding profile-specific branching directly in UI components is prohibited.");
    expect(doc).toContain("Embedding profile-specific branching directly in transport handlers is prohibited.");
    expect(doc).toContain("Embedding profile-specific branching directly in backend adapters is prohibited.");
    expect(doc).toContain("IDeploymentStoragePolicyEvaluationPort");
    expect(doc).toContain("resolveDeploymentPolicyEffectiveState(...)");
  });

  it("documents contributor extension workflow and policy-decision request guidance", () => {
    const doc = readFileSync(contributorDocPath, "utf8");

    expect(doc).toContain("## Required implementation path");
    expect(doc).toContain("## Adding a new policy family");
    expect(doc).toContain("## Adding a new policy decision API for a feature");
    expect(doc).toContain("## Prohibited patterns");
    expect(doc).toContain("Request policy decisions through `IDeployment*PolicyEvaluationPort` interfaces.");
    expect(doc).toContain("Embedding profile-specific branching directly in UI components is prohibited.");
  });

  it("keeps docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-invariants-and-extension-rules.md");
    expect(architectureReadme).toContain("../deployment-profile-policy-contributor-guide.md");
    expect(architectureReadmeAi).toContain("docs/architecture/deployment-profile-policy-invariants-and-extension-rules.md");
    expect(architectureReadmeAi).toContain("docs/deployment-profile-policy-contributor-guide.md");
  });

  it("references canonical implemented seams for taxonomy, resolution, and feature policy evaluation", () => {
    const requiredSeams = [
      "src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts",
      "src/application/deployment/DeploymentPolicyAdministrationContracts.ts",
      "src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts",
      "src/application/policy-administration/DeploymentPolicyEvaluationContracts.ts",
      "src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts",
      "src/application/policy-administration/DeploymentPolicyEvaluationService.ts",
      "src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts",
      "src/shared/contracts/deployment/DeploymentPolicyAdministrationContracts.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps AI companion docs aligned to canonical human docs", () => {
    const architectureAiDoc = readFileSync(architectureAiDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureAiDoc).toContain("docs/architecture/deployment-profile-policy-invariants-and-extension-rules.md");
    expect(architectureAiDoc).toContain("DeploymentPolicyEvaluationService.ts");
    expect(contributorAiDoc).toContain("docs/deployment-profile-policy-contributor-guide.md");
    expect(contributorAiDoc).toContain("IDeployment*PolicyEvaluationPort");
  });
});
