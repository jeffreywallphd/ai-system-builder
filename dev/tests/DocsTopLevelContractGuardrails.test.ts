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
] as const;

const folderContractReadmeRequirements = [
  "contributors",
  "operations",
  "baselines",
  "adr",
  "context",
] as const;

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

      expect(content).toContain("## Purpose");
      expect(content).toContain("## Belongs Here");
      expect(content).toContain("## Does Not Belong Here");
      expect((content.match(/^- /gm) || []).length).toBeGreaterThanOrEqual(4);
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
});
