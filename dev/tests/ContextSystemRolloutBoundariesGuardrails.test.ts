import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const boundariesPath = resolve(repoRoot, "docs/context/governance/context-system-rollout-boundaries.md");
const boundariesAiPath = resolve(repoRoot, "docs/context/governance/context-system-rollout-boundaries.ai.md");
const governanceReadmePath = resolve(repoRoot, "docs/context/governance/README.md");
const governanceAiReadmePath = resolve(repoRoot, "docs/context/governance/README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");
const governancePolicyPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.md");
const governancePolicyAiPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.ai.md");

const requiredHeadings = [
  "## Scope and Intent",
  "## Initial Release Scope (What Is Included)",
  "## Explicit Non-Goals for Initial Release (What Is Not Included Yet)",
  "## Known Gaps and Constraints",
  "## Definition of Complete for This Release",
  "## Follow-On Work (Recommended Next Extensions)",
  "## Contributor Extension Points",
] as const;

describe("context system rollout boundaries guardrails", () => {
  it("keeps rollout boundaries docs present and discoverable from context governance routers", () => {
    expect(existsSync(boundariesPath)).toBe(true);
    expect(existsSync(boundariesAiPath)).toBe(true);

    const governanceReadme = readFileSync(governanceReadmePath, "utf8");
    const governanceAiReadme = readFileSync(governanceAiReadmePath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");
    const governancePolicy = readFileSync(governancePolicyPath, "utf8");
    const governancePolicyAi = readFileSync(governancePolicyAiPath, "utf8");

    expect(governanceReadme).toContain("./context-system-rollout-boundaries.md");
    expect(governanceAiReadme).toContain("./context-system-rollout-boundaries.ai.md");
    expect(contextReadme).toContain("./governance/context-system-rollout-boundaries.md");
    expect(contextAiReadme).toContain("./governance/context-system-rollout-boundaries.ai.md");
    expect(governancePolicy).toContain("context-system-rollout-boundaries.md");
    expect(governancePolicyAi).toContain("context-system-rollout-boundaries.ai.md");
  });

  it("keeps initial scope boundaries, known gaps, and follow-on work explicit", () => {
    const boundaries = readFileSync(boundariesPath, "utf8");
    const boundariesAi = readFileSync(boundariesAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(boundaries).toContain(heading);
      expect(boundariesAi).toContain(heading);
    }

    for (const requiredPhrase of [
      "deterministic",
      "not exhaustive",
      "Full-document or codebase-wide indexing",
      "Strict universal metadata/header enforcement",
      "Broaden indexing and coverage",
      "Tighten documentation enforcement",
      "Definition of Complete",
      "does not require exhaustive context",
    ]) {
      expect(boundaries).toContain(requiredPhrase);
      expect(boundariesAi).toContain(requiredPhrase);
    }
  });
});
