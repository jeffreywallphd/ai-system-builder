import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractJsonPath = resolve(repoRoot, "docs/context/packs/context-pack.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/packs/README.md");
const aiSpecPath = resolve(repoRoot, "docs/context/packs/README.ai.md");
const packsReadmePath = resolve(repoRoot, "docs/context/packs/README.md");
const packsAiReadmePath = resolve(repoRoot, "docs/context/packs/README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");

const requiredHeadings = [
  "## Purpose",
  "## When To Use",
  "## When Not To Use",
  "## Invariants",
  "## Authoritative Docs",
  "## Authoritative Code Paths",
  "## Anti-Patterns",
  "## Related Packs",
] as const;

const optionalHeadings = [
  "## Retrieval Order",
  "## Change Triggers",
] as const;

type ContextPackContract = {
  schemaVersion: string;
  artifactType: string;
  canonicalHumanSpecPath: string;
  canonicalAiSpecPath: string;
  requiredSections: Array<{
    id: string;
    heading: string;
    requiredContent: string;
  }>;
  optionalSections: Array<{
    id: string;
    heading: string;
    requiredContent: string;
  }>;
  qualityRules: {
    brevityPolicy: string;
    maxRecommendedWords: number;
    maxRecommendedWordsPerSection: number;
    preferBulletedLists: boolean;
    signalToNoiseRules: string[];
    prohibitedContent: string[];
  };
};

function readContract(): ContextPackContract {
  return JSON.parse(readFileSync(contractJsonPath, "utf8")) as ContextPackContract;
}

describe("context pack contract guardrails", () => {
  it("keeps context pack contract artifacts present", () => {
    expect(existsSync(contractJsonPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("enforces required and optional sections in the machine-readable contract", () => {
    const contract = readContract();

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.artifactType).toBe("context-pack-contract");
    expect(contract.canonicalHumanSpecPath).toBe("docs/context/packs/README.md");
    expect(contract.canonicalAiSpecPath).toBe("docs/context/packs/README.ai.md");
    expect(contract.requiredSections.map((section) => section.heading)).toEqual(requiredHeadings);
    expect(contract.optionalSections.map((section) => section.heading)).toEqual(optionalHeadings);

    for (const section of [...contract.requiredSections, ...contract.optionalSections]) {
      expect(section.id.trim().length).toBeGreaterThan(0);
      expect(section.requiredContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("enforces brevity, signal-to-noise, and prohibited-content rules", () => {
    const contract = readContract();

    expect(contract.qualityRules.brevityPolicy).toBe("concise-and-scanable");
    expect(contract.qualityRules.maxRecommendedWords).toBe(900);
    expect(contract.qualityRules.maxRecommendedWordsPerSection).toBe(160);
    expect(contract.qualityRules.preferBulletedLists).toBe(true);
    expect(contract.qualityRules.signalToNoiseRules.length).toBeGreaterThanOrEqual(3);
    expect(contract.qualityRules.prohibitedContent).toContain("step-by-step runbooks");
    expect(contract.qualityRules.prohibitedContent).toContain("feature delivery checklists");
  });

  it("keeps human and AI pack specs aligned to required section anchors", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanSpec).toContain(heading);
      expect(aiSpec).toContain(heading);
    }

    expect(humanSpec).toContain("Required Sections");
    expect(aiSpec).toContain("Required Sections");
    expect(humanSpec).toContain("Optional Sections");
    expect(aiSpec).toContain("Optional Sections");
    expect(humanSpec).toContain("Brevity and Signal-To-Noise Rules");
    expect(aiSpec).toContain("Brevity and Signal Rules");
    expect(humanSpec).toContain("Content That Must Not Appear in a Context Pack");
    expect(aiSpec).toContain("Do Not Include");
  });

  it("keeps contract discoverable from context and pack routers", () => {
    const packsReadme = readFileSync(packsReadmePath, "utf8");
    const packsAiReadme = readFileSync(packsAiReadmePath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");

    expect(packsReadme).toContain("./context-pack.contract.json");
    expect(packsAiReadme).toContain("./context-pack.contract.json");
    expect(contextReadme).toContain("./packs/README.md#standard-context-pack-contract");
    expect(contextAiReadme).toContain("./packs/README.ai.md#standard-context-pack-contract");
  });
});
