import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();

type DomainExpectation = {
  domainId: string;
  requiredOverviewLinks: string[];
  requiredReferenceReadmeLinks: string[];
};

const domainExpectations: DomainExpectation[] = [
  {
    domainId: "core-platform-and-composition",
    requiredOverviewLinks: [
      "../../../contributors/adr-informed-implementation-and-review-examples.md",
      "../../../../src/infrastructure/composition",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../contributors/README.md",
      "../../../../../src/infrastructure/composition",
    ],
  },
  {
    domainId: "runtime-host-surfaces",
    requiredOverviewLinks: [
      "../../../node-bootstrap-identity-operations.md",
      "../../../../electron/main",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../node-bootstrap-identity-operations.md",
      "../../../../../electron/main",
    ],
  },
  {
    domainId: "identity-trust-and-security",
    requiredOverviewLinks: [
      "../../../security-policy-configuration-operations.md",
      "../../../../src/infrastructure/security",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../security-policy-configuration-operations.md",
      "../../../../../src/infrastructure/security",
    ],
  },
  {
    domainId: "workspace-storage-and-assets",
    requiredOverviewLinks: [
      "../../../workspace-administration-operations.md",
      "../../../../src/infrastructure/storage",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../storage-administration-operations.md",
      "../../../../../src/domain/assets",
    ],
  },
  {
    domainId: "execution-control-plane-and-scheduling",
    requiredOverviewLinks: [
      "../../../run-orchestration-contributor-guide.md",
      "../../../../src/application/scheduling",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../governance-audit-review-workflows.md",
      "../../../../../src/application/runs",
    ],
  },
  {
    domainId: "studio-and-system-composition",
    requiredOverviewLinks: [
      "../../../image-manipulation-loading-status-conventions.md",
      "../../../../src/ui/features",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../tuning-dataset-studio.md",
      "../../../../../src/application/workflow-studio",
    ],
  },
  {
    domainId: "api-and-transport-surfaces",
    requiredOverviewLinks: [
      "../../../unified-api-observability-troubleshooting.md",
      "../../../../src/infrastructure/transport",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../unified-api-contributor-guide.md",
      "../../../../../src/application/contracts",
    ],
  },
  {
    domainId: "deployment-policy-and-audit-governance",
    requiredOverviewLinks: [
      "../../../deployment-profile-policy-contributor-guide.md",
      "../../../../src/infrastructure/audit",
    ],
    requiredReferenceReadmeLinks: [
      "../../../../governance-audit-review-workflows.md",
      "../../../../../src/application/policy-administration",
    ],
  },
];

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function extractSectionBody(markdown: string, heading: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\n#\\s+|$)`, "m");
  const match = normalized.match(pattern);
  return match ? match[1] : "";
}

function extractLinkTargets(markdown: string): string[] {
  const targets: string[] = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = pattern.exec(markdown);
  while (match) {
    targets.push(match[1].trim());
    match = pattern.exec(markdown);
  }
  return targets;
}

describe("architecture domain artifact cross references guardrails", () => {
  it("keeps curated neighboring-doc and source-code cross-reference sections in domain overviews", () => {
    for (const { domainId, requiredOverviewLinks } of domainExpectations) {
      for (const variant of ["overview.md", "overview.ai.md"] as const) {
        const relativePath = `docs/architecture/domains/${domainId}/${variant}`;
        const content = read(relativePath);

        expect(content).toContain("## Related Contributor and Operations Guidance");
        expect(content).toContain("## Related Code Paths");

        for (const expectedLink of requiredOverviewLinks) {
          expect(content).toContain(expectedLink);
        }

        const docsSection = extractSectionBody(content, "## Related Contributor and Operations Guidance");
        const codeSection = extractSectionBody(content, "## Related Code Paths");
        const docsLinks = extractLinkTargets(docsSection);
        const codeLinks = extractLinkTargets(codeSection);

        expect(docsLinks.length).toBeGreaterThanOrEqual(2);
        expect(codeLinks.length).toBeGreaterThanOrEqual(3);

        for (const target of [...docsLinks, ...codeLinks]) {
          const absolute = resolve(repoRoot, dirname(relativePath), target);
          expect(existsSync(absolute)).toBe(true);
        }
      }
    }
  });

  it("keeps domain reference indexes linked to relevant neighboring docs and source-code areas", () => {
    for (const { domainId, requiredReferenceReadmeLinks } of domainExpectations) {
      for (const variant of ["README.md", "README.ai.md"] as const) {
        const relativePath = `docs/architecture/domains/${domainId}/references/${variant}`;
        const content = read(relativePath);

        expect(content).toContain("## Related Contributor and Operations Guidance");
        expect(content).toContain("## Related Code Paths");

        for (const expectedLink of requiredReferenceReadmeLinks) {
          expect(content).toContain(expectedLink);
        }

        const docsSection = extractSectionBody(content, "## Related Contributor and Operations Guidance");
        const codeSection = extractSectionBody(content, "## Related Code Paths");
        const docsLinks = extractLinkTargets(docsSection);
        const codeLinks = extractLinkTargets(codeSection);

        expect(docsLinks.length).toBeGreaterThanOrEqual(2);
        expect(codeLinks.length).toBeGreaterThanOrEqual(3);

        for (const target of [...docsLinks, ...codeLinks]) {
          const absolute = resolve(repoRoot, dirname(relativePath), target);
          expect(existsSync(absolute)).toBe(true);
        }
      }
    }
  });
});
