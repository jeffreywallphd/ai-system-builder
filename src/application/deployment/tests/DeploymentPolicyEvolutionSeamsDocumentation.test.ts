import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-evolution-seams-and-neutrality-safeguards.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "deployment-profile-policy-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy evolution seams documentation", () => {
  it("keeps evolution-seam docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents configurable fallback seams and neutrality safeguards", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyBootstrapResolutionService.ts");
    expect(doc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
    expect(doc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
    expect(doc).toContain("fallbackProfileId");
    expect(doc).toContain("defaultProfileId");
    expect(doc).toContain("No policy family is added as a placeholder");
  });

  it("keeps architecture docs discoverable for evolution-seam guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md");
  });

  it("keeps contributor guidance aligned with evolution-seam safeguards", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(contributorDoc).toContain("deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md");
    expect(contributorDoc).toContain("fallbackProfileId");
    expect(contributorAiDoc).toContain("docs/architecture/deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md");
  });

  it("keeps AI companion evolution-seam doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md");
    expect(aiDoc).toContain("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts");
    expect(aiDoc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
  });
});
