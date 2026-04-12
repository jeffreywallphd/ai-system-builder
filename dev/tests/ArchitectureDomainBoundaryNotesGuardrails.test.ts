import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const domainsReadmePath = resolve(repoRoot, "docs/architecture/domains/README.md");
const domainsAiReadmePath = resolve(repoRoot, "docs/architecture/domains/README.ai.md");

type BoundaryNoteExpectation = {
  domainId: string;
  requiredSignals: string[];
};

const boundaryNoteExpectations: BoundaryNoteExpectation[] = [
  {
    domainId: "execution-control-plane-and-scheduling",
    requiredSignals: [
      "runtime-host-surfaces",
      "studio-and-system-composition",
      "docs/operations/",
    ],
  },
  {
    domainId: "runtime-host-surfaces",
    requiredSignals: [
      "execution-control-plane-and-scheduling",
      "api-and-transport-surfaces",
      "docs/operations/",
    ],
  },
  {
    domainId: "deployment-policy-and-audit-governance",
    requiredSignals: [
      "execution-control-plane-and-scheduling",
      "identity-trust-and-security",
      "docs/operations/",
    ],
  },
  {
    domainId: "studio-and-system-composition",
    requiredSignals: [
      "core-platform-and-composition",
      "workspace-storage-and-assets",
      "execution-control-plane-and-scheduling",
    ],
  },
  {
    domainId: "workspace-storage-and-assets",
    requiredSignals: [
      "studio-and-system-composition",
      "runtime-host-surfaces",
      "docs/operations/",
    ],
  },
];

describe("architecture domain boundary note guardrails", () => {
  it("keeps boundary-note guidance in the domain folder contract docs", () => {
    const domainsReadme = readFileSync(domainsReadmePath, "utf8");
    const domainsAiReadme = readFileSync(domainsAiReadmePath, "utf8");

    const signal = "## Domain Boundary Notes for Common Confusion";
    expect(domainsReadme).toContain(signal);
    expect(domainsAiReadme).toContain(signal);
  });

  it("keeps explicit boundary notes in confusion-prone domain overviews", () => {
    for (const { domainId, requiredSignals } of boundaryNoteExpectations) {
      const overviewPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.md`);
      const overviewAiPath = resolve(repoRoot, `docs/architecture/domains/${domainId}/overview.ai.md`);

      const overview = readFileSync(overviewPath, "utf8");
      const overviewAi = readFileSync(overviewAiPath, "utf8");

      expect(overview).toContain("## Domain Boundary Notes for Common Confusion");
      expect(overviewAi).toContain("## Domain Boundary Notes for Common Confusion");

      for (const signal of requiredSignals) {
        expect(overview).toContain(signal);
        expect(overviewAi).toContain(signal);
      }
    }
  });
});
