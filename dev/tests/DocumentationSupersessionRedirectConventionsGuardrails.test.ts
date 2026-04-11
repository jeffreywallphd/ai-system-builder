import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const conventionsPath = resolve(
  repoRoot,
  "docs/context/documentation-supersession-and-redirect-conventions.md",
);
const conventionsAiPath = resolve(
  repoRoot,
  "docs/context/documentation-supersession-and-redirect-conventions.ai.md",
);
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextReadmeAiPath = resolve(repoRoot, "docs/context/README.ai.md");
const docsReadmePath = resolve(repoRoot, "docs/README.md");
const docsReadmeAiPath = resolve(repoRoot, "docs/README.ai.md");
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const placementGuideAiPath = resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md");
const migrationGuidePath = resolve(repoRoot, "docs/contributors/docs-migration-safety-guide.md");
const migrationGuideAiPath = resolve(repoRoot, "docs/contributors/docs-migration-safety-guide.ai.md");

describe("documentation supersession and redirect conventions guardrails", () => {
  it("keeps human and AI supersession convention docs present", () => {
    expect(existsSync(conventionsPath)).toBe(true);
    expect(existsSync(conventionsAiPath)).toBe(true);
  });

  it("documents required supersession and redirect pattern anchors", () => {
    const conventions = readFileSync(conventionsPath, "utf8");
    const conventionsAi = readFileSync(conventionsAiPath, "utf8");

    for (const anchor of [
      "## Convention Components",
      "## When to Use Each Component",
      "## Required Information for Retired Paths",
      "## Lightweight Supersession Block Pattern",
      "## Pointer File Pattern",
      "## Deprecation Marker Pattern",
      "## Usage by Documentation Area",
      "## Clean Migration Sequence",
      "status: superseded",
      "status: deprecated",
      "superseded_by",
      "Effective date",
      "Retention/removal trigger",
    ] as const) {
      expect(conventions).toContain(anchor);
    }

    for (const anchor of [
      "## Required Supersession Signals",
      "## Component Selection Rules",
      "## Required Content for Superseded or Deprecated Paths",
      "## Lightweight Stub Pattern",
      "## Area-Specific Application",
      "## Migration Sequence",
      "status: superseded",
      "status: deprecated",
      "superseded_by",
      "## Supersession Notice",
      "## Redirect",
    ] as const) {
      expect(conventionsAi).toContain(anchor);
    }
  });

  it("keeps routers and contributor guidance linked to supersession conventions", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextReadmeAi = readFileSync(contextReadmeAiPath, "utf8");
    const docsReadme = readFileSync(docsReadmePath, "utf8");
    const docsReadmeAi = readFileSync(docsReadmeAiPath, "utf8");
    const placementGuide = readFileSync(placementGuidePath, "utf8");
    const placementGuideAi = readFileSync(placementGuideAiPath, "utf8");
    const migrationGuide = readFileSync(migrationGuidePath, "utf8");
    const migrationGuideAi = readFileSync(migrationGuideAiPath, "utf8");

    expect(contextReadme).toContain("./documentation-supersession-and-redirect-conventions.md");
    expect(contextReadmeAi).toContain("./documentation-supersession-and-redirect-conventions.ai.md");
    expect(docsReadme).toContain("./context/documentation-supersession-and-redirect-conventions.md");
    expect(docsReadmeAi).toContain("./context/documentation-supersession-and-redirect-conventions.ai.md");
    expect(placementGuide).toContain("documentation-supersession-and-redirect-conventions.md");
    expect(placementGuideAi).toContain("documentation-supersession-and-redirect-conventions.ai.md");
    expect(migrationGuide).toContain("documentation-supersession-and-redirect-conventions.md");
    expect(migrationGuideAi).toContain("documentation-supersession-and-redirect-conventions.ai.md");
  });
});
