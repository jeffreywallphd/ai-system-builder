import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR-001 single authoritative control-plane record", () => {
  const humanAdrPath = "docs/adr/records/adr-001-single-authoritative-control-plane.md";
  const aiAdrPath = "docs/adr/records/adr-001-single-authoritative-control-plane.ai.md";

  it("keeps required ADR metadata and section contract in both variants", () => {
    for (const path of [humanAdrPath, aiAdrPath]) {
      const doc = read(path);

      const requiredMetadataTokens = [
        "title: ADR-001 Single Authoritative Control Plane",
        "doc_type: adr",
        "status: active",
        "authoritativeness: canonical",
        "adr_number: 001",
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

  it("captures core implications for runtime, orchestration, trust, and host/client interaction", () => {
    const humanAdr = read(humanAdrPath);
    const aiAdr = read(aiAdrPath);

    for (const doc of [humanAdr, aiAdr]) {
      expect(doc.toLowerCase()).toContain("runtime");
      expect(doc.toLowerCase()).toContain("orchestration");
      expect(doc.toLowerCase()).toContain("trust");
      expect(doc.toLowerCase()).toContain("host/client");
      expect(doc).toContain("authoritative server host");
      expect(doc).toContain("Desktop, hybrid, web, and worker hosts");
    }
  });

  it("is indexed in ADR records and linked from constrained architecture references", () => {
    const recordsReadme = read("docs/adr/records/README.md");
    const recordsReadmeAi = read("docs/adr/records/README.ai.md");
    const authoritativeHostDoc = read("docs/architecture/authoritative-server-host-assembly.md");
    const authoritativeHostDocAi = read("docs/architecture/authoritative-server-host-assembly.ai.md");
    const unifiedApiDoc = read("docs/architecture/unified-api-authoritative-surface.md");
    const unifiedApiDocAi = read("docs/architecture/unified-api-authoritative-surface.ai.md");
    const orchestrationDoc = read("docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md");
    const orchestrationDocAi = read("docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.ai.md");

    expect(recordsReadme).toContain("adr-001-single-authoritative-control-plane.md");
    expect(recordsReadmeAi).toContain("adr-001-single-authoritative-control-plane.ai.md");

    expect(authoritativeHostDoc).toContain("## Related ADRs");
    expect(authoritativeHostDoc).toContain("adr-001-single-authoritative-control-plane.md");
    expect(authoritativeHostDocAi).toContain("## Related ADRs");
    expect(authoritativeHostDocAi).toContain("adr-001-single-authoritative-control-plane.ai.md");

    expect(unifiedApiDoc).toContain("## Related ADRs");
    expect(unifiedApiDoc).toContain("adr-001-single-authoritative-control-plane.md");
    expect(unifiedApiDocAi).toContain("## Related ADRs");
    expect(unifiedApiDocAi).toContain("adr-001-single-authoritative-control-plane.ai.md");

    expect(orchestrationDoc).toContain("## Related ADRs");
    expect(orchestrationDoc).toContain("adr-001-single-authoritative-control-plane.md");
    expect(orchestrationDocAi).toContain("## Related ADRs");
    expect(orchestrationDocAi).toContain("adr-001-single-authoritative-control-plane.ai.md");
  });
});
