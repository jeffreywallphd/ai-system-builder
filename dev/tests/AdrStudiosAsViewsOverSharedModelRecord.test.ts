import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR-004 studios as views over shared system and asset model record", () => {
  const humanAdrPath =
    "docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md";
  const aiAdrPath =
    "docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md";

  it("keeps required ADR metadata and section contract in both variants", () => {
    for (const path of [humanAdrPath, aiAdrPath]) {
      const doc = read(path);

      const requiredMetadataTokens = [
        "title: ADR-004 Studios as Views Over Shared System and Asset Model",
        "doc_type: adr",
        "status: active",
        "authoritativeness: canonical",
        "adr_number: 004",
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

  it("captures implications for UI composition, workflow integration, system modeling, and extensibility", () => {
    const humanAdr = read(humanAdrPath).toLowerCase();
    const aiAdr = read(aiAdrPath).toLowerCase();

    for (const doc of [humanAdr, aiAdr]) {
      expect(doc).toContain("shared");
      expect(doc).toContain("views");
      expect(doc).toContain("ui composition");
      expect(doc).toContain("workflow integration");
      expect(doc).toContain("system modeling");
      expect(doc).toContain("extensibility");
      expect(doc).toContain("disconnected tools");
    }
  });

  it("is indexed in ADR records and linked from studio/system composition references", () => {
    const recordsReadme = read("docs/adr/records/README.md");
    const recordsReadmeAi = read("docs/adr/records/README.ai.md");
    const studioHandoffDoc = read("docs/architecture/studio-handoff-contract.md");
    const studioHandoffDocAi = read("docs/architecture/studio-handoff-contract.ai.md");
    const studioSystemPack = read("docs/context/packs/studio-and-system-composition.pack.md");
    const studioSystemPackAi = read("docs/context/packs/studio-and-system-composition.pack.ai.md");

    expect(recordsReadme).toContain(
      "adr-004-studios-as-views-over-shared-system-and-asset-model.md",
    );
    expect(recordsReadmeAi).toContain(
      "adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md",
    );

    expect(studioHandoffDoc).toContain("## Related ADRs");
    expect(studioHandoffDoc).toContain(
      "adr-004-studios-as-views-over-shared-system-and-asset-model.md",
    );
    expect(studioHandoffDocAi).toContain("## Related ADRs");
    expect(studioHandoffDocAi).toContain(
      "adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md",
    );

    expect(studioSystemPack).toContain(
      "adr-004-studios-as-views-over-shared-system-and-asset-model.md",
    );
    expect(studioSystemPackAi).toContain(
      "adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md",
    );
  });
});
