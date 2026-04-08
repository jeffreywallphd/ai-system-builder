import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-authoritative-read-apis.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-authoritative-read-apis.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy authoritative read api documentation", () => {
  it("keeps read api docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical read contracts, use case, backend api, and transport route family", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyReadContracts.ts");
    expect(doc).toContain("DeploymentPolicyReadSchemaContracts.ts");
    expect(doc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
    expect(doc).toContain("DeploymentPolicyReadBackendApi.ts");
    expect(doc).toContain("DeploymentAuthoritativeApiRoutes.ts");
    expect(doc).toContain("/api/v1/deployment/policy/state");
  });

  it("keeps architecture docs discoverable for authoritative read APIs", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-authoritative-read-apis.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-authoritative-read-apis.md");
  });

  it("keeps AI companion read api doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-authoritative-read-apis.md");
    expect(aiDoc).toContain("ReadDeploymentPolicyAdministrationUseCase.ts");
    expect(aiDoc).toContain("DeploymentPolicyReadBackendApi.ts");
    expect(aiDoc).toContain("IdentityHttpServer.ts");
  });
});
