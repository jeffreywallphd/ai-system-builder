import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanTaxonomyPath = resolve(repoRoot, "docs/architecture/architecture-domain-taxonomy.md");
const aiTaxonomyPath = resolve(repoRoot, "docs/architecture/architecture-domain-taxonomy.ai.md");
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");
const domainsRouterPath = resolve(repoRoot, "docs/architecture/domains/README.md");
const domainsAiRouterPath = resolve(repoRoot, "docs/architecture/domains/README.ai.md");

const requiredDomainIds = [
  "core-platform-and-composition",
  "runtime-host-surfaces",
  "identity-trust-and-security",
  "workspace-storage-and-assets",
  "execution-control-plane-and-scheduling",
  "studio-and-system-composition",
  "api-and-transport-surfaces",
  "deployment-policy-and-audit-governance",
] as const;

const domainRoleSignals: Record<(typeof requiredDomainIds)[number], string> = {
  "core-platform-and-composition": "inner system model and composition contracts",
  "runtime-host-surfaces": "runtime-specific host assembly and startup lifecycle",
  "identity-trust-and-security": "fail-closed architecture boundaries for identity proof",
  "workspace-storage-and-assets": "workspace tenancy, storage provisioning, and asset lifecycle boundaries",
  "execution-control-plane-and-scheduling": "control-plane authority for run lifecycle transitions",
  "studio-and-system-composition": "studio surfaces compose and present shared system/workflow/asset contracts",
  "api-and-transport-surfaces": "transport-facing route, endpoint, and event contracts",
  "deployment-policy-and-audit-governance": "governance architecture for deployment policy administration",
};

describe("architecture domain taxonomy guardrails", () => {
  it("keeps architecture taxonomy documents present and linked from architecture routers", () => {
    expect(existsSync(humanTaxonomyPath)).toBe(true);
    expect(existsSync(aiTaxonomyPath)).toBe(true);
    expect(existsSync(domainsRouterPath)).toBe(true);
    expect(existsSync(domainsAiRouterPath)).toBe(true);

    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");
    const domainsRouter = readFileSync(domainsRouterPath, "utf8");
    const domainsAiRouter = readFileSync(domainsAiRouterPath, "utf8");

    expect(architectureReadme).toContain("./architecture-domain-taxonomy.md");
    expect(architectureAiReadme).toContain("./architecture-domain-taxonomy.md");
    expect(architectureReadme).toContain("./domains/README.md");
    expect(architectureAiReadme).toContain("./domains/README.md");

    for (const domainId of requiredDomainIds) {
      expect(domainsRouter).toContain(`./${domainId}/overview.md`);
      expect(domainsAiRouter).toContain(`./${domainId}/overview.md`);
    }
  });

  it("keeps the taxonomy scoped to grounded system boundaries with explicit migration rules", () => {
    const humanDoc = readFileSync(humanTaxonomyPath, "utf8");
    const aiDoc = readFileSync(aiTaxonomyPath, "utf8");

    for (const heading of [
      "## Why This Taxonomy Exists",
      "## Taxonomy Design Constraints",
      "## Target Architecture Domains",
      "## Domain Boundary Rules",
      "## Target Domain Folder Model (Migration Target)",
      "## Migration Guidance for Later Stories",
      "## Related ADRs",
    ] as const) {
      expect(humanDoc).toContain(heading);
      expect(aiDoc).toContain(heading);
    }

    for (const domainId of requiredDomainIds) {
      expect(humanDoc).toContain(`\`${domainId}\``);
      expect(aiDoc).toContain(`\`${domainId}\``);
    }

    for (const groundingSignal of [
      "src/domain",
      "src/application",
      "src/hosts",
      "src/infrastructure/transport",
      "docs/adr/records/adr-001-single-authoritative-control-plane",
      "docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution",
      "docs/architecture/domains/",
    ] as const) {
      expect(humanDoc).toContain(groundingSignal);
      expect(aiDoc).toContain(groundingSignal);
    }
  });

  it("keeps the domain-oriented architecture folder contract in place", () => {
    for (const domainId of requiredDomainIds) {
      const domainRoot = resolve(repoRoot, `docs/architecture/domains/${domainId}`);
      expect(existsSync(domainRoot)).toBe(true);
      expect(existsSync(resolve(domainRoot, "overview.md"))).toBe(true);
      expect(existsSync(resolve(domainRoot, "overview.ai.md"))).toBe(true);
      expect(existsSync(resolve(domainRoot, "references"))).toBe(true);
      expect(existsSync(resolve(domainRoot, "references/README.md"))).toBe(true);
      expect(existsSync(resolve(domainRoot, "references/README.ai.md"))).toBe(true);
    }
  });

  it("keeps the standard domain document pattern explicit and consistent across domains", () => {
    const domainsRouter = readFileSync(domainsRouterPath, "utf8");
    const domainsAiRouter = readFileSync(domainsAiRouterPath, "utf8");

    for (const requiredAnchor of [
      "## Standard Domain Document Pattern",
      "## Overview Responsibilities",
      "## Reference Responsibilities",
      "## ADR and Context Pack Linking Rules",
      "## Content Placement Rules",
      "overview.md",
      "references/README.md",
      "Seed Reference Placeholders",
    ] as const) {
      expect(domainsRouter).toContain(requiredAnchor);
      expect(domainsAiRouter).toContain(requiredAnchor);
    }

    for (const domainId of requiredDomainIds) {
      const overviewPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.md`);
      const overviewAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.ai.md`);
      const referenceReadmePath = resolve(repoRoot, `docs/architecture/domains/${domainId}/references/README.md`);
      const referenceReadmeAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/references/README.ai.md`);

      const overview = readFileSync(overviewPath, "utf8");
      const overviewAi = readFileSync(overviewAiPath, "utf8");
      const references = readFileSync(referenceReadmePath, "utf8");
      const referencesAi = readFileSync(referenceReadmeAiPath, "utf8");

      for (const heading of [
        "## Seed Scope Guidance",
        "## What Belongs in the Overview",
        "## What Does Not Belong in the Overview",
        "## Related Domain References",
        "## Related ADRs",
        "## Related Context Packs",
      ] as const) {
        expect(overview).toContain(heading);
        expect(overviewAi).toContain(heading);
      }

      for (const heading of [
        "## What Belongs in Domain References",
        "## What Does Not Belong in Domain References",
        "## Seed Reference Placeholders",
        "## Reference Authoring Rules",
      ] as const) {
        expect(references).toContain(heading);
        expect(referencesAi).toContain(heading);
      }

      const roleSignal = domainRoleSignals[domainId];
      expect(overview).toContain(roleSignal);
      expect(overviewAi).toContain(roleSignal);

      expect(overview).toContain("./references/README.md");
      expect(overviewAi).toContain("./references/README.md");
      expect(references).toContain("../overview.md");
      expect(referencesAi).toContain("../overview.md");
    }
  });
});
