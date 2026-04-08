import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-authoritative-write-apis.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "deployment-profile-policy-authoritative-write-apis.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("deployment profile policy authoritative write api documentation", () => {
  it("keeps write api docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical write contracts, backend API, permission service, and transport wiring", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("DeploymentPolicyWriteContracts.ts");
    expect(doc).toContain("DeploymentPolicyWriteSchemaContracts.ts");
    expect(doc).toContain("DeploymentPolicyWriteBackendApi.ts");
    expect(doc).toContain("WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.ts");
    expect(doc).toContain("IdentityHttpServer.ts");
    expect(doc).toContain("/api/v1/deployment/policy/active-profile");
    expect(doc).toContain("/api/v1/deployment/policy/overrides");
  });

  it("keeps architecture docs discoverable for authoritative write APIs", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("deployment-profile-policy-authoritative-write-apis.md");
    expect(architectureReadmeAi).toContain("deployment-profile-policy-authoritative-write-apis.md");
  });

  it("keeps AI companion write api doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/deployment-profile-policy-authoritative-write-apis.md");
    expect(aiDoc).toContain("DeploymentPolicyWriteBackendApi.ts");
    expect(aiDoc).toContain("IdentityHttpServer.ts");
  });
});
