import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const adrRoot = resolve(repoRoot, "docs/adr");
const adrRecordsRoot = resolve(adrRoot, "records");

describe("ADR documentation structure guardrails", () => {
  it("keeps ADR router and records home present", () => {
    expect(existsSync(resolve(adrRoot, "README.md"))).toBe(true);
    expect(existsSync(resolve(adrRoot, "README.ai.md"))).toBe(true);
    expect(existsSync(resolve(adrRecordsRoot, "README.md"))).toBe(true);
    expect(existsSync(resolve(adrRecordsRoot, "README.ai.md"))).toBe(true);
    expect(existsSync(resolve(adrRecordsRoot, "authoring-guide.md"))).toBe(true);
    expect(existsSync(resolve(adrRecordsRoot, "authoring-guide.ai.md"))).toBe(true);
  });

  it("keeps ADR router readmes explicit about ADR file placement", () => {
    const humanRouter = readFileSync(resolve(adrRoot, "README.md"), "utf8");
    const aiRouter = readFileSync(resolve(adrRoot, "README.ai.md"), "utf8");

    expect(humanRouter).toContain("## ADR File Home");
    expect(humanRouter).toContain("## ADR Metadata and Lifecycle Rules");
    expect(humanRouter).toContain("## ADR Decision Thresholds");
    expect(humanRouter).toContain("## Standard ADR Sections");
    expect(humanRouter).toContain("## ADR Cross-Linking Conventions");
    expect(humanRouter).toContain("docs/adr/records/");
    expect(humanRouter).toContain("3-digit, zero-padded identifiers");
    expect(humanRouter).toContain("ADR-<NNN> <Decision Title>");
    expect(humanRouter).toContain("### ADR Required");
    expect(humanRouter).toContain("### ADR Recommended");
    expect(humanRouter).toContain("### ADR Unnecessary");
    expect(humanRouter).toContain("architectural invariant");
    expect(humanRouter).toContain("control-plane");
    expect(humanRouter).toContain("workspace model");
    expect(humanRouter).toContain("security trust boundaries");
    expect(humanRouter).toContain("storage policy");
    expect(humanRouter).toContain("studio and system modeling");
    expect(humanRouter).toContain("decision_status");
    expect(humanRouter).toContain("accepted");
    expect(humanRouter).toContain("deprecated");
    expect(humanRouter).toContain("### Where To Document When ADR Is Unnecessary");
    expect(humanRouter).toContain("docs/operations/");
    expect(humanRouter).toContain("docs/baselines/");
    expect(humanRouter).toContain("../architecture/README.md");
    expect(humanRouter).toContain("../context/templates/adr.template.md");
    expect(humanRouter).toContain("Decision Statement");
    expect(humanRouter).toContain("Supersession");
    expect(humanRouter).toContain("bi-directional");
    expect(humanRouter).toContain("docs/context/packs/");
    expect(humanRouter).toContain("## Related ADRs");
    expect(humanRouter).toContain("./records/authoring-guide.md");

    expect(aiRouter).toContain("## ADR File Home");
    expect(aiRouter).toContain("## ADR Metadata and Lifecycle Rules");
    expect(aiRouter).toContain("## ADR Decision Thresholds");
    expect(aiRouter).toContain("## Standard ADR Sections");
    expect(aiRouter).toContain("## ADR Cross-Linking Conventions");
    expect(aiRouter).toContain("docs/adr/records/");
    expect(aiRouter).toContain("3-digit, zero-padded identifiers");
    expect(aiRouter).toContain("ADR-<NNN> <Decision Title>");
    expect(aiRouter).toContain("### ADR Required");
    expect(aiRouter).toContain("### ADR Recommended");
    expect(aiRouter).toContain("### ADR Unnecessary");
    expect(aiRouter).toContain("architectural invariant");
    expect(aiRouter).toContain("control-plane");
    expect(aiRouter).toContain("workspace model");
    expect(aiRouter).toContain("security trust boundaries");
    expect(aiRouter).toContain("storage policy");
    expect(aiRouter).toContain("studio/system modeling");
    expect(aiRouter).toContain("decision_status");
    expect(aiRouter).toContain("accepted");
    expect(aiRouter).toContain("deprecated");
    expect(aiRouter).toContain("### Where To Document When ADR Is Unnecessary");
    expect(aiRouter).toContain("docs/operations/");
    expect(aiRouter).toContain("docs/baselines/");
    expect(aiRouter).toContain("../architecture/README.ai.md");
    expect(aiRouter).toContain("../context/templates/adr.template.ai.md");
    expect(aiRouter).toContain("Decision Statement");
    expect(aiRouter).toContain("Supersession");
    expect(aiRouter).toContain("bi-directional");
    expect(aiRouter).toContain("docs/context/packs/");
    expect(aiRouter).toContain("## Related ADRs");
    expect(aiRouter).toContain("./records/authoring-guide.ai.md");
  });

  it("keeps records home readmes explicit about naming and indexing contract", () => {
    const humanRecords = readFileSync(resolve(adrRecordsRoot, "README.md"), "utf8");
    const aiRecords = readFileSync(resolve(adrRecordsRoot, "README.ai.md"), "utf8");

    expect(humanRecords).toContain("adr-<NNN>-<kebab-case-title>.md");
    expect(humanRecords).toContain("## ADR Status Taxonomy");
    expect(humanRecords).toContain("proposed");
    expect(humanRecords).toContain("accepted");
    expect(humanRecords).toContain("superseded");
    expect(humanRecords).toContain("deprecated");
    expect(humanRecords).toContain("## ADR Index and Sorting Rules");
    expect(humanRecords).toContain("adr_number");
    expect(humanRecords).toContain("## Current Index");
    expect(humanRecords).toContain("required section");
    expect(humanRecords).toContain("Supersession");
    expect(aiRecords).toContain("adr-<NNN>-<kebab-case-title>.md");
    expect(aiRecords).toContain("## ADR Status Taxonomy");
    expect(aiRecords).toContain("proposed");
    expect(aiRecords).toContain("accepted");
    expect(aiRecords).toContain("superseded");
    expect(aiRecords).toContain("deprecated");
    expect(aiRecords).toContain("## ADR Index and Sorting Rules");
    expect(aiRecords).toContain("adr_number");
    expect(aiRecords).toContain("## Current Index");
    expect(aiRecords).toContain("required sections");
    expect(aiRecords).toContain("Supersession");
  });

  it("keeps ADR records out of the adr router root", () => {
    const adrRootEntries = readdirSync(adrRoot, { withFileTypes: true });
    const misplacedAdrDocs = adrRootEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter(
        (name) =>
          name.endsWith(".md") &&
          name !== "README.md" &&
          name !== "README.ai.md",
      );

    expect(misplacedAdrDocs).toEqual([]);
  });

  it("keeps contributor and template guidance aligned with ADR records home", () => {
    const placementGuide = readFileSync(
      resolve(repoRoot, "docs/contributors/docs-placement-guide.md"),
      "utf8",
    );
    const placementGuideAi = readFileSync(
      resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md"),
      "utf8",
    );
    const templatesGuide = readFileSync(
      resolve(repoRoot, "docs/context/templates/README.md"),
      "utf8",
    );
    const templatesGuideAi = readFileSync(
      resolve(repoRoot, "docs/context/templates/README.ai.md"),
      "utf8",
    );

    expect(placementGuide).toContain("docs/adr/records/");
    expect(placementGuideAi).toContain("docs/adr/records/");
    expect(templatesGuide).toContain("docs/adr/records/");
    expect(templatesGuideAi).toContain("docs/adr/records/");
    expect(templatesGuide).toContain("docs/adr/records/authoring-guide.md");
    expect(templatesGuideAi).toContain("docs/adr/records/authoring-guide.ai.md");
  });

  it("keeps ADR authoring guidance practical and decision-focused", () => {
    const authoringGuide = readFileSync(
      resolve(adrRecordsRoot, "authoring-guide.md"),
      "utf8",
    );
    const authoringGuideAi = readFileSync(
      resolve(adrRecordsRoot, "authoring-guide.ai.md"),
      "utf8",
    );
    const recordsReadme = readFileSync(resolve(adrRecordsRoot, "README.md"), "utf8");
    const recordsReadmeAi = readFileSync(resolve(adrRecordsRoot, "README.ai.md"), "utf8");

    expect(recordsReadme).toContain("./authoring-guide.md");
    expect(recordsReadmeAi).toContain("./authoring-guide.ai.md");

    for (const guide of [authoringGuide, authoringGuideAi]) {
      const normalizedGuide = guide.toLowerCase();
      expect(normalizedGuide).toContain("good");
      expect(normalizedGuide).toContain("bad");
      expect(guide).toContain("Decision Statement");
      expect(guide).toContain("Considered Options");
      expect(guide).toContain("Consequences");
      expect(guide).toContain("Related Documentation");
      expect(normalizedGuide).toContain("tradeoff");
      expect(normalizedGuide).toContain("speculative");
      expect(normalizedGuide).toContain("implementation");
      expect(normalizedGuide).toContain("bi-directional");
    }
  });
});
