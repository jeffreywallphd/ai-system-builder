import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("unified API endpoint reference documentation guardrails", () => {
  it("keeps endpoint reference discoverable and traceable across route families", () => {
    const endpointReference = readProjectFile("docs/architecture/unified-api-endpoint-reference.md");

    const requiredTokens = [
      "AuthoritativeApiRouteRegistrationCatalog.ts",
      "IdentityAuthoritativeApiRoutes.ts",
      "WorkspaceAuthoritativeApiRoutes.ts",
      "AuthorizationAuthoritativeApiRoutes.ts",
      "NodeTrustAuthoritativeApiRoutes.ts",
      "SecurityAuthoritativeApiRoutes.ts",
      "StorageAuthoritativeApiRoutes.ts",
      "AssetAuthoritativeApiRoutes.ts",
      "RuntimeAuthoritativeApiRoutes.ts",
      "IdentityAuthBackendApi.ts",
      "WorkspaceAdministrationBackendApi.ts",
      "AuthorizationManagementBackendApi.ts",
      "NodeTrustBackendApi.ts",
      "SecretMetadataBackendApi.ts",
      "StorageManagementBackendApi.ts",
      "AssetManagementBackendApi.ts",
      "SystemRuntimeBackendApi.ts",
    ] as const;

    for (const token of requiredTokens) {
      expect(endpointReference).toContain(token);
    }
  });

  it("documents canonical runtime realtime event topics and shared-client examples", () => {
    const endpointReference = readProjectFile("docs/architecture/unified-api-endpoint-reference.md");

    const requiredTokens = [
      "runtime.run.status",
      "runtime.queue",
      "runtime.connectivity",
      "runtime.admin",
      "runtime-realtime.subscribe",
      "runtime-realtime.event",
      "HttpIdentityAuthClient",
      "HttpWorkspaceAdministrationClient",
      "HttpRuntimeControlClient",
      "SharedApiClient",
    ] as const;

    for (const token of requiredTokens) {
      expect(endpointReference).toContain(token);
    }
  });

  it("keeps contributor and architecture indexes linked to the endpoint reference", () => {
    const contributorGuide = readProjectFile("docs/unified-api-contributor-guide.md");
    const architectureReadme = readProjectFile("docs/architecture/README.md");
    const aiCompanion = readProjectFile("docs/architecture/unified-api-endpoint-reference.ai.md");

    expect(contributorGuide).toContain("docs/architecture/unified-api-endpoint-reference.md");
    expect(architectureReadme).toContain("unified-api-endpoint-reference.md");
    expect(aiCompanion).toContain("docs/architecture/unified-api-endpoint-reference.md");
  });
});
