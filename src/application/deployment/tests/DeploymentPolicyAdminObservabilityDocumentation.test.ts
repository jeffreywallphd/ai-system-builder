import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-observability-redaction-and-failure-handling.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-admin-observability-redaction-and-failure-handling.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy admin observability documentation", () => {
  it("keeps observability docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical observability, redaction, and failure-handling seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyAdministrationObservabilityPorts.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
    expect(doc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(doc).toContain("DeploymentPolicyReadBackendApi.ts");
    expect(doc).toContain("DeploymentPolicyWriteBackendApi.ts");
    expect(doc).toContain("PlatformDeploymentPolicyAdministrationObservabilityPort.ts");
    expect(doc).toContain("redacted");
    expect(doc).toContain("correlation");
  });

  it("keeps architecture docs discoverable from architecture indexes", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-admin-observability-redaction-and-failure-handling.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-admin-observability-redaction-and-failure-handling.md");
  });

  it("keeps contributor guidance aligned with observability baseline", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-admin-observability-redaction-and-failure-handling.md");
    expect(contributorDoc).toContain("DeploymentPolicyAdministrationObservabilityPorts.ts");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-admin-observability-redaction-and-failure-handling.md");
  });

  it("keeps AI companion doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-admin-observability-redaction-and-failure-handling.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationObservabilityPorts.ts");
    expect(aiDoc).toContain("DeploymentPolicyReadBackendApi.ts");
  });
});
