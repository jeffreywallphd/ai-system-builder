import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-regression-hardening-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-regression-hardening-baseline.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorGuidePath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorGuideAiPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");

describe("deployment policy regression hardening baseline documentation", () => {
  it("keeps human and AI companion baseline docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents final hardening coverage, invariants, and deferred edges", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 20.3.7");
    expect(doc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(doc).toContain("DeploymentPolicyReadBackendApi.ts");
    expect(doc).toContain("DeploymentPolicyWriteBackendApi.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationRegressionLifecycle.integration.test.ts");
    expect(doc).toContain("Hardened invariants verified by regression coverage");
    expect(doc).toContain("Final implemented scope and explicit deferred edges");
  });

  it("keeps architecture indexes aligned with the regression hardening baseline doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("deployment-profile-policy-regression-hardening-baseline.md");
    expect(readmeAi).toContain("deployment-profile-policy-regression-hardening-baseline.md");
  });

  it("keeps contributor workflow docs aligned with regression baseline expectations", () => {
    const contributor = readFileSync(contributorGuidePath, "utf8");
    const contributorAi = readFileSync(contributorGuideAiPath, "utf8");

    expect(contributor).toContain("deployment-profile-policy-regression-hardening-baseline.md");
    expect(contributor).toContain("DeploymentPolicyAdministrationRegressionLifecycle.integration.test.ts");
    expect(contributorAi).toContain("deployment-profile-policy-regression-hardening-baseline.md");
    expect(contributorAi).toContain("DeploymentPolicyAdministrationRegressionLifecycle.integration.test.ts");
  });

  it("keeps AI companion hardening baseline doc anchored to canonical seams", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/deployment-profile-policy-regression-hardening-baseline.md");
    expect(doc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(doc).toContain("DeploymentPolicyWriteBackendApi.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationRegressionLifecycle.integration.test.ts");
  });
});
