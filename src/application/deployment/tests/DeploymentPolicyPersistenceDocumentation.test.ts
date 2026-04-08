import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-persistence-and-repositories.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-persistence-and-repositories.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy persistence documentation", () => {
  it("keeps persistence docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical repository, dto, and sqlite persistence files", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("IDeploymentPolicyPersistenceRepository.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationPersistenceDtos.ts");
    expect(doc).toContain("SqliteDeploymentPolicyPersistenceAdapter.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
    expect(doc).toContain("deployment_policy_override_history");
  });

  it("keeps architecture docs discoverable for deployment policy persistence", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-persistence-and-repositories.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-persistence-and-repositories.md");
  });

  it("keeps AI companion persistence doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-persistence-and-repositories.md");
    expect(aiDoc).toContain("IDeploymentPolicyPersistenceRepository.ts");
    expect(aiDoc).toContain("SqliteDeploymentPolicyPersistenceAdapter.ts");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
  });
});

