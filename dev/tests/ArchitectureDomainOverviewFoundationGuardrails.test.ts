import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");

type OverviewExpectation = {
  domainId: string;
  canonicalReference: string;
  migratedSourceSignals: string[];
};

const overviewExpectations: OverviewExpectation[] = [
  {
    domainId: "core-platform-and-composition",
    canonicalReference: "layer-direction-and-dependency-rules.md",
    migratedSourceSignals: [
      "domain-and-application-core.md",
      "layers-and-boundaries.md",
      "persistent-platform-domain-boundaries.md",
    ],
  },
  {
    domainId: "runtime-host-surfaces",
    canonicalReference: "host-composition-root-contracts.md",
    migratedSourceSignals: [
      "desktop-runtime-and-hosts.md",
      "authoritative-server-host-assembly.md",
      "worker-host-assembly.md",
    ],
  },
  {
    domainId: "identity-trust-and-security",
    canonicalReference: "identity-proof-and-session-trust-contracts.md",
    migratedSourceSignals: [
      "identity-foundation.md",
      "identity-session-architecture.md",
      "transport-security-foundation.md",
    ],
  },
  {
    domainId: "workspace-storage-and-assets",
    canonicalReference: "workspace-tenancy-and-ownership-contracts.md",
    migratedSourceSignals: [
      "workspace-foundation.md",
      "storage-foundation.md",
      "shared-asset-contracts.md",
    ],
  },
  {
    domainId: "execution-control-plane-and-scheduling",
    canonicalReference: "run-lifecycle-state-authority.md",
    migratedSourceSignals: [
      "run-orchestration-domain-foundation.md",
      "run-submission-domain-foundation.md",
      "run-orchestration-scheduling-policy-framework-and-rule-pipeline.md",
    ],
  },
  {
    domainId: "studio-and-system-composition",
    canonicalReference: "studio-handoff-and-boundary-contracts.md",
    migratedSourceSignals: [
      "studio-handoff-contract.md",
      "presentation-and-state.md",
      "workflow-execution-and-tools.md",
    ],
  },
  {
    domainId: "api-and-transport-surfaces",
    canonicalReference: "unified-api-surface-contracts.md",
    migratedSourceSignals: [
      "unified-api-authoritative-surface.md",
      "unified-api-endpoint-reference.md",
      "shared-api-contract-package.md",
    ],
  },
  {
    domainId: "deployment-policy-and-audit-governance",
    canonicalReference: "deployment-policy-resolution-and-overrides.md",
    migratedSourceSignals: [
      "deployment-profile-policy-administration-foundation.md",
      "audit-domain-foundation.md",
      "audit-ledger-persistence-query-and-access-control-architecture.md",
    ],
  },
];

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

  it("keeps overviews conceptual and routes contract detail into references", () => {
    for (const { domainId, canonicalReference, migratedSourceSignals } of overviewExpectations) {
      const overviewPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.md`);
      const overviewAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.ai.md`);

      expect(existsSync(overviewPath)).toBe(true);
      expect(existsSync(overviewAiPath)).toBe(true);

      const overview = readFileSync(overviewPath, "utf8");
      const overviewAi = readFileSync(overviewAiPath, "utf8");

      for (const sectionHeading of [
        "## Domain Summary for Fast Context Selection",
        "## Scope and System Boundary",
        "## Canonical Responsibilities",
        "## Cross-Cutting Invariants",
        "## Integration and Dependency Boundaries",
        "## Reference Map",
        "## Canonical Source Documents Migrated into This Domain",
      ] as const) {
        expect(overview).toContain(sectionHeading);
        expect(overviewAi).toContain(sectionHeading);
      }

      expect(overview).toContain(`./references/${canonicalReference}`);
      expect(overviewAi).toContain(`./references/${canonicalReference}`);
      expect(overview).toContain("- Context-pack relationship:");
      expect(overviewAi).toContain("- Context-pack relationship:");
      expect(overview).toContain("docs/context/packs/");
      expect(overviewAi).toContain("docs/context/packs/");
      expect(overview).toContain("should reference this domain instead of duplicating it.");
      expect(overviewAi).toContain("should reference this domain instead of duplicating it.");
      expect(overview.indexOf("## Domain Summary for Fast Context Selection"))
        .toBeLessThan(overview.indexOf("## Scope and System Boundary"));
      expect(overviewAi.indexOf("## Domain Summary for Fast Context Selection"))
        .toBeLessThan(overviewAi.indexOf("## Scope and System Boundary"));
      expect(overview).not.toContain("## Contracts and Interfaces");
      expect(overviewAi).not.toContain("## Contracts and Interfaces");
      expect(overview).not.toContain("## Failure and Recovery Semantics");
      expect(overviewAi).not.toContain("## Failure and Recovery Semantics");

      for (const signal of migratedSourceSignals) {
        expect(overview).toContain(signal);
        expect(overviewAi).toContain(signal);
      }
    }
  });

  it("keeps canonical reference docs discoverable and contract-focused in both variants", () => {
    for (const { domainId, canonicalReference } of overviewExpectations) {
      const indexPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/references/README.md`);
      const indexAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/references/README.ai.md`);
      const referencePath = resolve(repoRoot, `docs/architecture/domains/${domainId}/references/${canonicalReference}`);
      const referenceAiPath = resolve(
        repoRoot,
        `docs/architecture/domains/${domainId}/references/${canonicalReference.replace(".md", ".ai.md")}`,
      );

      expect(existsSync(indexPath)).toBe(true);
      expect(existsSync(indexAiPath)).toBe(true);
      expect(existsSync(referencePath)).toBe(true);
      expect(existsSync(referenceAiPath)).toBe(true);

      const index = readFileSync(indexPath, "utf8");
      const indexAi = readFileSync(indexAiPath, "utf8");
      expect(index).toContain("## Canonical Reference Documents");
      expect(indexAi).toContain("## Canonical Reference Documents");
      expect(index).toContain(`./${canonicalReference}`);
      expect(indexAi).toContain(`./${canonicalReference}`);
      expect(index).toContain("../overview.md");
      expect(indexAi).toContain("../overview.md");

      const reference = readFileSync(referencePath, "utf8");
      const referenceAi = readFileSync(referenceAiPath, "utf8");
      for (const heading of [
        "## Context and Scope",
        "## Contracts and Interfaces",
        "## Data and State Invariants",
        "## Failure and Recovery Semantics",
        "## Extension Guardrails",
        "## References",
      ] as const) {
        expect(reference).toContain(heading);
        expect(referenceAi).toContain(heading);
      }

      expect(reference).toContain("[Domain Overview](../overview.md)");
      expect(referenceAi).toContain("[Domain Overview](../overview.md)");
    }
  });
});
