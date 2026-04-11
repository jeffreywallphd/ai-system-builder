import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const seedGuidancePath = resolve(repoRoot, "docs/context/documentation-segmentation-seed-guidance.md");
const seedGuidanceAiPath = resolve(repoRoot, "docs/context/documentation-segmentation-seed-guidance.ai.md");
const seedTemplatePath = resolve(
  repoRoot,
  "docs/context/templates/documentation-segmentation-seeds.template.md",
);
const seedTemplateAiPath = resolve(
  repoRoot,
  "docs/context/templates/documentation-segmentation-seeds.template.ai.md",
);
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextReadmeAiPath = resolve(repoRoot, "docs/context/README.ai.md");
const templatesReadmePath = resolve(repoRoot, "docs/context/templates/README.md");
const templatesReadmeAiPath = resolve(repoRoot, "docs/context/templates/README.ai.md");
const docsReadmePath = resolve(repoRoot, "docs/README.md");
const docsReadmeAiPath = resolve(repoRoot, "docs/README.ai.md");
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const placementGuideAiPath = resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md");
const migrationGuidePath = resolve(repoRoot, "docs/contributors/docs-migration-safety-guide.md");
const migrationGuideAiPath = resolve(repoRoot, "docs/contributors/docs-migration-safety-guide.ai.md");

describe("documentation segmentation seed guidance guardrails", () => {
  it("keeps seed guidance and template artifacts present for human and AI paths", () => {
    expect(existsSync(seedGuidancePath)).toBe(true);
    expect(existsSync(seedGuidanceAiPath)).toBe(true);
    expect(existsSync(seedTemplatePath)).toBe(true);
    expect(existsSync(seedTemplateAiPath)).toBe(true);
  });

  it("documents required lightweight seed patterns", () => {
    const seedGuidance = readFileSync(seedGuidancePath, "utf8");
    const seedGuidanceAi = readFileSync(seedGuidanceAiPath, "utf8");

    for (const anchor of [
      "## Seed 1: Classification Note Template",
      "## Seed 2: Superseded-By Marker Template",
      "## Seed 3: Baseline File Introduction Template",
      "## Seed 4: Migration Decision Checklist",
      "## Fast Placement Decisions for Baselines",
      "Primary segment",
      "## Supersession Notice",
      "Effective date",
      "Retention/removal trigger",
      "## Baseline Introduction",
      "docs/context/documentation-segmentation-taxonomy.md",
      "docs/context/documentation-baseline-and-historical-folder-strategy.md",
      "docs/context/documentation-supersession-and-redirect-conventions.md",
    ] as const) {
      expect(seedGuidance).toContain(anchor);
    }

    for (const anchor of [
      "## Seed Template: Classification Note",
      "## Seed Template: Superseded-By Marker",
      "## Seed Template: Baseline Introduction",
      "## Seed Template: Migration Decision Checklist",
      "## Fast Baseline Routing",
      "Primary segment",
      "## Supersession Notice",
      "Effective date",
      "Retention/removal trigger",
      "## Baseline Introduction",
      "documentation-segmentation-taxonomy.ai.md",
      "documentation-baseline-and-historical-folder-strategy.ai.md",
      "documentation-supersession-and-redirect-conventions.ai.md",
    ] as const) {
      expect(seedGuidanceAi).toContain(anchor);
    }
  });

  it("keeps copy/paste template snippets aligned to the seed guidance patterns", () => {
    const template = readFileSync(seedTemplatePath, "utf8");
    const templateAi = readFileSync(seedTemplateAiPath, "utf8");

    for (const content of [template, templateAi]) {
      expect(content).toContain("## Classification Note Template");
      expect(content).toContain("## Supersession Marker Template");
      expect(content).toContain("## Baseline Introduction Template");
      expect(content).toContain("## Migration Decision Checklist Template");
      expect(content).toContain("Primary segment");
      expect(content).toContain("## Supersession Notice");
      expect(content).toContain("## Baseline Introduction");
      expect(content).toContain("Retention/removal trigger");
      expect(content).toContain("`superseded_by`");
    }
  });

  it("keeps seed guidance discoverable from context and contributor workflows", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextReadmeAi = readFileSync(contextReadmeAiPath, "utf8");
    const templatesReadme = readFileSync(templatesReadmePath, "utf8");
    const templatesReadmeAi = readFileSync(templatesReadmeAiPath, "utf8");
    const docsReadme = readFileSync(docsReadmePath, "utf8");
    const docsReadmeAi = readFileSync(docsReadmeAiPath, "utf8");
    const placementGuide = readFileSync(placementGuidePath, "utf8");
    const placementGuideAi = readFileSync(placementGuideAiPath, "utf8");
    const migrationGuide = readFileSync(migrationGuidePath, "utf8");
    const migrationGuideAi = readFileSync(migrationGuideAiPath, "utf8");

    expect(contextReadme).toContain("./documentation-segmentation-seed-guidance.md");
    expect(contextReadmeAi).toContain("./documentation-segmentation-seed-guidance.ai.md");
    expect(templatesReadme).toContain("documentation-segmentation-seeds.template.md");
    expect(templatesReadmeAi).toContain("documentation-segmentation-seeds.template.md");
    expect(docsReadme).toContain("./context/documentation-segmentation-seed-guidance.md");
    expect(docsReadmeAi).toContain("./context/documentation-segmentation-seed-guidance.ai.md");
    expect(placementGuide).toContain("documentation-segmentation-seed-guidance.md");
    expect(placementGuideAi).toContain("documentation-segmentation-seed-guidance.ai.md");
    expect(migrationGuide).toContain("documentation-segmentation-seed-guidance.md");
    expect(migrationGuideAi).toContain("documentation-segmentation-seed-guidance.ai.md");
  });
});
