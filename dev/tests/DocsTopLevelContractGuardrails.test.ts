import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const docsRoot = resolve(repoRoot, "docs");

const requiredTopLevelFolders = [
  "architecture",
  "contributors",
  "operations",
  "baselines",
  "adr",
  "context",
  "prompts",
  "ui",
] as const;

const folderContractReadmeRequirements = requiredTopLevelFolders;

function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .length;
}

describe("docs top-level contract guardrails", () => {
  it("keeps required top-level docs folders present", () => {
    for (const folder of requiredTopLevelFolders) {
      expect(existsSync(resolve(docsRoot, folder))).toBe(true);
    }
  });

  it("keeps router readmes present for each required top-level contract folder", () => {
    for (const folder of requiredTopLevelFolders) {
      expect(existsSync(resolve(docsRoot, folder, "README.md"))).toBe(true);
    }

    for (const folder of folderContractReadmeRequirements) {
      expect(existsSync(resolve(docsRoot, folder, "README.ai.md"))).toBe(true);
    }
  });

  it("enforces role-oriented router sections for contract folders", () => {
    for (const folder of folderContractReadmeRequirements) {
      const readmePath = resolve(docsRoot, folder, "README.md");
      const content = readFileSync(readmePath, "utf8");

      expect(content).toContain("## Audience");
      expect(content).toContain("## Purpose");
      expect(content).toContain("## Belongs Here");
      expect(content).toContain("## Does Not Belong Here");
      expect(content).toContain("## Start Here");
      expect((content.match(/^- /gm) || []).length).toBeGreaterThanOrEqual(4);
      expect((content.match(/\[[^\]]+\]\([^)]+\)/g) || []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps the docs root contract router aligned with required folders", () => {
    const readme = readFileSync(resolve(docsRoot, "README.md"), "utf8");
    const aiReadme = readFileSync(resolve(docsRoot, "README.ai.md"), "utf8");

    for (const folder of requiredTopLevelFolders) {
      expect(readme).toContain(`docs/${folder}/`);
      expect(aiReadme).toContain(`docs/${folder}/`);
    }
  });

  it("enforces root router structure for role and task-based navigation", () => {
    const readme = readFileSync(resolve(docsRoot, "README.md"), "utf8");
    const aiReadme = readFileSync(resolve(docsRoot, "README.ai.md"), "utf8");

    const requiredSections = [
      "## Documentation Areas",
      "## Route By Reader Type",
      "## Route By Task",
      "## Common Reader Journeys",
      "## Durability Rules",
    ] as const;

    for (const section of requiredSections) {
      expect(readme).toContain(section);
      expect(aiReadme).toContain(section);
    }

    expect(readme).not.toContain("## Folder responsibilities");
    expect(aiReadme).not.toContain("## Required folder contract");

    expect(readme).toContain("./contributors/docs-placement-guide.md");
    expect(readme).toContain("./context/documentation-taxonomy.md");
    expect(readme).toContain("./context/documentation-supersession-and-redirect-conventions.md");
    expect(readme).toContain("./context/documentation-metadata-header.md");
    expect(aiReadme).toContain("./contributors/docs-placement-guide.md");
    expect(aiReadme).toContain("./context/documentation-taxonomy.ai.md");
    expect(aiReadme).toContain("./context/documentation-supersession-and-redirect-conventions.ai.md");
    expect(aiReadme).toContain("./context/documentation-metadata-header.ai.md");
  });

  it("keeps explicit high-value reader journeys in the root routers", () => {
    const readme = readFileSync(resolve(docsRoot, "README.md"), "utf8");
    const aiReadme = readFileSync(resolve(docsRoot, "README.ai.md"), "utf8");

    const requiredJourneyLabels = [
      "Understand architecture boundaries and decisions",
      "Contribute a code change safely",
      "Operate or troubleshoot the system locally",
      "Review historical baselines and migration context",
      "Prepare AI context for implementation or analysis",
    ] as const;

    for (const label of requiredJourneyLabels) {
      expect(readme).toContain(label);
      expect(aiReadme).toContain(label);
    }

    expect(readme).toContain("./architecture/README.md");
    expect(readme).toContain("./contributors/README.md");
    expect(readme).toContain("./operations/README.md");
    expect(readme).toContain("./baselines/README.md");
    expect(readme).toContain("./context/README.md");

    expect(aiReadme).toContain("./architecture/README.ai.md");
    expect(aiReadme).toContain("./contributors/README.ai.md");
    expect(aiReadme).toContain("./operations/README.ai.md");
    expect(aiReadme).toContain("./baselines/README.ai.md");
    expect(aiReadme).toContain("./context/README.ai.md");
  });

  it("keeps root router concise and navigation-first", () => {
    const readme = readFileSync(resolve(docsRoot, "README.md"), "utf8");
    const aiReadme = readFileSync(resolve(docsRoot, "README.ai.md"), "utf8");

    expect(countWords(readme)).toBeLessThanOrEqual(500);
    expect(countWords(aiReadme)).toBeLessThanOrEqual(500);
    expect((readme.match(/\[[^\]]+\]\([^)]+\)/g) || []).length).toBeGreaterThanOrEqual(12);
    expect((aiReadme.match(/\[[^\]]+\]\([^)]+\)/g) || []).length).toBeGreaterThanOrEqual(12);
  });
});
