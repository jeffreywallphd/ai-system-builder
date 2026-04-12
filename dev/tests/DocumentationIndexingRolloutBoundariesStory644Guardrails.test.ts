import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const boundariesPath = resolve(
  repoRoot,
  "docs/context/governance/documentation-indexing-rollout-boundaries.md",
);
const boundariesAiPath = resolve(
  repoRoot,
  "docs/context/governance/documentation-indexing-rollout-boundaries.ai.md",
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

const requiredHeadings = [
  "## Scope and Intent",
  "## Initial Indexing Rollout Scope (What Is Included)",
  "## Explicit Out-Of-Scope for Initial Rollout (What Is Not Included Yet)",
  "## Known Limitations and Remaining Gaps",
  "## Definition of Material Completion for Feature 6",
  "## Future Expansion Points (Prioritized)",
  "## Contributor Extension Points and Change Boundaries",
] as const;

describe("story 6.4.4 documentation indexing rollout boundaries guardrails", () => {
  it("keeps indexing rollout-boundary docs present and discoverable from context governance routers", () => {
    expect(existsSync(boundariesPath)).toBe(true);
    expect(existsSync(boundariesAiPath)).toBe(true);

    const governanceReadme = readFileSync(governanceReadmePath, "utf8");
    const governanceReadmeAi = readFileSync(governanceReadmeAiPath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextReadmeAi = readFileSync(contextReadmeAiPath, "utf8");
    const governancePolicy = readFileSync(governancePolicyPath, "utf8");
    const governancePolicyAi = readFileSync(governancePolicyAiPath, "utf8");

    expect(governanceReadme).toContain("./documentation-indexing-rollout-boundaries.md");
    expect(governanceReadmeAi).toContain("./documentation-indexing-rollout-boundaries.ai.md");
    expect(contextReadme).toContain("./governance/documentation-indexing-rollout-boundaries.md");
    expect(contextReadmeAi).toContain("./governance/documentation-indexing-rollout-boundaries.ai.md");
    expect(governancePolicy).toContain("documentation-indexing-rollout-boundaries.md");
    expect(governancePolicyAi).toContain("documentation-indexing-rollout-boundaries.ai.md");
  });

  it("keeps rollout scope, known limitations, and future expansion points explicit", () => {
    const boundaries = readFileSync(boundariesPath, "utf8");
    const boundariesAi = readFileSync(boundariesAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(boundaries).toContain(heading);
      expect(boundariesAi).toContain(heading);
    }

    for (const phrase of [
      "Story 6.4.4",
      "materially complete",
      "out-of-scope",
      "known limitations",
      "remaining gaps",
      "does not require exhaustive",
      "full-text search",
      "semantic ranking",
      "Stronger automation",
      "Broader documentation-tooling integration",
      "deterministically locate authoritative",
    ]) {
      expect(boundaries.toLowerCase()).toContain(phrase.toLowerCase());
      expect(boundariesAi.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });
});
