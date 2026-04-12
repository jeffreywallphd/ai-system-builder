import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const moduleMapDocPath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md",
);
const moduleMapAiDocPath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.ai.md",
);
const referencesReadmePath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/README.md",
);
const referencesReadmeAiPath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/README.ai.md",
);

describe("HTTP transport modularization module map documentation guardrails", () => {
  it("keeps human and AI module-map docs checked in", () => {
    expect(existsSync(moduleMapDocPath)).toBeTrue();
    expect(existsSync(moduleMapAiDocPath)).toBeTrue();
  });

  it("keeps the module map aligned with story scope requirements", () => {
    const doc = readFileSync(moduleMapDocPath, "utf8");

    const requiredSections = [
      "Final Module Layout",
      "Route-Family Registry Model",
      "Middleware Composition Rules",
      "DTO Mapping Seams",
      "Upgrade Boundary Separation",
      "Contributor Workflow: Add or Modify a Route Family",
      "Testing and Verification Expectations",
      "Boundary Rules",
    ] as const;
    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }

    const requiredRouteFamilyTokens = [
      "`identity-auth`",
      "`workspace-invitations`",
      "`workspace-administration`",
      "`authorization-management`",
      "`storage-management`",
      "`run-submission`",
      "`run-read`",
      "`run-mutation`",
      "`run-execution-update`",
      "`system-runtime`",
    ] as const;
    for (const token of requiredRouteFamilyTokens) {
      expect(doc).toContain(token);
    }

    const requiredCompositionOrderTokens = [
      "resolveRequestCorrelationId",
      "setResponseCorrelationHeaders",
      "evaluateApiCorsRequest",
      "enforceApiSecureTransport",
      "requireAuthenticatedSession",
      "requireAuthenticatedWorkspaceSession",
      "requireAuthenticatedNodeTransport",
      "normalizeSharedApiErrorEnvelope",
      "correlation injection",
    ] as const;
    for (const token of requiredCompositionOrderTokens) {
      expect(doc).toContain(token);
    }

    const requiredWorkflowTokens = [
      "AuthoritativeApiRouteRegistrationCatalog.ts",
      "AuthoritativeIdentityRouteFamilyModules.ts",
      "defaultRouteFamilyHandlers",
      "AuthoritativeServerApiRouteComposition.ts",
      "do not push transport mapping into application/domain",
    ] as const;
    for (const token of requiredWorkflowTokens) {
      expect(doc).toContain(token);
    }

    expect(doc).not.toContain("legacyInlineRouteFamilyIds");
    expect(doc).not.toContain("hybrid posture");
    expect(doc).not.toContain("legacy fallback");

    const requiredTestingTokens = [
      "AuthoritativeApiRouteRegistrationCatalog.test.ts",
      "IdentityHttpTransportComposition.test.ts",
      "IdentityHttpServer.test.ts",
      "IdentityHttpServerRouteParityRegression.test.ts",
      "AuthoritativeServerStartupHarness.test.ts",
      "HttpTransportModularizationMaintainabilityGuardrails.test.ts",
      "HttpTransportModularizationModuleMapDocumentation.test.ts",
    ] as const;
    for (const token of requiredTestingTokens) {
      expect(doc).toContain(token);
    }
  });

  it("keeps the module map discoverable from API/transport references indexes", () => {
    const readme = readFileSync(referencesReadmePath, "utf8");
    const readmeAi = readFileSync(referencesReadmeAiPath, "utf8");

    expect(readme).toContain("http-transport-modularization-module-map.md");
    expect(readmeAi).toContain("http-transport-modularization-module-map.md");
  });
});
