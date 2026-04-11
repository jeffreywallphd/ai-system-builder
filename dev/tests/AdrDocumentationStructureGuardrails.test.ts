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
  });

  it("keeps ADR router readmes explicit about ADR file placement", () => {
    const humanRouter = readFileSync(resolve(adrRoot, "README.md"), "utf8");
    const aiRouter = readFileSync(resolve(adrRoot, "README.ai.md"), "utf8");

    expect(humanRouter).toContain("## ADR File Home");
    expect(humanRouter).toContain("docs/adr/records/");
    expect(humanRouter).toContain("../architecture/README.md");
    expect(humanRouter).toContain("../context/templates/adr.template.md");

    expect(aiRouter).toContain("## ADR File Home");
    expect(aiRouter).toContain("docs/adr/records/");
    expect(aiRouter).toContain("../architecture/README.ai.md");
    expect(aiRouter).toContain("../context/templates/adr.template.ai.md");
  });

  it("keeps records home readmes explicit about naming and indexing contract", () => {
    const humanRecords = readFileSync(resolve(adrRecordsRoot, "README.md"), "utf8");
    const aiRecords = readFileSync(resolve(adrRecordsRoot, "README.ai.md"), "utf8");

    expect(humanRecords).toContain("adr-<NNN>-<kebab-case-title>.md");
    expect(humanRecords).toContain("## Current Index");
    expect(aiRecords).toContain("adr-<NNN>-<kebab-case-title>.md");
    expect(aiRecords).toContain("## Current Index");
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
  });
});
