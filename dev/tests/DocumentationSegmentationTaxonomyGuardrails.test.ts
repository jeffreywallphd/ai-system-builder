import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanTaxonomyPath = resolve(repoRoot, "docs/context/documentation-segmentation-taxonomy.md");
const aiTaxonomyPath = resolve(repoRoot, "docs/context/documentation-segmentation-taxonomy.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");
const docsReadmePath = resolve(repoRoot, "docs/README.md");
const docsAiReadmePath = resolve(repoRoot, "docs/README.ai.md");
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const placementGuideAiPath = resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md");

const requiredSegments = [
  "Active Guidance",
  "Baselines",
  "Historical Notes",
  "Migration Guides and Records",
  "Rollout-Boundary Notes",
  "Temporary Transition Documents",
  "Superseded or Deprecated Documents",
] as const;

describe("documentation segmentation taxonomy guardrails", () => {
  it("keeps human and AI taxonomy artifacts present", () => {
    expect(existsSync(humanTaxonomyPath)).toBe(true);
    expect(existsSync(aiTaxonomyPath)).toBe(true);
  });

  it("keeps required segment categories documented in both artifacts", () => {
    const humanTaxonomy = readFileSync(humanTaxonomyPath, "utf8");
    const aiTaxonomy = readFileSync(aiTaxonomyPath, "utf8");

    for (const segment of requiredSegments) {
      expect(humanTaxonomy).toContain(segment);
      expect(aiTaxonomy).toContain(segment);
    }

    expect(humanTaxonomy).toContain("## Classification Rules");
    expect(humanTaxonomy).toContain("## Practical Placement Heuristics");
    expect(humanTaxonomy).toContain("`doc_type`");
    expect(humanTaxonomy).toContain("`status`");
    expect(humanTaxonomy).toContain("`authoritativeness`");
  });

  it("keeps context and root routers linked to segmentation taxonomy", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");
    const docsReadme = readFileSync(docsReadmePath, "utf8");
    const docsAiReadme = readFileSync(docsAiReadmePath, "utf8");

    expect(contextReadme).toContain("./documentation-segmentation-taxonomy.md");
    expect(contextAiReadme).toContain("./documentation-segmentation-taxonomy.ai.md");
    expect(docsReadme).toContain("./context/documentation-segmentation-taxonomy.md");
    expect(docsAiReadme).toContain("./context/documentation-segmentation-taxonomy.ai.md");
  });

  it("keeps contributor placement guidance connected to segmentation rules", () => {
    const placementGuide = readFileSync(placementGuidePath, "utf8");
    const placementGuideAi = readFileSync(placementGuideAiPath, "utf8");

    expect(placementGuide).toContain("## Documentation Segmentation Taxonomy Mapping");
    expect(placementGuide).toContain("docs/context/documentation-segmentation-taxonomy.md");
    expect(placementGuideAi).toContain("## Segmentation Taxonomy Mapping");
    expect(placementGuideAi).toContain("docs/context/documentation-segmentation-taxonomy.ai.md");
  });
});

