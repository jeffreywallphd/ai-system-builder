import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR-005 trust, identity, and security boundary enforcement record", () => {
  const humanAdrPath =
    "docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md";
  const aiAdrPath =
    "docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md";

  it("keeps required ADR metadata and section contract in both variants", () => {
    for (const path of [humanAdrPath, aiAdrPath]) {
      const doc = read(path);

      const requiredMetadataTokens = [
        "title: ADR-005 Trust, Identity, and Security Boundary Enforcement",
        "doc_type: adr",
        "status: active",
        "authoritativeness: canonical",
        "adr_number: 005",
        "decision_status: accepted",
        "decision_date: 2026-04-11",
      ] as const;

      const requiredSectionHeadings = [
        "## Status",
        "## Decision Date",
        "## Decision Statement",
        "## Context and Problem Statement",
        "## Decision Drivers",
        "## Considered Options",
        "## Chosen Approach",
        "## Consequences",
        "## Related Documentation",
        "## Related Code Paths",
      ] as const;

      for (const token of requiredMetadataTokens) {
        expect(doc).toContain(token);
      }
      for (const heading of requiredSectionHeadings) {
        expect(doc).toContain(heading);
      }
    }
  });

  it("captures security-boundary implications for authentication, authorization, transport trust, auditability, and runtime/service interaction", () => {
    const humanAdr = read(humanAdrPath).toLowerCase();
    const aiAdr = read(aiAdrPath).toLowerCase();

    for (const doc of [humanAdr, aiAdr]) {
      expect(doc).toContain("authentication");
      expect(doc).toContain("authorization");
      expect(doc).toContain("transport trust");
      expect(doc).toContain("auditability");
      expect(doc).toContain("runtime/service interaction");
      expect(doc).toContain("high-risk implication");
      expect(doc).toContain("fail-closed");
      expect(doc).toContain("rejected");
    }
  });

  it("is indexed in ADR records and linked from security architecture/context references", () => {
    const recordsReadme = read("docs/adr/records/README.md");
    const recordsReadmeAi = read("docs/adr/records/README.ai.md");
    const transportSecurityDoc = read("docs/architecture/transport-security-foundation.md");
    const transportSecurityDocAi = read("docs/architecture/transport-security-foundation.ai.md");
    const authorizationPatternsDoc = read("docs/architecture/authorization-enforcement-integration-patterns.md");
    const authorizationPatternsDocAi = read("docs/architecture/authorization-enforcement-integration-patterns.ai.md");
    const authStartupDoc = read("docs/architecture/auth-only-server-startup-contract.md");
    const authStartupDocAi = read("docs/architecture/auth-only-server-startup-contract.ai.md");
    const identitySecurityPack = read("docs/context/packs/identity-and-security.pack.md");
    const identitySecurityPackAi = read("docs/context/packs/identity-and-security.pack.ai.md");

    expect(recordsReadme).toContain(
      "adr-005-trust-identity-and-security-boundary-enforcement.md",
    );
    expect(recordsReadmeAi).toContain(
      "adr-005-trust-identity-and-security-boundary-enforcement.ai.md",
    );

    for (const doc of [
      transportSecurityDoc,
      authorizationPatternsDoc,
      authStartupDoc,
    ]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain(
        "adr-005-trust-identity-and-security-boundary-enforcement.md",
      );
    }

    for (const doc of [
      transportSecurityDocAi,
      authorizationPatternsDocAi,
      authStartupDocAi,
    ]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain(
        "adr-005-trust-identity-and-security-boundary-enforcement.ai.md",
      );
    }

    expect(identitySecurityPack).toContain(
      "adr-005-trust-identity-and-security-boundary-enforcement.md",
    );
    expect(identitySecurityPackAi).toContain(
      "adr-005-trust-identity-and-security-boundary-enforcement.ai.md",
    );
  });
});
