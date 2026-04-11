import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const standardPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.md");
const standardAiPath = resolve(repoRoot, "docs/context/governance/documentation-quality-standard.ai.md");
const governanceReadmePath = resolve(repoRoot, "docs/context/governance/README.md");
const governanceReadmeAiPath = resolve(repoRoot, "docs/context/governance/README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextReadmeAiPath = resolve(repoRoot, "docs/context/README.ai.md");
const governancePolicyPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.md");
const governancePolicyAiPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.ai.md");

const requiredHeadings = [
  "## Scope and Enforcement Boundary",
  "## Required Rules (Normative, Enforceable)",
  "## Documentation Category Rule Scope Matrix",
  "## Category-Specific Enforcement Boundaries",
  "## Recommended Guidance (Non-Blocking)",
  "## Automation Mapping for Lightweight Tooling",
  "## Governance and Change Control",
] as const;

describe("story 7.1.1 documentation quality standard guardrails", () => {
  it("keeps documentation quality standard docs present and discoverable from routers", () => {
    expect(existsSync(standardPath)).toBe(true);
    expect(existsSync(standardAiPath)).toBe(true);

    const governanceReadme = readFileSync(governanceReadmePath, "utf8");
    const governanceReadmeAi = readFileSync(governanceReadmeAiPath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextReadmeAi = readFileSync(contextReadmeAiPath, "utf8");

    expect(governanceReadme).toContain("./documentation-quality-standard.md");
    expect(governanceReadmeAi).toContain("./documentation-quality-standard.ai.md");
    expect(contextReadme).toContain("./governance/documentation-quality-standard.md");
    expect(contextReadmeAi).toContain("./governance/documentation-quality-standard.ai.md");
  });

  it("keeps required rules, non-blocking guidance, and automation mapping explicit", () => {
    const standard = readFileSync(standardPath, "utf8");
    const standardAi = readFileSync(standardAiPath, "utf8");
    const governancePolicy = readFileSync(governancePolicyPath, "utf8");
    const governancePolicyAi = readFileSync(governancePolicyAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(standard).toContain(heading);
      expect(standardAi).toContain(heading);
    }

    for (const phrase of [
      "required rules",
      "recommended guidance",
      "non-blocking",
      "lightweight tooling",
      "structure and metadata",
      "status and authority",
      "authoritativeness",
      "routing discipline",
      "cross-link",
      "readability boundaries",
      "automation",
    ]) {
      expect(standard.toLowerCase()).toContain(phrase.toLowerCase());
      expect(standardAi.toLowerCase()).toContain(phrase.toLowerCase());
    }

    expect(governancePolicy).toContain("documentation-quality-standard.md");
    expect(governancePolicyAi).toContain("documentation-quality-standard.ai.md");
  });
});
