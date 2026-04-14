import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("story 2.3.3 authorization diagnostics documentation guardrails", () => {
  it("documents contributor extension workflow for canonical diagnostics and regression proof", () => {
    const contributorGuide = read("docs/unified-api-contributor-guide.md");
    const contributorGuideAi = read("docs/unified-api-contributor-guide.ai.md");

    for (const content of [contributorGuide, contributorGuideAi]) {
      expect(content).toContain("Authorization diagnostics extension workflow");
      expect(content).toContain("src/shared/contracts/authorization/AuthorizationDiagnosticsContracts.ts");
      expect(content).toContain("src/shared/contracts/authorization/AuthorizationDiagnosticCatalogs.ts");
      expect(content).toContain("src/application/authorization/use-cases/AuthorizationDecisionDiagnostics.ts");
      expect(content).toContain("projectAuthorizationDiagnosticRecord(...)");
      expect(content).toContain("AuthorizationRuntimeContextDriftRegression.test.ts");
    }
  });

  it("documents operator denial triage with correlation, reason, provenance, and redaction boundaries", () => {
    const observabilityGuide = read("docs/unified-api-observability-troubleshooting.md");
    const observabilityGuideAi = read("docs/unified-api-observability-troubleshooting.ai.md");

    for (const content of [observabilityGuide, observabilityGuideAi]) {
      expect(content).toContain("Authorization denial triage flow");
      expect(content).toContain("AuthorizationTransportPolicyGuard.ts");
      expect(content).toContain("AuthorizationTransportAdapters.ts");
      expect(content).toContain("AuthorizationPolicyDecisionEvaluator.ts");
      expect(content).toContain("error.correlationId");
      expect(content).toContain("permission-snapshot");
      expect(content).toContain("scope-filtering");
      expect(content).toContain("evaluator-resolution");
      expect(content).toContain("final-decision-emission");
      expect(content).toContain("adapter-failure");
      expect(content).toContain("transport-mapping");
      expect(content).toContain(".public");
      expect(content).toContain(":public");
    }
  });

  it("routes authorization diagnostics context through prompt routing and identity/security pack guidance", () => {
    const promptRouting = read("docs/context/prompt-routing.md");
    const promptRoutingAi = read("docs/context/prompt-routing.ai.md");
    const identityPack = read("docs/context/packs/identity-and-security.pack.md");
    const identityPackAi = read("docs/context/packs/identity-and-security.pack.ai.md");

    for (const content of [promptRouting, promptRoutingAi]) {
      const normalized = content.toLowerCase();
      expect(normalized).toContain("authorization diagnostics interpretation/extension");
      expect(normalized).toContain("docs/architecture/authorization-enforcement-integration-patterns.md");
      expect(normalized).toContain("docs/unified-api-observability-troubleshooting.md");
    }

    for (const content of [identityPack, identityPackAi]) {
      const normalized = content.toLowerCase();
      expect(normalized).toContain("authorization diagnostics");
      expect(normalized).toContain("docs/unified-api-observability-troubleshooting");
    }
  });
});
