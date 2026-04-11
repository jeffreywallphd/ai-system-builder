import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanTaxonomyPath = resolve(repoRoot, "docs/architecture/architecture-domain-taxonomy.md");
const aiTaxonomyPath = resolve(repoRoot, "docs/architecture/architecture-domain-taxonomy.ai.md");
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");

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

describe("architecture domain taxonomy guardrails", () => {
  it("keeps architecture taxonomy documents present and linked from architecture routers", () => {
    expect(existsSync(humanTaxonomyPath)).toBe(true);
    expect(existsSync(aiTaxonomyPath)).toBe(true);

    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");

    expect(architectureReadme).toContain("./architecture-domain-taxonomy.md");
    expect(architectureAiReadme).toContain("./architecture-domain-taxonomy.md");
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
});
