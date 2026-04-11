import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");

type OverviewExpectation = {
  domainId: string;
  roleSignal: string;
  migratedSourceSignals: string[];
};

const overviewExpectations: OverviewExpectation[] = [
  {
    domainId: "core-platform-and-composition",
    roleSignal: "inner system model and composition contracts",
    migratedSourceSignals: [
      "domain-and-application-core.md",
      "layers-and-boundaries.md",
      "persistent-platform-domain-boundaries.md",
    ],
  },
  {
    domainId: "runtime-host-surfaces",
    roleSignal: "runtime-specific host assembly and startup lifecycle",
    migratedSourceSignals: [
      "desktop-runtime-and-hosts.md",
      "authoritative-server-host-assembly.md",
      "worker-host-assembly.md",
    ],
  },
  {
    domainId: "identity-trust-and-security",
    roleSignal: "fail-closed architecture boundaries for identity proof",
    migratedSourceSignals: [
      "identity-foundation.md",
      "identity-session-architecture.md",
      "transport-security-foundation.md",
    ],
  },
  {
    domainId: "workspace-storage-and-assets",
    roleSignal: "workspace tenancy, storage provisioning, and asset lifecycle boundaries",
    migratedSourceSignals: [
      "workspace-foundation.md",
      "storage-foundation.md",
      "shared-asset-contracts.md",
    ],
  },
  {
    domainId: "execution-control-plane-and-scheduling",
    roleSignal: "control-plane authority for run lifecycle transitions",
    migratedSourceSignals: [
      "run-orchestration-domain-foundation.md",
      "run-submission-domain-foundation.md",
      "run-orchestration-scheduling-policy-framework-and-rule-pipeline.md",
    ],
  },
  {
    domainId: "studio-and-system-composition",
    roleSignal: "studio surfaces compose and present shared system/workflow/asset contracts",
    migratedSourceSignals: [
      "studio-handoff-contract.md",
      "presentation-and-state.md",
      "workflow-execution-and-tools.md",
    ],
  },
  {
    domainId: "api-and-transport-surfaces",
    roleSignal: "transport-facing route, endpoint, and event contracts",
    migratedSourceSignals: [
      "unified-api-authoritative-surface.md",
      "unified-api-endpoint-reference.md",
      "shared-api-contract-package.md",
    ],
  },
  {
    domainId: "deployment-policy-and-audit-governance",
    roleSignal: "governance architecture for deployment policy administration",
    migratedSourceSignals: [
      "deployment-profile-policy-administration-foundation.md",
      "audit-domain-foundation.md",
      "audit-ledger-persistence-query-and-access-control-architecture.md",
    ],
  },
];

function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}

describe("architecture domain overview foundation guardrails", () => {
  it("keeps foundational domain overviews discoverable from architecture routers", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");

    for (const { domainId } of overviewExpectations) {
      const overviewLink = `./domains/${domainId}/overview.md`;
      expect(architectureReadme).toContain(overviewLink);
      expect(architectureAiReadme).toContain(overviewLink);
    }
  });

  it("keeps migrated foundational content sections in human and AI overviews", () => {
    for (const { domainId } of overviewExpectations) {
      const overviewPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.md`);
      const overviewAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.ai.md`);

      expect(existsSync(overviewPath)).toBe(true);
      expect(existsSync(overviewAiPath)).toBe(true);

      const overview = readFileSync(overviewPath, "utf8");
      const overviewAi = readFileSync(overviewAiPath, "utf8");

      for (const sectionHeading of [
        "## Foundational Concepts",
        "## Domain-Wide Invariants",
        "## Cross-Domain Dependency Rules",
        "## Canonical Source Documents Migrated into This Overview",
      ] as const) {
        expect(overview).toContain(sectionHeading);
        expect(overviewAi).toContain(sectionHeading);
      }

      expect(countWords(overview)).toBeGreaterThanOrEqual(280);
      expect(countWords(overviewAi)).toBeGreaterThanOrEqual(280);
    }
  });

  it("keeps each domain overview grounded to migration anchors and stable role intent", () => {
    for (const { domainId, roleSignal, migratedSourceSignals } of overviewExpectations) {
      const overviewPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.md`);
      const overviewAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.ai.md`);
      const overview = readFileSync(overviewPath, "utf8");
      const overviewAi = readFileSync(overviewAiPath, "utf8");

      expect(overview).toContain(roleSignal);
      expect(overviewAi).toContain(roleSignal);
      expect(overview).toContain("./references/README.md");
      expect(overviewAi).toContain("./references/README.md");

      for (const signal of migratedSourceSignals) {
        expect(overview).toContain(signal);
        expect(overviewAi).toContain(signal);
      }
    }
  });
});
