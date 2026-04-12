import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const guidancePath = resolve(repoRoot, "docs/context/governance/high-risk-context-pack-guidance.md");
const guidanceAiPath = resolve(repoRoot, "docs/context/governance/high-risk-context-pack-guidance.ai.md");
const governanceReadmePath = resolve(repoRoot, "docs/context/governance/README.md");
const governanceAiReadmePath = resolve(repoRoot, "docs/context/governance/README.ai.md");
const governancePolicyPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.md");
const governancePolicyAiPath = resolve(repoRoot, "docs/context/governance/context-governance-policy.ai.md");
const packCatalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");

const requiredHeadings = [
  "## Scope",
  "## High-Risk Pack Domains and Rationale",
  "## Ownership and Review Expectations",
  "## Special Caution Areas",
  "## Broader Review Triggers",
  "## Update and Verification Expectations",
] as const;

const requiredHighRiskPackIds = [
  "architecture-core",
  "runtime-and-host",
  "identity-and-security",
] as const;

describe("high-risk context pack guidance guardrails", () => {
  it("keeps high-risk guidance docs present and discoverable", () => {
    expect(existsSync(guidancePath)).toBe(true);
    expect(existsSync(guidanceAiPath)).toBe(true);

    const governanceReadme = readFileSync(governanceReadmePath, "utf8");
    const governanceAiReadme = readFileSync(governanceAiReadmePath, "utf8");
    const governancePolicy = readFileSync(governancePolicyPath, "utf8");
    const governancePolicyAi = readFileSync(governancePolicyAiPath, "utf8");

    expect(governanceReadme).toContain("./high-risk-context-pack-guidance.md");
    expect(governanceAiReadme).toContain("./high-risk-context-pack-guidance.ai.md");
    expect(governancePolicy).toContain("high-risk-context-pack-guidance.md");
    expect(governancePolicyAi).toContain("high-risk-context-pack-guidance.ai.md");
  });

  it("keeps high-risk domains, rationale, and broader review triggers explicit", () => {
    const guidance = readFileSync(guidancePath, "utf8");
    const guidanceAi = readFileSync(guidanceAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(guidance).toContain(heading);
      expect(guidanceAi).toContain(heading);
    }

    for (const requiredPhrase of [
      "architecture-core",
      "runtime-and-host",
      "identity-and-security",
      "architectural invariants",
      "startup",
      "trust",
      "deny-by-default",
      "least-privilege",
      "multi-team review",
    ]) {
      expect(guidance).toContain(requiredPhrase);
      expect(guidanceAi).toContain(requiredPhrase);
    }
  });

  it("keeps high-risk pack ownership and cadence expectations encoded in the pack catalog", () => {
    const catalogSeed = JSON.parse(readFileSync(packCatalogSeedPath, "utf8")) as {
      packs: Array<{
        id: string;
        notes?: string;
        reviewExpectations?: {
          cadence?: string;
          lastReviewed?: string;
        };
      }>;
    };

    const packMap = new Map(catalogSeed.packs.map((entry) => [entry.id, entry]));

    for (const packId of requiredHighRiskPackIds) {
      const entry = packMap.get(packId);
      expect(entry).toBeDefined();
      expect(entry?.notes).toBeDefined();
      expect(entry?.notes?.toLowerCase()).toContain("high-risk domain");
      expect(entry?.reviewExpectations?.cadence).toBe("per-story-and-epic-milestone");
      expect(entry?.reviewExpectations?.lastReviewed).toBeDefined();
    }
  });
});
