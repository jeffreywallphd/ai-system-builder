import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const boundariesPath = resolve(
  repoRoot,
  "docs/context/governance/documentation-segmentation-rollout-boundaries.md",
);
const boundariesAiPath = resolve(
  repoRoot,
  "docs/context/governance/documentation-segmentation-rollout-boundaries.ai.md",
);
const governanceReadmePath = resolve(repoRoot, "docs/context/governance/README.md");
const governanceReadmeAiPath = resolve(repoRoot, "docs/context/governance/README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextReadmeAiPath = resolve(repoRoot, "docs/context/README.ai.md");
const governancePolicyPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.md");
const governancePolicyAiPath = resolve(
  repoRoot,
  "docs/context/governance/context-governance-policy.ai.md",
);
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const placementGuideAiPath = resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md");
const taxonomyPath = resolve(repoRoot, "docs/context/documentation-segmentation-taxonomy.md");
const taxonomyAiPath = resolve(repoRoot, "docs/context/documentation-segmentation-taxonomy.ai.md");

const requiredHeadings = [
  "## Scope and Intent",
  "## Initial Segmentation Rollout Scope (What Is Included)",
  "## Explicit Out-Of-Scope for Initial Rollout (What Is Not Included Yet)",
  "## Known Remaining Segmentation Gaps",
  "## Definition of Material Completion for This Feature",
  "## Follow-On Segmentation Work (Prioritized)",
  "## Contributor Extension Rules for Future Work",
] as const;

describe("story 5.4.4 documentation segmentation rollout boundaries guardrails", () => {
  it("keeps rollout-boundary docs present and discoverable from context routers and governance guidance", () => {
    expect(existsSync(boundariesPath)).toBe(true);
    expect(existsSync(boundariesAiPath)).toBe(true);

    const governanceReadme = readFileSync(governanceReadmePath, "utf8");
    const governanceReadmeAi = readFileSync(governanceReadmeAiPath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextReadmeAi = readFileSync(contextReadmeAiPath, "utf8");
    const governancePolicy = readFileSync(governancePolicyPath, "utf8");
    const governancePolicyAi = readFileSync(governancePolicyAiPath, "utf8");
    const placementGuide = readFileSync(placementGuidePath, "utf8");
    const placementGuideAi = readFileSync(placementGuideAiPath, "utf8");
    const taxonomy = readFileSync(taxonomyPath, "utf8");
    const taxonomyAi = readFileSync(taxonomyAiPath, "utf8");

    expect(governanceReadme).toContain("./documentation-segmentation-rollout-boundaries.md");
    expect(governanceReadmeAi).toContain("./documentation-segmentation-rollout-boundaries.ai.md");
    expect(contextReadme).toContain("./governance/documentation-segmentation-rollout-boundaries.md");
    expect(contextReadmeAi).toContain("./governance/documentation-segmentation-rollout-boundaries.ai.md");
    expect(governancePolicy).toContain("documentation-segmentation-rollout-boundaries.md");
    expect(governancePolicyAi).toContain("documentation-segmentation-rollout-boundaries.ai.md");
    expect(placementGuide).toContain("documentation-segmentation-rollout-boundaries.md");
    expect(placementGuideAi).toContain("documentation-segmentation-rollout-boundaries.ai.md");
    expect(taxonomy).toContain("documentation-segmentation-rollout-boundaries.md");
    expect(taxonomyAi).toContain("documentation-segmentation-rollout-boundaries.ai.md");
  });

  it("keeps initial scope, honest remaining work, and extension boundaries explicit", () => {
    const boundaries = readFileSync(boundariesPath, "utf8");
    const boundariesAi = readFileSync(boundariesAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(boundaries).toContain(heading);
      expect(boundariesAi).toContain(heading);
    }

    for (const phrase of [
      "Story 5.4.4",
      "materially complete",
      "out of scope",
      "known remaining",
      "follow-on",
      "intentionally bounded",
      "does not require exhaustive",
      "classify first, move second",
      "without reopening ambiguity",
    ]) {
      expect(boundaries.toLowerCase()).toContain(phrase.toLowerCase());
      expect(boundariesAi.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });
});
