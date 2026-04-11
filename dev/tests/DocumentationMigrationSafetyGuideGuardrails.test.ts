import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanGuidePath = resolve(repoRoot, "docs/contributors/docs-migration-safety-guide.md");
const aiGuidePath = resolve(repoRoot, "docs/contributors/docs-migration-safety-guide.ai.md");
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsAiReadmePath = resolve(repoRoot, "docs/contributors/README.ai.md");

function expectRequiredFrontmatter(content: string): void {
  const requiredHeaderLines = [
    "doc_type: contributor-guide",
    "status: active",
    "authoritativeness: canonical",
    "owned_by:",
    "last_reviewed:",
  ];

  for (const line of requiredHeaderLines) {
    expect(content).toContain(line);
  }
}

describe("documentation migration safety guide guardrails", () => {
  it("keeps human and AI migration safety guides present", () => {
    expect(existsSync(humanGuidePath)).toBe(true);
    expect(existsSync(aiGuidePath)).toBe(true);
  });

  it("keeps contributor router readmes linked to migration safety guidance", () => {
    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsAiReadme = readFileSync(contributorsAiReadmePath, "utf8");

    expect(contributorsReadme).toContain("./docs-migration-safety-guide.md");
    expect(contributorsAiReadme).toContain("./docs-migration-safety-guide.ai.md");
  });

  it("enforces migration-safe anchors for moving, splitting, reclassification, and deprecation", () => {
    const humanGuide = readFileSync(humanGuidePath, "utf8");
    const aiGuide = readFileSync(aiGuidePath, "utf8");

    expectRequiredFrontmatter(humanGuide);
    expectRequiredFrontmatter(aiGuide);

    const requiredAnchors = [
      "Moving Documents Safely",
      "Splitting Documents Safely",
      "Reclassifying Documents Safely",
      "Deprecation and Pointer Note Rules",
      "Handling Mixed Historical and Active Content",
      "superseded_by",
      "documentation-supersession-and-redirect-conventions",
      "npm run docs:validate:foundation",
    ];

    for (const anchor of requiredAnchors) {
      expect(humanGuide).toContain(anchor);
      expect(aiGuide).toContain(anchor);
    }
  });
});
