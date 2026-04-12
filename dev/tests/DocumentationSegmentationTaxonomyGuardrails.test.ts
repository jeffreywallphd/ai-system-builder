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

const requiredHumanFrameworkHeadings = [
  "## Active Versus Historical Decision Framework",
  "## Segment Selection Signals",
  "## Borderline Case Rules",
  "## Mixed-Content Split and Redirect Procedure",
  "## Anti-Patterns for Mixed-Purpose and Low-Signal Documents",
  "## Anti-Pattern Migration Decision Rules",
] as const;

const requiredAiFrameworkHeadings = [
  "## Active Versus Historical Decision Rubric",
  "## Borderline and Mixed-Content Rules",
  "## Mixed-Content Split Workflow",
  "## Anti-Patterns for Mixed-Purpose and Low-Signal Docs",
  "## Anti-Pattern Decision Triggers",
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
    expect(humanTaxonomy).toContain("documentation-supersession-and-redirect-conventions.md");

    for (const heading of requiredHumanFrameworkHeadings) {
      expect(humanTaxonomy).toContain(heading);
    }

    for (const heading of requiredAiFrameworkHeadings) {
      expect(aiTaxonomy).toContain(heading);
    }
    expect(aiTaxonomy).toContain("documentation-supersession-and-redirect-conventions.ai.md");
  });

  it("keeps active-vs-historical and mixed-content decisions explicit", () => {
    const humanTaxonomy = readFileSync(humanTaxonomyPath, "utf8");
    const aiTaxonomy = readFileSync(aiTaxonomyPath, "utf8");

    for (const phrase of [
      "Current-action test",
      "Temporal-state test",
      "Authority-source test",
      "Purpose test",
      "Replacement test",
      "If a document has current instructions plus retrospective rationale",
      "If one file would require conflicting authority signals",
      "Extract current authoritative guidance into the destination active doc",
      "Convert the source path into either",
      "Current architecture guidance combined with running change logs",
      "Stale planning artifacts presented as current guidance",
      "README files absorbing too many roles",
      "If more than one-third of an active document is chronology",
    ]) {
      expect(humanTaxonomy).toContain(phrase);
    }

    for (const phrase of [
      "Current-action + canonical authority -> `Active Guidance`.",
      "Prior-state + traceability value -> `Historical Notes` or `Baselines`.",
      "Movement coordination -> `Migration Guides and Records` or `Temporary Transition Documents`.",
      "If classification is ambiguous, default to non-authoritative placement",
      "Keep the old path as either router index or superseded transition stub with destination links.",
      "`Architecture + change-log blend`",
      "`Stale plan as active authority`",
      "`Overloaded README`",
      "Move chronology/planning residue when it exceeds one-third of active document content.",
    ]) {
      expect(aiTaxonomy).toContain(phrase);
    }
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

