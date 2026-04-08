import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-evaluation-seams.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-evaluation-seams.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy evaluation seams documentation", () => {
  it("keeps evaluation seam docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical seam contracts, service, and dependent feature interfaces", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyEvaluationContracts.ts");
    expect(doc).toContain("DeploymentPolicyEvaluationPorts.ts");
    expect(doc).toContain("DeploymentPolicyEvaluationService.ts");
    expect(doc).toContain("CanonicalDeploymentPolicySnapshotResolver.ts");
    expect(doc).toContain("evaluateAuthorizationPolicy");
    expect(doc).toContain("evaluateStoragePolicy");
    expect(doc).toContain("evaluateSchedulingPolicy");
    expect(doc).toContain("evaluateSecurityPolicy");
  });

  it("keeps architecture docs discoverable for evaluation seam guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-evaluation-seams.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-evaluation-seams.md");
  });

  it("keeps AI companion evaluation seam doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-evaluation-seams.md");
    expect(aiDoc).toContain("DeploymentPolicyEvaluationService.ts");
    expect(aiDoc).toContain("CanonicalDeploymentPolicySnapshotResolver.ts");
  });
});
