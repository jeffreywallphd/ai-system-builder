import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-persistence-api-integration-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-persistence-api-integration-baseline.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment policy persistence/api integration baseline documentation", () => {
  it("keeps integrated architecture docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents bootstrap, read/write, validation, audit, and feature-consumption seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(doc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
    expect(doc).toContain("IDeploymentPolicyPersistenceRepository.ts");
    expect(doc).toContain("DeploymentPolicyReadBackendApi.ts");
    expect(doc).toContain("DeploymentPolicyWriteBackendApi.ts");
    expect(doc).toContain("DeploymentPolicyGovernanceEventPorts.ts");
    expect(doc).toContain("AuthoritativeDeploymentPolicyGovernanceEventSink.ts");
    expect(doc).toContain("IDeployment*PolicyEvaluationPort");
    expect(doc).toContain("Intentionally deferred integrations and current limits");
    expect(doc).toContain("platform:default");
  });

  it("keeps architecture docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-persistence-api-integration-baseline.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-persistence-api-integration-baseline.md");
    expect(architectureReadme).toContain("deployment-profile-policy-audit-operational-governance-hooks.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-audit-operational-governance-hooks.md");
  });

  it("keeps contributor guidance aligned with integration baseline expectations", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-persistence-api-integration-baseline.md");
    expect(contributorDoc).toContain("## Server/bootstrap and API integration expectations");
    expect(contributorDoc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(contributorDoc).toContain("DeploymentPolicyGovernanceEventPorts.ts");
    expect(contributorDoc).toContain("Current limits that should remain explicit in feature work");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md");
    expect(contributorAiDoc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
  });

  it("keeps AI companion baseline doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
    expect(aiDoc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(aiDoc).toContain("IDeployment*PolicyEvaluationPort");
  });
});
